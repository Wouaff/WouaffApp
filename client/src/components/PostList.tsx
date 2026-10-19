import { useEffect, useRef } from 'react';
import type { Post } from './PostCard';
import PostCard from './PostCard';

interface PostListProps {
  posts: Post[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  emptyText: string;
  onLoadMore: () => void;
  onDelete: (feedId: number) => void;
  onBlocked: (uid: string) => void;
  onRetry: () => void;
}

/** Liste de posts avec chargement infini, état vide et erreur. */
export default function PostList({
  posts,
  loading,
  loadingMore,
  hasMore,
  error,
  emptyText,
  onLoadMore,
  onDelete,
  onBlocked,
  onRetry,
}: PostListProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const loadRef = useRef(onLoadMore);
  loadRef.current = onLoadMore;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadRef.current(), {
      rootMargin: '400px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner" />
      </div>
    );
  }
  if (error && posts.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-secondary)]">
        <p className="mb-3">{error}</p>
        <button type="button" onClick={onRetry} className="font-bold text-[var(--accent)]">
          Réessayer
        </button>
      </div>
    );
  }
  if (posts.length === 0) {
    return <div className="text-center py-12 text-[var(--text-secondary)]">{emptyText}</div>;
  }
  return (
    <>
      {posts.map((post) => (
        <PostCard key={post.feedId} post={post} onDelete={onDelete} onBlocked={onBlocked} />
      ))}
      {hasMore && (
        <div ref={sentinel} className="flex justify-center py-6">
          {loadingMore ? <div className="spinner" /> : <span className="text-sm text-[var(--text-secondary)]">…</span>}
        </div>
      )}
    </>
  );
}
