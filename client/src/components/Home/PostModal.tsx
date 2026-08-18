import { IonModal } from '@ionic/react';
import { BadgeCheck, Flag, Heart, MessageCircle, Repeat2, Reply, Share2, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useBadges } from '../../hooks/useBadges';
import { useCap } from '../../hooks/useCap';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useMentionAutocomplete } from '../../hooks/useMentionAutocomplete';
import { posts as postsAPI } from '../../services/api';
import { offPostComment, offPostDeleted, onPostComment, onPostDeleted } from '../../services/socket';
import type { MentionUser, PostComment, SocialPost } from '../../types';
import { type MentionToken, replaceMentionAt } from '../../utils/mentions';
import BadgeIcons from '../Common/BadgeIcons';
import { showToast } from '../Common/Toast';
import VoiceMessage from '../Common/VoiceMessage';
import MentionSuggestions from './MentionSuggestions';
import Poll from './Poll';
import PostEmbeds from './PostEmbeds';
import PostText from './PostText';
import ReportPostModal from './ReportPostModal';
import SharePostModal from './SharePostModal';

interface PostModalProps {
  post: SocialPost;
  onClose: () => void;
  onLike: (id: string) => void;
  onRepost: (id: string) => void;
  onVote: (id: string, option: number) => void;
  onCommentDelta: (id: string, delta: number) => void;
}

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

