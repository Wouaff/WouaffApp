import { useCallback, useEffect, useState } from 'react';
import ComposeBox from '../components/ComposeBox';
import ComposeModal from '../components/ComposeModal';
import PostCard, { type Post } from '../components/PostCard';
import RightSidebar from '../components/RightSidebar';
import Sidebar from '../components/Sidebar';
import { api } from '../services/api';

const TABS = ['For you', 'Following', 'News', 'Sports', 'Entertainment', 'Technology'] as const;

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<string>('For you');
  const [showCompose, setShowCompose] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    try {
      const tabParam = tab === 'For you' ? 'for-you' : tab.toLowerCase().replace(/\s/g, '-');
      const data = await api.get<Post[]>(`/posts/feed?tab=${tabParam}`);
      setPosts(data);
    } catch {}
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDelete = (id: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="flex min-h-screen justify-center pb-16 md:pb-0">
      <Sidebar onCompose={() => setShowCompose(true)} />

      <main className="flex-1 min-w-0 border-r border-[var(--border-color)] max-w-[600px] bg-[var(--bg-secondary)]">
        <div className="sticky top-0 z-40 bg-[var(--bg-secondary)]/80 backdrop-blur-md border-b border-[var(--border-color)]">
          <h1 className="sr-only">Feed</h1>
          <div className="flex items-center gap-2 px-3 py-2.5 overflow-x-auto no-scrollbar">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
                  tab === t
                    ? 'bg-[var(--accent)] text-white font-bold'
                    : 'border border-[var(--border-color)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <ComposeBox onTweet={fetchPosts} />

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">No posts yet</div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} onDelete={handleDelete} />)
        )}
      </main>

      <RightSidebar />

      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} onPosted={fetchPosts} />}
    </div>
  );
}
