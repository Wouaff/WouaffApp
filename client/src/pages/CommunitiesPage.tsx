import { Compass, Plus, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../components/Common/Toast';
import CommunityCreateModal from '../components/Home/CommunityCreateModal';
import CommunityPostCard from '../components/Home/CommunityPostCard';
import CommunityPostModal from '../components/Home/CommunityPostModal';
import LeftNav from '../components/Home/LeftNav';
import OnboardingModal from '../components/Home/OnboardingModal';
import { communities as communitiesAPI } from '../services/api';
import type { Community, CommunityPost } from '../types';

const FEED_LIMIT = 20;

export default function CommunitiesPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [mine, setMine] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('wouaff_onboarding_done'));
  const sentinelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  const loadMine = useCallback(async () => {
    try {
      setMine(await communitiesAPI.mine());
    } catch {
      /* silencieux */
    }
  }, []);

  const loadFeed = useCallback(async (offset: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await communitiesAPI.homeFeed('new', 'week', offset, FEED_LIMIT);
      setPosts((prev) => (offset === 0 ? data.items : [...prev, ...data.items]));
      setHasMore(data.hasMore);
      offsetRef.current = offset + data.items.length;
    } catch {
      showToast('Impossible de charger le fil', 'error');
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadMine();
    loadFeed(0);
  }, [loadMine, loadFeed]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          setLoadingMore(true);
          loadFeed(offsetRef.current);
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadFeed]);

  const updatePost = useCallback((id: string, fn: (p: CommunityPost) => CommunityPost) => {
    setPosts((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const next = prev.slice();
      next[idx] = fn(next[idx]);
      return next;
    });
  }, []);

  const applyVote = useCallback(
    (p: CommunityPost, value: -1 | 0 | 1): CommunityPost => ({
      ...p,
      vote: value,
      score: p.score + (value === p.vote ? 0 : value - p.vote),
      upvotes: p.upvotes + (value === 1 ? (p.vote === 1 ? -1 : 1) : p.vote === 1 ? -1 : 0),
      downvotes: p.downvotes + (value === -1 ? (p.vote === -1 ? -1 : 1) : p.vote === -1 ? -1 : 0),
    }),
    [],
  );

  const handleVote = useCallback(
    async (post: CommunityPost, value: -1 | 0 | 1) => {
      const previous = post.vote;
      setPosts((prev) => prev.map((p) => (p.id === post.id ? applyVote(p, value) : p)));
      setSelectedPost((cur) => (cur?.id === post.id ? applyVote(cur, value) : cur));
      try {
        const res = await communitiesAPI.vote(post.communityName, post.id, value);
        const sync = (p: CommunityPost): CommunityPost => ({
          ...p,
          vote: res.vote,
          upvotes: res.upvotes,
          downvotes: res.downvotes,
        });
        setPosts((prev) => prev.map((p) => (p.id === post.id ? sync(p) : p)));
        setSelectedPost((cur) => (cur?.id === post.id ? sync(cur) : cur));
      } catch (err) {
        const revert = (p: CommunityPost): CommunityPost => ({ ...p, vote: previous });
        setPosts((prev) => prev.map((p) => (p.id === post.id ? revert(p) : p)));
        setSelectedPost((cur) => (cur?.id === post.id ? revert(cur) : cur));
        showToast((err as Error).message || 'Erreur lors du vote', 'error');
      }
    },
    [applyVote],
  );

  const handleDeleted = useCallback((post: CommunityPost) => {
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    setSelectedPost((cur) => (cur?.id === post.id ? null : cur));
  }, []);

  const handlePinned = useCallback(
    (post: CommunityPost) => {
      updatePost(post.id, (p) => ({ ...p, isPinned: !p.isPinned }));
    },
    [updatePost],
  );

  const myRoleByCommunity = useMemo(() => {
    const map = new Map<string, Community['myRole']>();
    for (const c of mine) map.set(c.name, c.myRole);
    return map;
  }, [mine]);

  const onboardDone = useCallback(() => {
    localStorage.setItem('wouaff_onboarding_done', '1');
    setShowOnboarding(false);
    loadMine();
    loadFeed(0);
  }, [loadMine, loadFeed]);

  return (
    <div className="flex h-full">
      <LeftNav />
      <main className="flex-1 min-w-0 h-full overflow-y-auto border-x border-[var(--border)] bg-[var(--bg-deep)]">
        <header className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-[12px] border-b border-[var(--border)]">
          <div className="flex items-center px-4 h-14">
            <h1 className="text-xl font-extrabold m-0 text-[var(--text-primary)]">Communautés</h1>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="ml-auto flex items-center gap-1.5 bg-brand hover:opacity-90 transition-opacity text-white font-bold text-sm rounded-full px-4 py-2 border-none cursor-pointer"
            >
              <Plus size={16} /> Créer
            </button>
          </div>
          <div className="px-4 pb-3 text-[13px] text-[var(--text-muted)]">
            Ton fil = les posts de tes communautés, en ordre chronologique. Aucun algorithme.
          </div>
        </header>

        {loading ? (
          <div className="py-16 px-6 flex flex-col items-center gap-3">
            <div className="spinner" />
            <p className="m-0 text-sm text-[var(--text-muted)]">Chargement du fil...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 px-6 text-center flex flex-col items-center gap-3">
            <span className="w-16 h-16 rounded-full bg-[var(--brand-glow)] flex items-center justify-center">
              <Users size={30} className="text-brand" />
            </span>
            <p className="m-0 text-[15px] font-bold text-[var(--text-primary)]">Ton fil communautaire est vide</p>
            <p className="m-0 text-[13px] text-[var(--text-secondary)] max-w-[380px]">
              Abonne-toi à des communautés pour voir leurs posts ici.
            </p>
            <button
              type="button"
              onClick={() => navigate('/discover')}
              className="mt-2 bg-brand hover:opacity-90 transition-opacity text-white font-bold text-sm rounded-full px-6 py-2.5 border-none cursor-pointer"
            >
              Découvrir des communautés
            </button>
          </div>
        ) : (
          posts.map((post) => (
            <CommunityPostCard
              key={post.id}
              post={post}
              showCommunity
              myRole={myRoleByCommunity.get(post.communityName) ?? null}
              onOpen={setSelectedPost}
              onVote={handleVote}
              onDelete={handleDeleted}
              onPin={handlePinned}
            />
          ))
        )}

        <div ref={sentinelRef} className="py-4">
          {loadingMore && (
            <div className="flex justify-center">
              <div className="spinner" />
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <p className="m-0 text-center text-[12px] text-[var(--text-muted)] pb-4">Fin du fil</p>
          )}
        </div>
      </main>

      <aside className="hidden xl:flex flex-col w-[320px] flex-shrink-0 h-full border-l border-[var(--border)] bg-[var(--bg-base)] overflow-y-auto">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="m-0 text-[15px] font-extrabold text-[var(--text-primary)]">Mes communautés</h2>
          <button
            type="button"
            onClick={() => navigate('/discover')}
            className="flex items-center gap-1 text-[12px] font-bold text-brand rounded-full border-none bg-transparent cursor-pointer px-2 py-1 hover:bg-[var(--brand-glow)] transition-colors"
          >
            <Compass size={14} /> Découvrir
          </button>
        </div>
        {mine.length === 0 ? (
          <p className="m-0 px-4 py-3 text-[13px] text-[var(--text-muted)]">
            Aucune communauté suivie. Découvre-en de nouvelles !
          </p>
        ) : (
          mine.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(`/r/${c.name}`)}
              className="flex items-center gap-2.5 mx-2 mb-1 px-2.5 py-2 rounded-xl text-left cursor-pointer border-none bg-transparent hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-sm overflow-hidden flex-shrink-0">
                {c.avatar ? (
                  <img src={c.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{(c.displayName || c.name)[0]?.toUpperCase() || 'r'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-[var(--text-primary)] truncate">r/{c.name}</div>
                <div className="text-[12px] text-[var(--text-muted)] truncate">{c.memberCount} membres</div>
              </div>
            </button>
          ))
        )}
      </aside>

      {showCreate && <CommunityCreateModal onClose={() => setShowCreate(false)} onCreated={() => loadMine()} />}
      {selectedPost && (
        <CommunityPostModal
          post={selectedPost}
          myRole={myRoleByCommunity.get(selectedPost.communityName) ?? null}
          onClose={() => setSelectedPost(null)}
          onVote={handleVote}
          onDeleted={handleDeleted}
          onPinned={handlePinned}
        />
      )}
      {showOnboarding && <OnboardingModal onDone={onboardDone} />}
    </div>
  );
}
