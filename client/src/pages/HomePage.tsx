import { useCallback, useEffect, useMemo, useState } from 'react';
import { showToast, default as Toast } from '../components/Common/Toast';
import ComposeBox from '../components/Home/ComposeBox';
import LeftNav from '../components/Home/LeftNav';
import PostCard from '../components/Home/PostCard';
import RightSidebar from '../components/Home/RightSidebar';
import { useAuth } from '../hooks/useAuth';
import { posts as postsAPI } from '../services/api';
import {
  offPostComment,
  offPostDeleted,
  offPostLiked,
  offPostNew,
  offPostReposted,
  onPostComment,
  onPostDeleted,
  onPostLiked,
  onPostNew,
  onPostReposted,
} from '../services/socket';
import type { PostComment, SocialPost } from '../types';

type FeedTab = 'forYou' | 'following';

export default function HomePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<FeedTab>('forYou');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await postsAPI.list(1, 50);
      setPosts(data);
    } catch (e) {
      console.error(e);
      setError((e as Error).message || 'Impossible de charger le fil');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (!user) return;
    const handleNew = (post: SocialPost) => {
      setPosts((prev) => (prev.some((p) => p.id === post.id) ? prev : [post, ...prev]));
    };
    const handleLiked = (data: { postId: string; uid: string; liked: boolean; likes: number }) => {
      if (data.uid === user.uid) return;
      setPosts((prev) => prev.map((p) => (p.id === data.postId ? { ...p, liked: data.liked, likes: data.likes } : p)));
    };
    const handleReposted = (data: { postId: string; uid: string; reposted: boolean; reposts: number }) => {
      if (data.uid === user.uid) return;
      setPosts((prev) =>
        prev.map((p) => (p.id === data.postId ? { ...p, reposted: data.reposted, reposts: data.reposts } : p)),
      );
    };
    const handleComment = (data: { postId: string; comment: PostComment }) => {
      if (data.comment.uid === user.uid) return;
      setPosts((prev) => prev.map((p) => (p.id === data.postId ? { ...p, comments: p.comments + 1 } : p)));
    };
    const handleDeleted = (data: { postId: string }) => {
      setPosts((prev) => prev.filter((p) => p.id !== data.postId));
    };
    onPostNew(handleNew);
    onPostLiked(handleLiked);
    onPostReposted(handleReposted);
    onPostComment(handleComment);
    onPostDeleted(handleDeleted);
    return () => {
      offPostNew(handleNew);
      offPostLiked(handleLiked);
      offPostReposted(handleReposted);
      offPostComment(handleComment);
      offPostDeleted(handleDeleted);
    };
  }, [user]);

  const handlePost = useCallback(async (text: string) => {
    try {
      const post = await postsAPI.create(text);
      setPosts((prev) => (prev.some((p) => p.id === post.id) ? prev : [post, ...prev]));
      showToast('✅ Post publié !');
    } catch (e) {
      showToast((e as Error).message || 'Erreur lors de la publication', 'error');
    }
  }, []);

  const handleLike = useCallback(async (id: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p)),
    );
    try {
      const res = await postsAPI.like(id);
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, liked: res.liked, likes: res.likes } : p)));
    } catch (e) {
      console.error(e);
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p)),
      );
    }
  }, []);

  const handleRepost = useCallback(async (id: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, reposted: !p.reposted, reposts: p.reposts + (p.reposted ? -1 : 1) } : p)),
    );
    try {
      const res = await postsAPI.repost(id);
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, reposted: res.reposted, reposts: res.reposts } : p)));
    } catch (e) {
      console.error(e);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, reposted: !p.reposted, reposts: p.reposts + (p.reposted ? -1 : 1) } : p,
        ),
      );
    }
  }, []);

  const handleComment = useCallback(async (id: string, text: string) => {
    try {
      await postsAPI.addComment(id, text);
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, comments: p.comments + 1 } : p)));
      showToast('💬 Commentaire publié !');
    } catch (e) {
      showToast((e as Error).message || 'Erreur lors du commentaire', 'error');
    }
  }, []);

  const visiblePosts = useMemo(() => posts, [posts]);

  const tabs: Array<{ id: FeedTab; label: string }> = [
    { id: 'forYou', label: 'Pour toi' },
    { id: 'following', label: 'Abonnements' },
  ];

  return (
    <div className="flex h-full">
      <LeftNav />
      <main className="flex-1 min-w-0 h-full overflow-y-auto border-x border-[var(--border)] bg-[var(--bg-deep)]">
        <header className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-[12px] border-b border-[var(--border)]">
          <div className="flex items-center px-4 h-14">
            <h1 className="text-xl font-extrabold m-0 text-[var(--text-primary)]">Accueil</h1>
          </div>
          <div className="flex">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`relative flex-1 flex items-center justify-center py-3.5 border-none bg-transparent cursor-pointer transition-colors font-sans ${
                  tab === t.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <span className={tab === t.id ? 'text-[15px] font-extrabold' : 'text-[15px] font-medium'}>
                  {t.label}
                </span>
                {tab === t.id && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-brand rounded-full" />
                )}
              </button>
            ))}
          </div>
        </header>

        <ComposeBox onPost={handlePost} />

        {loading ? (
          <div className="py-16 px-6 flex flex-col items-center gap-3">
            <div className="spinner" />
            <p className="m-0 text-sm text-[var(--text-muted)]">Chargement du fil...</p>
          </div>
        ) : error ? (
          <div className="py-16 px-6 text-center">
            <p className="m-0 text-[var(--text-secondary)]">{error}</p>
            <button
              type="button"
              onClick={loadPosts}
              className="mt-4 bg-brand hover:opacity-90 transition-opacity text-white font-bold text-sm rounded-full px-6 py-2.5 border-none cursor-pointer"
            >
              Réessayer
            </button>
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="text-4xl mb-3" aria-hidden="true">
              🐺
            </div>
            <p className="m-0 text-[var(--text-secondary)]">
              Aucun post pour le moment. Publie le premier pour lancer la conversation !
            </p>
          </div>
        ) : (
          visiblePosts.map((post) => (
            <PostCard key={post.id} post={post} onLike={handleLike} onRepost={handleRepost} onComment={handleComment} />
          ))
        )}
      </main>
      <RightSidebar />
      <Toast />
    </div>
  );
}