export default function PostModal({ post, onClose, onLike, onRepost, onVote, onCommentDelta }: PostModalProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const badgeDefs = useBadges();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const cap = useCap('comment');
  const isOwn = !!user && post.uid === user.uid;

  const startReply = useCallback((c: PostComment) => {
    const handle = c.handle || (c.pseudo ? `@${c.pseudo.toLowerCase().replace(/\s+/g, '')}` : '');
    setReplyTo(c);
    setText(handle ? `${handle} ` : '');
    requestAnimationFrame(() => {
      const el = commentInputRef.current;
      if (el) {
        el.focus();
        const pos = el.value.length;
        el.setSelectionRange(pos, pos);
      }
    });
  }, []);

  const clearReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const applyMention = useCallback((mentionUser: MentionUser, token: MentionToken) => {
    setText((prev) => replaceMentionAt(prev, token, `${mentionUser.handle} `));
    requestAnimationFrame(() => {
      const el = commentInputRef.current;
      if (el) {
        el.focus();
        const pos = token.start + mentionUser.handle.length + 1;
        el.setSelectionRange(pos, pos);
      }
    });
  }, []);

  const mention = useMentionAutocomplete(applyMention);

  useEffect(() => {
    let cancelled = false;
    postsAPI
      .comments(post.id)
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .catch(() => {
        if (!cancelled) showToast('Impossible de charger les commentaires', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [post.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const handleComment = (data: { postId: string; comment: PostComment }) => {
      if (data.postId !== post.id) return;
      setComments((prev) => (prev.some((c) => c.id === data.comment.id) ? prev : [...prev, data.comment]));
    };
    const handleDeleted = (data: { postId: string }) => {
      if (data.postId === post.id) onClose();
    };
    onPostComment(handleComment);
    onPostDeleted(handleDeleted);
    return () => {
      offPostComment(handleComment);
      offPostDeleted(handleDeleted);
    };
  }, [post.id, onClose]);

  const submitComment = useCallback(async () => {
    const value = text.trim();
    if (!value || sending) return;
    if (cap.required && !cap.token) {
      showToast('Veuillez confirmer que vous êtes humain.', 'error');
      return;
    }
    setSending(true);
    try {
      const comment = await postsAPI.addComment(post.id, value, cap.token);
      setComments((prev) => [...prev, comment]);
      onCommentDelta(post.id, 1);
      cap.reset();
      setText('');
      setReplyTo(null);
    } catch {
      showToast("Erreur lors de l'envoi du commentaire", 'error');
    } finally {
      setSending(false);
    }
  }, [post.id, text, sending, onCommentDelta, cap]);

  const removeComment = useCallback(
    async (commentId: number) => {
      if (!confirm('Supprimer ce commentaire ?')) return;
      try {
        await postsAPI.deleteComment(commentId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        onCommentDelta(post.id, -1);
        showToast('Commentaire supprimé', 'success');
      } catch {
        showToast('Erreur lors de la suppression', 'error');
      }
    },
    [post.id, onCommentDelta],
  );

  const initial = (post.pseudo || '?')[0]?.toUpperCase() || '?';

  const actionBtn =
    'flex items-center gap-1.5 text-[13px] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 transition-colors text-[var(--text-muted)] hover:text-brand hover:bg-[var(--brand-glow)]';
  const actionBtnLiked = `flex items-center gap-1.5 text-[13px] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 transition-colors ${
    post.liked ? 'text-red-500' : 'text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10'
  }`;
  const actionBtnReposted = `flex items-center gap-1.5 text-[13px] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 transition-colors ${
    post.reposted ? 'text-online' : 'text-[var(--text-muted)] hover:text-online hover:bg-online/10'
  }`;

  return (
    <IonModal
      isOpen
      backdropDismiss
      onDidDismiss={onClose}
      className={isMobile ? 'post-modal-mobile' : 'post-modal-desktop'}
    >
      <div className="flex flex-col w-full h-full overflow-hidden bg-[var(--bg-card)]">
        <div className="flex items-center gap-4 px-4 h-14 border-b border-[var(--border)] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-primary)] border-none bg-transparent cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={18} />
          </button>
          <span className="font-bold text-[var(--text-primary)] text-[17px] m-0">Post</span>
        </div>

        <div className="post-modal-post px-4 pt-4 pb-2 flex gap-3 flex-shrink-0">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-base overflow-hidden flex-shrink-0">
            {post.avatar ? (
              <img src={post.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{initial}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-bold text-[var(--text-primary)] text-[15px]">{post.pseudo}</span>
              {post.verified && (
                <BadgeCheck size={17} className="text-brand flex-shrink-0" aria-label="Compte vérifié" />
              )}
              <BadgeIcons ids={post.ownedBadges} defs={badgeDefs} size={16} />
              <span className="text-[var(--text-muted)] text-[15px]">·</span>
              <span className="text-[var(--text-muted)] text-[15px]">{post.handle}</span>
              <span className="text-[var(--text-muted)] text-[15px]">·</span>
              <span className="text-[var(--text-muted)] text-[15px]">{formatTime(post.time)}</span>
            </div>
            {post.text && (
              <p className="m-0 mt-1 text-[15px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words">
                <PostText text={post.text} />
              </p>
            )}
            <PostEmbeds text={post.text} />
            {post.poll && <Poll poll={post.poll} onVote={(option) => onVote(post.id, option)} />}
            {post.image && (
              <img
                src={post.image}
                alt="Post"
                className="mt-2 rounded-2xl border border-[var(--border)] max-h-[480px] w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            )}
            {post.audio && (
              <div className="mt-2 max-w-[425px]">
                <VoiceMessage audioData={post.audio} duration={post.audioDuration} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--border)] max-w-[400px] flex-shrink-0">
          <button type="button" className={actionBtn} aria-label={`Commenter (${post.comments})`}>
            <MessageCircle size={17} />
            <span>{post.comments}</span>
          </button>
          <button
            type="button"
            onClick={() => onRepost(post.id)}
            className={actionBtnReposted}
            aria-label={`Repartager (${post.reposts})`}
          >
            <Repeat2 size={17} />
            <span>{post.reposts}</span>
          </button>
          <button
            type="button"
            onClick={() => onLike(post.id)}
            className={actionBtnLiked}
            aria-label={`J'aime (${post.likes})`}
          >
            <Heart size={17} fill={post.liked ? 'currentColor' : 'none'} />
            <span>{post.likes}</span>
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className={actionBtn}
            aria-label="Partager ce post"
            title="Partager"
          >
            <Share2 size={17} />
          </button>
          {!isOwn && (
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className={`${actionBtn} hover:text-red-500 hover:bg-red-500/10`}
              aria-label="Signaler ce post"
              title="Signaler"
            >
              <Flag size={17} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
          {loading ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="spinner" />
              <p className="m-0 text-sm text-[var(--text-muted)]">Chargement des commentaires...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="py-10 text-center">
              <p className="m-0 text-[var(--text-secondary)]">
                Aucun commentaire pour le moment. Sois le premier à répondre !
              </p>
            </div>
          ) : (
            <ul className="list-none m-0 p-0">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-3 py-3 border-b border-[var(--border)] last:border-b-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-sm overflow-hidden flex-shrink-0">
                    {c.avatar ? (
                      <img src={c.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{(c.pseudo || '?')[0]?.toUpperCase() || '?'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold text-[var(--text-primary)] text-[14px]">{c.pseudo || 'Inconnu'}</span>
                      {c.verified && (
                        <BadgeCheck size={15} className="text-brand flex-shrink-0" aria-label="Compte vérifié" />
                      )}
                      {(c.ownedBadges || [])
                        .map((id) => badgeDefs[id])
                        .filter((b): b is { name?: string; icon?: string } => !!b && !!b.icon)
                        .map((b) => (
                          <img
                            key={b.icon}
                            src={b.icon}
                            alt={b.name || 'Badge'}
                            title={b.name || 'Badge'}
                            className="w-[15px] h-[15px] rounded-full flex-shrink-0 object-cover"
                          />
                        ))}
                      <span className="text-[var(--text-muted)] text-[13px]">·</span>
                      <span className="text-[var(--text-muted)] text-[13px]">{formatTime(c.createdAt)}</span>
                      <div className="ml-auto flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => startReply(c)}
                          aria-label={`Répondre à ${c.pseudo || 'ce commentaire'}`}
                          title="Répondre"
                          className="flex items-center gap-1 text-[12px] text-[var(--text-muted)] rounded-full border-none bg-transparent cursor-pointer px-2 py-0.5 hover:text-brand hover:bg-[var(--brand-glow)] transition-colors"
                        >
                          <Reply size={13} />
                          <span className="hidden sm:inline">Répondre</span>
                        </button>
                        {c.uid === user?.uid && (
                          <button
                            type="button"
                            onClick={() => removeComment(c.id)}
                            aria-label="Supprimer le commentaire"
                            className="flex items-center gap-1 text-[12px] text-[var(--text-muted)] rounded-full border-none bg-transparent cursor-pointer px-2 py-0.5 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="m-0 mt-0.5 text-[14px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words">
                      <PostText text={c.text} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {replyTo && (
          <div className="flex items-center gap-2 px-4 pt-2.5">
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] bg-[var(--bg-input)] border border-[var(--border)] rounded-full px-3 py-1.5">
              <Reply size={12} className="text-brand" />
              <span>
                Réponse à{' '}
                <span className="font-bold text-brand">{replyTo.handle || replyTo.pseudo || 'commentaire'}</span>
              </span>
              <button
                type="button"
                onClick={clearReply}
                aria-label="Annuler la réponse"
                className="ml-1 flex items-center justify-center w-4 h-4 rounded-full border-none bg-transparent cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {cap.required && <div className="px-4 pt-2.5 flex justify-center">{cap.widget}</div>}

        <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border)] flex-shrink-0">
          <div className="relative flex-1 min-w-0">
            <input
              ref={commentInputRef}
              type="text"
              value={text}
              onChange={(e) => {
                const value = e.target.value;
                setText(value);
                mention.handleChange(value, e.target.selectionStart ?? value.length);
              }}
              onKeyDown={(e) => {
                if (mention.handleKeyDown(e)) return;
                if (e.key === 'Enter') submitComment();
              }}
              placeholder="Répondre..."
              maxLength={280}
              aria-label="Répondre au post"
              className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-full px-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--brand)] font-sans transition-colors"
            />
            <MentionSuggestions
              open={mention.open}
              query={mention.query}
              results={mention.results}
              activeIndex={mention.activeIndex}
              onSelect={mention.selectActive}
            />
          </div>
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
      {reportOpen && <ReportPostModal postId={post.id} onClose={() => setReportOpen(false)} />}
      {shareOpen && <SharePostModal post={post} onClose={() => setShareOpen(false)} />}
    </IonModal>
  );
}
