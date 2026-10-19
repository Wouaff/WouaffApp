import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import PostCard, { type Post, type PostUser } from '../components/PostCard';
import RichText from '../components/RichText';
import VerifiedBadge from '../components/VerifiedBadge';
import { useAuth } from '../hooks/useAuth';
import { timeAgo } from '../lib/time';
import { api, errorMessage } from '../services/api';

interface Comment {
  id: number;
  text: string;
  createdAt: string;
  user: PostUser;
}

export default function PostPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadComments = useCallback(async () => {
    try {
      setComments(await api.get<Comment[]>(`/posts/${id}/comments`));
    } catch {
      setComments([]);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    api
      .get<Post>(`/posts/${id}`)
      .then((p) => {
        if (cancelled) return;
        setPost(p);
        setStatus('ok');
        loadComments();
      })
      .catch(() => !cancelled && setStatus('missing'));
    return () => {
      cancelled = true;
    };
  }, [id, loadComments]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      await api.post(`/posts/${id}/comment`, { text: text.trim() });
      setText('');
      setPost((p) => (p ? { ...p, commentsCount: p.commentsCount + 1 } : p));
      await loadComments();
    } catch (err) {
      setError(errorMessage(err));
    }
    setSending(false);
  };

  const removeComment = async (commentId: number) => {
    if (!window.confirm('Supprimer ce commentaire ?')) return;
    try {
      await api.del(`/posts/${id}/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setPost((p) => (p ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AppShell>
      <PageHeader title="Post" back="/" />
      {status === 'loading' && (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      )}
      {status === 'missing' && (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          Ce post n'existe pas ou n'est plus disponible.
          <div className="mt-3">
            <Link to="/">Retour à l'accueil</Link>
          </div>
        </div>
      )}
      {status === 'ok' && post && (
        <>
          <PostCard post={post} linkToPost={false} onDelete={() => navigate('/')} onBlocked={() => navigate('/')} />

          <form onSubmit={send} className="flex gap-3 p-4 border-b border-[var(--border-color)]">
            <Avatar src={me?.avatar} name={me?.pseudo} />
            <div className="flex-1 min-w-0">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={280}
                rows={2}
                aria-label="Ton commentaire"
                placeholder="Poste ta réponse"
                className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none resize-none"
              />
              {error && (
                <p role="alert" className="text-sm text-[var(--danger)]">
                  {error}
                </p>
              )}
              <div className="flex items-center justify-end gap-3">
                <span className="text-sm text-[var(--text-secondary)]">{text.length} / 280</span>
                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-bold rounded-full px-5 py-2 text-sm"
                >
                  {sending ? '…' : 'Répondre'}
                </button>
              </div>
            </div>
          </form>

          {comments.length === 0 && (
            <p className="text-center py-10 text-[var(--text-secondary)]">Aucune réponse pour l'instant.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 px-4 py-3 border-b border-[var(--border-color)]">
              <Link to={`/${c.user.pseudo}`}>
                <Avatar src={c.user.avatar} name={c.user.pseudo} />
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Link
                    to={`/${c.user.pseudo}`}
                    className="font-bold text-[var(--text-primary)] truncate hover:underline"
                  >
                    {c.user.displayName || c.user.pseudo}
                  </Link>
                  {c.user.verified && <VerifiedBadge />}
                  <span className="text-sm text-[var(--text-secondary)] truncate">@{c.user.pseudo}</span>
                  <span className="text-sm text-[var(--text-secondary)]">· {timeAgo(c.createdAt)}</span>
                  {(me?.uid === c.user.uid || me?.uid === post.user.uid) && (
                    <button
                      type="button"
                      onClick={() => removeComment(c.id)}
                      aria-label="Supprimer le commentaire"
                      className="ml-auto p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[15px] text-[var(--text-primary)] whitespace-pre-wrap break-words mt-0.5">
                  <RichText text={c.text} />
                </p>
              </div>
            </div>
          ))}
        </>
      )}
    </AppShell>
  );
}
