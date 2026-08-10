import { useCallback, useMemo, useState } from 'react';
import ComposeBox from '../components/Home/ComposeBox';
import LeftNav from '../components/Home/LeftNav';
import PostCard from '../components/Home/PostCard';
import RightSidebar from '../components/Home/RightSidebar';
import { showToast, default as Toast } from '../components/Common/Toast';
import { MOCK_POSTS } from '../data/mockFeed';
import { useAuth } from '../hooks/useAuth';
import type { SocialPost } from '../types';

type FeedTab = 'forYou' | 'following';

export default function HomePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<FeedTab>('forYou');
  const [posts, setPosts] = useState<SocialPost[]>(MOCK_POSTS);

  const handlePost = useCallback(
    (text: string) => {
      const post: SocialPost = {
        id: `local-${Date.now()}`,
        pseudo: user?.pseudo || 'Vous',
        handle: '@vous',
        time: Date.now(),
        text,
        likes: 0,
        reposts: 0,
        comments: 0,
        liked: false,
        reposted: false,
      };
      setPosts((prev) => [post, ...prev]);
      showToast('✅ Post publié !');
    },
    [user],
  );

  const handleLike = useCallback((id: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p)),
    );
  }, []);

  const handleRepost = useCallback((id: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, reposted: !p.reposted, reposts: p.reposts + (p.reposted ? -1 : 1) } : p)),
    );
  }, []);

  const handleComment = useCallback((id: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, comments: p.comments + 1 } : p)));
  }, []);

  const visiblePosts = useMemo(() => (tab === 'following' ? posts.filter((p) => p.handle === '@wouaff_fr') : posts), [
    posts,
    tab,
  ]);

  const tabs: Array<{ id: FeedTab; label: string }> = [
    { id: 'forYou', label: 'Pour toi' },
    { id: 'following', label: 'Abonnements' },
  ];

  return (
    <div className="flex h-full justify-center">
      <LeftNav />
      <main className="w-full max-w-[600px] min-w-0 h-full overflow-y-auto border-x border-[var(--border)] bg-[var(--bg-deep)]">
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
                {tab === t.id && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-brand rounded-full" />}
              </button>
            ))}
          </div>
        </header>

        <ComposeBox onPost={handlePost} />

        {visiblePosts.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="text-4xl mb-3" aria-hidden="true">
              🐺
            </div>
            <p className="m-0 text-[var(--text-secondary)]">
              Aucun post pour le moment. Suis des comptes pour remplir ton fil.
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
