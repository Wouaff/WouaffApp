import { ChevronLeft, Share2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LeftNav from '../components/Home/LeftNav';
import PostCard from '../components/Home/PostCard';
import RightSidebar from '../components/Home/RightSidebar';
import SharePostModal from '../components/Home/SharePostModal';
import { useAuth } from '../hooks/useAuth';
import { posts as postsAPI } from '../services/api';
import type { SocialPost } from '../types';

type PageState = 'loading' | 'error' | 'ready';

export default function PostPage() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const id = loc.pathname.match(/^\/post\/(.+)/)?.[1] || null;

  const [state, setState] = useState<PageState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [post, setPost] = useState<SocialPost | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!id) {
      setState('error');
      setErrorMsg('Aucun post spécifié.');
      return;
    }
    setState('loading');
    postsAPI
      .getPublic(id)
      .then((p) => {
        setPost(p);
        document.title = `${p.pseudo || 'Utilisateur'} sur Wouaff`;
        setState('ready');
      })
      .catch(() => {
        setState('error');
        setErrorMsg("Ce post n'existe pas ou a été supprimé.");
      });
  }, [id]);

  const requireAuth = useCallback((): boolean => {
    if (user) return true;
    navigate('/auth');
    return false;
  }, [user, navigate]);

  const updatePost = useCallback((fn: (p: SocialPost) => SocialPost) => {
    setPost((prev) => (prev ? fn(prev) : prev));
  }, []);

  const handleLike = useCallback(
    async (postId: string) => {
      if (!requireAuth()) return;
      setPost((prev) =>
        prev
          ? {
              ...prev,
              liked: !prev.liked,
              likes: prev.likes + (prev.liked ? -1 : 1),
            }
          : prev,
      );
      try {
        const res = await postsAPI.like(postId);
        updatePost((p) => ({ ...p, liked: res.liked, likes: res.likes }));
      } catch {
        /* ignore */
      }
    },
    [requireAuth, updatePost],
  );

  const handleRepost = useCallback(
    async (postId: string) => {
      if (!requireAuth()) return;
      setPost((prev) =>
        prev
          ? {
              ...prev,
              reposted: !prev.reposted,
              reposts: prev.reposts + (prev.reposted ? -1 : 1),
            }
          : prev,
      );
      try {
        const res = await postsAPI.repost(postId);
        updatePost((p) => ({ ...p, reposted: res.reposted, reposts: res.reposts }));
      } catch {
        /* ignore */
      }
    },
    [requireAuth, updatePost],
  );

  const handleVote = useCallback(
    async (postId: string, option: number) => {
      if (!requireAuth()) return;
      updatePost((p) =>
        p.poll
          ? {
              ...p,
              poll: {
                ...p.poll,
                votedIndex: option,
                votes: p.poll.votes.map((v, i) => v + (i === option ? 1 : 0)),
                total: p.poll.total + 1,
              },
            }
          : p,
      );
      try {
        const res = await postsAPI.vote(postId, option);
        updatePost((p) => ({ ...p, poll: res.poll }));
      } catch {
        /* ignore */
      }
    },
    [requireAuth, updatePost],
  );

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  if (state === 'loading') {
    return (
      <div className="flex h-full">
        <LeftNav />
        <main className="flex-1 min-w-0 h-full overflow-y-auto bg-[var(--bg-deep)]">
          <div className="h-full flex items-center justify-center">
            <div className="spinner" />
          </div>
        </main>
        <RightSidebar />
      </div>
    );
  }

  if (state === 'error' || !post) {
    return (
      <div className="flex h-full">
        <LeftNav />
        <main className="flex-1 min-w-0 h-full overflow-y-auto bg-[var(--bg-deep)]">
          <div className="h-full flex items-center justify-center px-4">
            <div className="text-center">
              <div className="text-6xl mb-3">🐺</div>
              <h1 className="text-2xl font-extrabold m-0 mb-1 text-[var(--text-primary)]">Post introuvable</h1>
              <p className="m-0 mb-5 text-[var(--text-secondary)]">{errorMsg}</p>
              <Link
                to="/"
                className="inline-block bg-brand hover:opacity-90 transition-opacity text-white font-bold text-sm rounded-full px-6 py-2.5 no-underline"
              >
                Retour à l'accueil
              </Link>
            </div>
          </div>
        </main>
        <RightSidebar />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <LeftNav />
      <main className="flex-1 min-w-0 h-full overflow-y-auto bg-[var(--bg-deep)]">
        <div className="mx-auto max-w-[600px] min-h-full border-x border-[var(--border)] bg-[var(--bg-base)]">
          <header className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-[12px] border-b border-[var(--border)]">
            <div className="flex items-center gap-3 px-2 h-14">
              <button
                type="button"
                onClick={goBack}
                aria-label="Retour"
                className="w-9 h-9 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-[17px] text-[var(--text-primary)] leading-tight truncate">Post</div>
              </div>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                aria-label="Partager ce post"
                className="w-9 h-9 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Share2 size={19} />
              </button>
            </div>
          </header>

          <PostCard post={post} onLike={handleLike} onRepost={handleRepost} onVote={handleVote} onOpen={() => setShareOpen(true)} />
        </div>
      </main>
      <RightSidebar />
      {shareOpen && <SharePostModal post={post} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
