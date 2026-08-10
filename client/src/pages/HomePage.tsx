import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { showToast, default as Toast } from '../components/Common/Toast';
import ComposeBox from '../components/Home/ComposeBox';
import LeftNav from '../components/Home/LeftNav';
import PostCard from '../components/Home/PostCard';
import PostModal from '../components/Home/PostModal';
import RightSidebar from '../components/Home/RightSidebar';
import { useAuth } from '../hooks/useAuth';
import { posts as postsAPI } from '../services/api';
import {
  offPostComment,
  offPostDeleted,
  offPostLiked,
  offPostNew,
  offPostRepost,
  offPostReposted,
  offPostUnrepost,
  onPostComment,
  onPostDeleted,
  onPostLiked,
  onPostNew,
  onPostRepost,
  onPostReposted,
  onPostUnrepost,
} from '../services/socket';
import type { FeedItem, PostComment, SocialPost } from '../types';

type FeedTab = 'forYou' | 'following';

function toPostItem(post: SocialPost): FeedItem {
  return { type: 'post', key: `post:${post.id}`, post };
}

export default function HomePage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<FeedTab>('forYou');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);

  const selectedPost = items.find((i) => i.post.id === selectedPostId)?.post || null;

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await postsAPI.list(1, 50);
      setItems(data);
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

  /* Ouverture d'un post depuis une notification (événement ou ?post=ID) */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const postId = params.get('post');
    if (postId) {
      setPendingPostId(postId);
      navigate(location.pathname, { replace: true });
    }
    const handler = (e: Event) => {
      const { postId: pid } = (e as CustomEvent<{ postId: string }>).detail;
      if (pid) setPendingPostId(pid);
    };
    window.addEventListener('wouaff:open-post', handler);
    return () => window.removeEventListener('wouaff:open-post', handler);
  }, [location.search, location.pathname, navigate]);

  useEffect(() => {
    if (!pendingPostId) return;
    if (items.some((i) => i.post.id === pendingPostId)) {
      setSelectedPostId(pendingPostId);
      setPendingPostId(null);
    } else {
      postsAPI
        .get(pendingPostId)
        .then((post) => {
          setItems((prev) => (prev.some((i) => i.post.id === post.id) ? prev : [toPostItem(post), ...prev]));
          setSelectedPostId(pendingPostId);
        })
        .catch((e) => console.error(e))
        .finally(() => setPendingPostId(null));
    }
  }, [pendingPostId, items]);

  useEffect(() => {
    if (!user) return;
    const handleNew = (post: SocialPost) => {
      const item = toPostItem(post);
      setItems((prev) => (prev.some((i) => i.key === item.key) ? prev : [item, ...prev]));
    };
    const handleLiked = (data: { postId: string; uid: string; liked: boolean; likes: number }) => {
      if (data.uid === user.uid) return;
      setItems((prev) =>
        prev.map((i) =>
          i.post.id === data.postId ? { ...i, post: { ...i.post, liked: data.liked, likes: data.likes } } : i,
        ),
      );
    };
    const handleReposted = (data: { postId: string; uid: string; reposted: boolean; reposts: number }) => {
      if (data.uid === user.uid) return;
      setItems((prev) =>
        prev.map((i) =>
          i.post.id === data.postId ? { ...i, post: { ...i.post, reposted: data.reposted, reposts: data.reposts } } : i,
        ),
      );
    };
    const handleComment = (data: { postId: string; comment: PostComment }) => {
      if (data.comment.uid === user.uid) return;
      setItems((prev) =>
        prev.map((i) => (i.post.id === data.postId ? { ...i, post: { ...i.post, comments: i.post.comments + 1 } } : i)),
      );
    };
    const handleDeleted = (data: { postId: string }) => {
      setItems((prev) => prev.filter((i) => i.post.id !== data.postId));
    };
    const handleRepost = (item: FeedItem) => {
      setItems((prev) => (prev.some((i) => i.key === item.key) ? prev : [item, ...prev]));
    };
    const handleUnrepost = (data: { postId: string; uid: string }) => {
      setItems((prev) =>
        prev.filter((i) => !(i.type === 'repost' && i.repost?.uid === data.uid && i.post.id === data.postId)),
      );
    };
    onPostNew(handleNew);
    onPostLiked(handleLiked);
    onPostReposted(handleReposted);
    onPostComment(handleComment);
    onPostDeleted(handleDeleted);
    onPostRepost(handleRepost);
    onPostUnrepost(handleUnrepost);
    return () => {
      offPostNew(handleNew);
      offPostLiked(handleLiked);
      offPostReposted(handleReposted);
      offPostComment(handleComment);
      offPostDeleted(handleDeleted);
      offPostRepost(handleRepost);
      offPostUnrepost(handleUnrepost);
    };
  }, [user]);

  const handlePost = useCallback(async (text: string, image?: string) => {
    try {
      const post = await postsAPI.create(text, image);
      setItems((prev) => {
        const item = toPostItem(post);
        return prev.some((i) => i.key === item.key) ? prev : [item, ...prev];
      });
      showToast('✅ Post publié !');
    } catch (e) {
      showToast((e as Error).message || 'Erreur lors de la publication', 'error');
    }
  }, []);

  const updatePost = useCallback((id: string, fn: (p: SocialPost) => SocialPost) => {
    setItems((prev) => prev.map((i) => (i.post.id === id ? { ...i, post: fn(i.post) } : i)));
  }, []);

  const handleLike = useCallback(
    async (id: string) => {
      updatePost(id, (p) => ({ ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }));
      try {
        const res = await postsAPI.like(id);
        updatePost(id, (p) => ({ ...p, liked: res.liked, likes: res.likes }));
      } catch (e) {
        console.error(e);
        updatePost(id, (p) => ({ ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }));
      }
    },
    [updatePost],
  );

  const handleRepost = useCallback(
    async (id: string) => {
      const wasReposted = items.find((i) => i.post.id === id)?.post.reposted;
      updatePost(id, (p) => ({ ...p, reposted: !p.reposted, reposts: p.reposts + (p.reposted ? -1 : 1) }));
      try {
        const res = await postsAPI.repost(id);
        updatePost(id, (p) => ({ ...p, reposted: res.reposted, reposts: res.reposts }));
        if (res.reposted && res.item) {
          setItems((prev) => (prev.some((i) => i.key === res.item!.key) ? prev : [res.item!, ...prev]));
        } else if (!res.reposted) {
          setItems((prev) =>
            prev.filter((i) => !(i.type === 'repost' && i.repost?.uid === user?.uid && i.post.id === id)),
          );
        }
      } catch (e) {
        console.error(e);
        updatePost(id, (p) => ({ ...p, reposted: !!wasReposted, reposts: p.reposts + (p.reposted ? -1 : 1) }));
      }
    },
    [updatePost, items, user],
  );

  const handleCommentDelta = useCallback(
    (id: string, delta: number) => {
      updatePost(id, (p) => ({ ...p, comments: Math.max(0, p.comments + delta) }));
    },
    [updatePost],
  );

  const visibleItems = useMemo(() => items, [items]);

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

        <div className="w-full max-w-[600px] mx-auto">
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
          ) : visibleItems.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className="text-4xl mb-3" aria-hidden="true">
                🐺
              </div>
              <p className="m-0 text-[var(--text-secondary)]">
                Aucun post pour le moment. Publie le premier pour lancer la conversation !
              </p>
            </div>
          ) : (
            visibleItems.map((item) => (
              <PostCard
                key={item.key}
                post={item.post}
                repostInfo={item.repost}
                onLike={handleLike}
                onRepost={handleRepost}
                onOpen={(p) => setSelectedPostId(p.id)}
              />
            ))
          )}
        </div>
      </main>
      <RightSidebar />
      {selectedPost && (
        <PostModal
          post={selectedPost}
          onClose={() => setSelectedPostId(null)}
          onLike={handleLike}
          onRepost={handleRepost}
          onCommentDelta={handleCommentDelta}
        />
      )}
      <Toast />
    </div>
  );
}
