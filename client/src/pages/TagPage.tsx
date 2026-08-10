import { ChevronLeft, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LeftNav from '../components/Home/LeftNav';
import PostCard from '../components/Home/PostCard';
import PostModal from '../components/Home/PostModal';
import RightSidebar from '../components/Home/RightSidebar';
import { posts as postsAPI } from '../services/api';
import type { FeedItem, SocialPost } from '../types';

export default function TagPage() {
  const { tag = '' } = useParams<{ tag: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const selectedPost = items.find((i) => i.post.id === selectedPostId)?.post || null;

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await postsAPI.list(1, 50, undefined, tag));
    } catch (e) {
      console.error(e);
      setError((e as Error).message || 'Impossible de charger les posts');
    } finally {
      setLoading(false);
    }
  }, [tag]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const updatePost = useCallback((id: string, fn: (p: SocialPost) => SocialPost) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.post.id === id);
      if (idx === -1) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx], post: fn(next[idx].post) };
      return next;
    });
  }, []);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const openPost = useCallback((p: SocialPost) => setSelectedPostId(p.id), []);

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
      const wasReposted = itemsRef.current.find((i) => i.post.id === id)?.post.reposted;
      updatePost(id, (p) => ({ ...p, reposted: !p.reposted, reposts: p.reposts + (p.reposted ? -1 : 1) }));
      try {
        const res = await postsAPI.repost(id);
        updatePost(id, (p) => ({ ...p, reposted: res.reposted, reposts: res.reposts }));
        if (res.reposted && res.item) {
          setItems((prev) => (prev.some((i) => i.key === res.item!.key) ? prev : [res.item!, ...prev]));
        } else if (!res.reposted) {
          setItems((prev) => prev.filter((i) => !(i.type === 'repost' && i.post.id === id)));
        }
      } catch (e) {
        console.error(e);
        updatePost(id, (p) => ({ ...p, reposted: !!wasReposted, reposts: p.reposts + (p.reposted ? -1 : 1) }));
      }
    },
    [updatePost],
  );

  const handleCommentDelta = useCallback(
    (id: string, delta: number) => {
      updatePost(id, (p) => ({ ...p, comments: Math.max(0, p.comments + delta) }));
    },
    [updatePost],
  );

  const handleVote = useCallback(
    async (id: string, option: number) => {
      updatePost(id, (p) =>
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
        const res = await postsAPI.vote(id, option);
        updatePost(id, (p) => ({ ...p, poll: res.poll }));
      } catch (e) {
        console.error(e);
      }
    },
    [updatePost],
  );

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="flex h-full">
      <LeftNav />
      <main className="flex-1 min-w-0 h-full overflow-y-auto border-x border-[var(--border)] bg-[var(--bg-deep)]">
        <header className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-[12px] border-b border-[var(--border)]">
          <div className="flex items-center gap-5 px-2 h-14">
            <button
              type="button"
              onClick={goBack}
              aria-label="Retour"
              className="w-9 h-9 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0">
              <div className="font-extrabold text-[17px] text-[var(--text-primary)] leading-tight truncate">#{tag}</div>
              <div className="text-[12px] text-[var(--text-muted)]">{items.length} posts</div>
            </div>
          </div>
        </header>

        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
          <TrendingUp size={16} className="text-brand" />
          <span className="text-[13px] text-[var(--text-muted)]">Tendances · #{tag}</span>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="spinner" />
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
        ) : items.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="text-4xl mb-3" aria-hidden="true">
              🐺
            </div>
            <p className="m-0 text-[var(--text-secondary)]">
              Aucun post avec <span className="text-brand font-bold">#{tag}</span> pour le moment.{' '}
              <Link to="/" className="text-brand hover:underline">
                Publie le premier
              </Link>{' '}
              !
            </p>
          </div>
        ) : (
          items.map((item) => (
            <PostCard
              key={item.key}
              post={item.post}
              repostInfo={item.repost}
              onLike={handleLike}
              onRepost={handleRepost}
              onVote={handleVote}
              onOpen={openPost}
            />
          ))
        )}
      </main>
      <RightSidebar />
      {selectedPost && (
        <PostModal
          post={selectedPost}
          onClose={() => setSelectedPostId(null)}
          onLike={handleLike}
          onRepost={handleRepost}
          onVote={handleVote}
          onCommentDelta={handleCommentDelta}
        />
      )}
    </div>
  );
}
