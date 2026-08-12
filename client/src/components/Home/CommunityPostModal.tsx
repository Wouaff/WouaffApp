import { ArrowBigDown, ArrowBigUp, Link2, MessageCircle, Pin, Shield, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { communities as communitiesAPI } from '../../services/api';
import type { CommunityComment, CommunityPost, CommunityRole } from '../../types';
import { showToast } from '../Common/Toast';
import PostText from './PostText';

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'hier';
  return `il y a ${d} j`;
}

interface CommunityPostModalProps {
  post: CommunityPost;
  myRole: CommunityRole | null;
  onClose: () => void;
  onVote: (post: CommunityPost, value: -1 | 0 | 1) => void;
  onDeleted?: (post: CommunityPost) => void;
  onPinned?: (post: CommunityPost) => void;
}

export default function CommunityPostModal({
  post,
  myRole,
  onClose,
  onVote,
  onDeleted,
  onPinned,
}: CommunityPostModalProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const isMod = myRole === 'admin' || myRole === 'moderator';

  const loadComments = useCallback(() => {
    setLoading(true);
    communitiesAPI
      .comments(post.communityName, post.id)
      .then((data) => setComments(data.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [post.communityName, post.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submitComment = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const comment = await communitiesAPI.addComment(post.communityName, post.id, value);
      setComments((prev) => [...prev, comment]);
      setText('');
    } catch (err) {
      showToast((err as Error).message || "Erreur lors de l'envoi", 'error');
    } finally {
      setSending(false);
    }
  };

  const removeComment = async (comment: CommunityComment) => {
    if (!confirm('Supprimer ce commentaire ?')) return;
    try {
      await communitiesAPI.deleteComment(post.communityName, post.id, comment.id);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const removePost = async () => {
    if (!confirm('Supprimer ce post ?')) return;
    try {
      await communitiesAPI.deletePost(post.communityName, post.id);
      onDeleted?.(post);
      setDeleted(true);
    } catch (err) {
      showToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    }
  };

  const togglePin = async () => {
    try {
      await communitiesAPI.pin(post.communityName, post.id, !post.isPinned);
      onPinned?.(post);
      onClose();
    } catch (err) {
      showToast((err as Error).message || 'Erreur', 'error');
    }
  };

  const voteBtn = (value: 1 | -1) =>
    `flex items-center gap-1 text-[13px] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 transition-colors ${
      post.vote === value
        ? value === 1
          ? 'text-brand'
          : 'text-[var(--danger)]'
        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
    }`;

  if (deleted) {
    return (
      <div
        className="modal-overlay active"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="flex flex-col w-full max-w-[600px] rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl p-8 items-center gap-3 text-center">
          <span className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
            <Trash2 size={26} className="text-[var(--danger)]" />
          </span>
          <p className="m-0 text-[15px] font-bold text-[var(--text-primary)]">Post supprimé</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 bg-brand hover:opacity-90 transition-opacity text-white font-bold text-sm rounded-full px-6 py-2.5 border-none cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="modal-overlay active"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex flex-col w-full max-w-[640px] max-h-[90dvh] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl">
        <div className="flex items-center gap-4 px-4 h-14 border-b border-[var(--border)] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-primary)] border-none bg-transparent cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={18} />
          </button>
          <span className="font-bold text-[var(--text-primary)] text-[17px] m-0 truncate">
            c/{post.communityName}
            {post.isPinned && (
              <span className="ml-2 align-middle text-[12px] font-bold text-online">
                <Pin size={12} className="inline align-text-bottom" /> Épinglé
              </span>
            )}
          </span>
          {isMod && (
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={togglePin}
                className="flex items-center gap-1 text-[12px] font-bold text-[var(--text-muted)] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 hover:text-online hover:bg-online/10 transition-colors"
              >
                <Pin size={14} />
                {post.isPinned ? 'Désépingler' : 'Épingler'}
              </button>
              <button
                type="button"
                onClick={removePost}
                className="flex items-center gap-1 text-[12px] font-bold text-[var(--text-muted)] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 hover:text-[var(--danger)] hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} />
                Supprimer
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-1.5 flex-wrap text-[13px] text-[var(--text-muted)]">
              {post.isPinned && <Shield size={13} className="text-online" />}
              <span>
                publié par <span className="font-semibold text-[var(--text-secondary)]">{post.authorPseudo}</span>
              </span>
              <span>·</span>
              <span>{formatTime(post.createdAt)}</span>
            </div>
            <h2 className="m-0 mt-1.5 text-[20px] font-extrabold leading-snug text-[var(--text-primary)] break-words">
              {post.title}
            </h2>
            {post.type === 'image' && post.content && (
              <img
                src={post.content}
                alt={post.title}
                className="mt-2 rounded-2xl border border-[var(--border)] max-h-[480px] w-full object-cover"
              />
            )}
            {post.type === 'link' && post.content && (
              <a
                href={post.content}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 text-[13px] text-brand no-underline hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Link2 size={15} className="flex-shrink-0" />
                <span className="truncate">{post.content}</span>
              </a>
            )}
            {post.type === 'text' && post.content && (
              <p className="m-0 mt-2 text-[15px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words">
                <PostText text={post.content} />
              </p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <button type="button" onClick={() => onVote(post, post.vote === 1 ? 0 : 1)} className={voteBtn(1)}>
                <ArrowBigUp size={20} />
                <span>{post.upvotes}</span>
              </button>
              <button type="button" onClick={() => onVote(post, post.vote === -1 ? 0 : -1)} className={voteBtn(-1)}>
                <ArrowBigDown size={20} />
                <span>{post.downvotes}</span>
              </button>
              <span className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] px-2 py-1">
                <MessageCircle size={17} />
                <span>{post.commentCount}</span>
              </span>
            </div>
          </div>

          <div className="px-4 py-3 border-t border-[var(--border)]">
            {loading ? (
              <div className="py-8 flex flex-col items-center gap-3">
                <div className="spinner" />
                <p className="m-0 text-sm text-[var(--text-muted)]">Chargement des commentaires...</p>
              </div>
            ) : comments.length === 0 ? (
              <p className="m-0 py-6 text-center text-[var(--text-secondary)]">
                Aucun commentaire pour le moment. Sois le premier à répondre !
              </p>
            ) : (
              <ul className="list-none m-0 p-0">
                {comments.map((c) => (
                  <li key={c.id} className="flex gap-3 py-3 border-b border-[var(--border)] last:border-b-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-sm overflow-hidden flex-shrink-0">
                      {c.authorAvatar ? (
                        <img src={c.authorAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{(c.authorPseudo || '?')[0]?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-bold text-[var(--text-primary)] text-[14px]">{c.authorPseudo}</span>
                        <span className="text-[var(--text-muted)] text-[13px]">·</span>
                        <span className="text-[var(--text-muted)] text-[13px]">{formatTime(c.createdAt)}</span>
                        {(isMod || c.authorId === user?.uid) && (
                          <button
                            type="button"
                            onClick={() => removeComment(c)}
                            aria-label="Supprimer le commentaire"
                            className="ml-auto flex items-center gap-1 text-[12px] text-[var(--text-muted)] rounded-full border-none bg-transparent cursor-pointer px-2 py-0.5 hover:text-[var(--danger)] hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      {c.deleted ? (
                        <p className="m-0 mt-0.5 text-[13px] italic text-[var(--text-muted)]">[Commentaire supprimé]</p>
                      ) : (
                        <p className="m-0 mt-0.5 text-[14px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words">
                          <PostText text={c.content} />
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border)] flex-shrink-0">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitComment();
            }}
            placeholder="Répondre..."
            maxLength={2000}
            aria-label="Répondre au post"
            className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-full px-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--brand)] font-sans transition-colors"
          />
          <button
            type="button"
            onClick={submitComment}
            disabled={!text.trim() || sending}
            className="bg-brand hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-white font-bold text-sm rounded-full px-4 py-2 border-none cursor-pointer"
          >
            Répondre
          </button>
        </div>
      </div>
    </div>
  );
}
