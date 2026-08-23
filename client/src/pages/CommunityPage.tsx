import { ArrowLeft, ChevronDown, Lock, PenSquare, Plus, Settings, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { showToast } from '../components/Common/Toast';
import CommunityEditModal from '../components/Home/CommunityEditModal';
import CommunityPostCard from '../components/Home/CommunityPostCard';
import CommunityPostModal from '../components/Home/CommunityPostModal';
import { communities as communitiesAPI } from '../services/api';
import type { Community, CommunityPost, CommunityTopWindow } from '../types';

const FEED_LIMIT = 20;

type Tab = 'new' | 'top' | 'hot';

export default function CommunityPage() {
  const { name = '', postId } = useParams<{ name: string; postId?: string }>();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [tab, setTab] = useState<Tab>('new');
  const [window, setWindow] = useState<CommunityTopWindow>('week');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  const loadCommunity = useCallback(async () => {
    try {
      const data = await communitiesAPI.get(name);
      setCommunity(data);
      setNotFound(false);
    } catch {
      setNotFound(true);
      setCommunity(null);
    }
  }, [name]);

  const loadFeed = useCallback(
    async (offset: number) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const data = await communitiesAPI.feed(name, tab, window, offset, FEED_LIMIT);
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
    },
    [name, tab, window],
  );

  useEffect(() => {
    loadCommunity();
    setPosts([]);
    setHasMore(true);
    setLoading(true);
    offsetRef.current = 0;
    loadFeed(0);
  }, [loadCommunity, loadFeed]);

  useEffect(() => {
    if (!postId) return;
    communitiesAPI
      .getPostDetail(name, postId)
      .then(setSelectedPost)
      .catch(() => showToast('Post introuvable', 'error'));
  }, [name, postId]);

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
    setCommunity((prev) => (prev ? { ...prev, postCount: Math.max(0, prev.postCount - 1) } : prev));
  }, []);

  const handlePinned = useCallback(
    (post: CommunityPost) => {
      updatePost(post.id, (p) => ({ ...p, isPinned: !p.isPinned }));
    },
    [updatePost],
  );

  const toggleSubscribe = async () => {
    if (!community || busy) return;
    setBusy(true);
    try {
      if (community.isSubscribed) {
        await communitiesAPI.unsubscribe(community.name);
        setCommunity({ ...community, isSubscribed: false, memberCount: Math.max(0, community.memberCount - 1) });
      } else {
        await communitiesAPI.subscribe(community.name);
        setCommunity({ ...community, isSubscribed: true, memberCount: community.memberCount + 1 });
      }
    } catch (err) {
      showToast((err as Error).message || 'Une erreur est survenue', 'error');
    } finally {
      setBusy(false);
    }
  };

  const isMod = community?.myRole === 'admin' || community?.myRole === 'moderator';

  const handlePosted = useCallback((post: CommunityPost) => {
    setPosts((prev) => [post, ...prev]);
    setCommunity((prev) => (prev ? { ...prev, postCount: prev.postCount + 1 } : prev));
    setShowComposer(false);
    setTab('new');
    showToast('Post publié 🎉', 'success');
  }, []);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'new', label: 'Nouveau' },
    { id: 'top', label: 'Top' },
    { id: 'hot', label: 'Chaud' },
  ];

  if (notFound) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center flex flex-col items-center gap-3 px-6">
          <span
            className="w-16 h-16 rounded-full bg-[var(--brand-glow)] flex items-center justify-center text-3xl"
            aria-hidden="true"
          >
            🐺
          </span>
          <h2 className="m-0 text-[18px] font-extrabold text-[var(--text-primary)]">c/{name} introuvable</h2>
          <p className="m-0 text-[13px] text-[var(--text-secondary)]">
            Cette communauté n'existe pas ou a été supprimée.
          </p>
          <button
            type="button"
            onClick={() => navigate('/communities')}
            className="mt-2 bg-brand hover:opacity-90 transition-opacity text-white font-bold text-sm rounded-full px-6 py-2.5 border-none cursor-pointer"
          >
            Retour aux communautés
          </button>
        </div>
      </div>
    );
  }

  const initial = ((community?.displayName || community?.name || 'r')[0] || 'r').toUpperCase();

  return (
    <div className="flex flex-col h-full">
      <header className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--bg-base)]">
        {community?.banner && (
          <div className="h-24 sm:h-32 overflow-hidden">
            <img
              src={community.banner}
              alt={`Bannière de c/${community.name}`}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/communities')}
              aria-label="Retour"
              className="w-8 h-8 rounded-full flex items-center justify-center border-none bg-transparent cursor-pointer text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-lg overflow-hidden">
              {community?.avatar ? (
                <img
                  src={community?.avatar}
                  alt={`Avatar de c/${community?.name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="m-0 text-[18px] font-extrabold text-[var(--text-primary)] truncate">c/{name}</h1>
                {community?.isPrivate && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-muted)] border border-[var(--border)] rounded-full px-2 py-0.5">
                    <Lock size={10} /> Privé
                  </span>
                )}
                {isMod && (
                  <span className="text-[10px] font-bold text-brand bg-[var(--brand-glow)] rounded-full px-2 py-0.5">
                    Modérateur
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
                <Users size={13} />
                <span>{community?.memberCount ?? 0} membres</span>
                <span>·</span>
                <span>{community?.postCount ?? 0} posts</span>
              </div>
            </div>
            {community?.myRole === 'admin' && (
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                aria-label="Modifier la communauté"
                className="w-9 h-9 rounded-full flex items-center justify-center border border-[var(--border)] bg-transparent cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Settings size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={toggleSubscribe}
              disabled={busy}
              className={`flex-shrink-0 font-bold text-[13px] rounded-full px-4 py-2 border cursor-pointer transition-colors disabled:opacity-50 ${
                community?.isSubscribed
                  ? 'bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--danger)] hover:text-[var(--danger)]'
                  : 'bg-brand hover:opacity-90 text-white border-transparent'
              }`}
            >
              {community?.isSubscribed ? 'Abonné' : "S'abonner"}
            </button>
          </div>
          {community?.description && (
            <p className="m-0 mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">{community.description}</p>
          )}
          {community && community.rules.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowRules((v) => !v)}
                className="flex items-center gap-1 text-[12px] font-bold text-[var(--text-muted)] rounded-full border-none bg-transparent cursor-pointer px-1 py-0.5 hover:text-[var(--text-primary)] transition-colors"
              >
                Règles ({community.rules.length})
                <ChevronDown size={13} className={`transition-transform ${showRules ? 'rotate-180' : ''}`} />
              </button>
              {showRules && (
                <ul className="m-0 mt-1.5 pl-4 pr-1 text-[12px] text-[var(--text-secondary)] flex flex-col gap-1 list-disc">
                  {community.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        <main className="flex-1 min-w-0 h-full overflow-y-auto bg-[var(--bg-deep)]">
          <div className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-[12px] border-b border-[var(--border)]">
            <div className="flex items-center px-4 h-12 gap-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? 'page' : undefined}
                  className={`px-3.5 py-1.5 rounded-full border-none bg-transparent cursor-pointer text-[14px] transition-colors ${
                    tab === t.id
                      ? 'font-extrabold text-[var(--text-primary)] bg-[var(--bg-input)]'
                      : 'font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              {tab === 'top' && (
                <div className="ml-auto flex items-center gap-1">
                  {(['day', 'week', 'month'] as CommunityTopWindow[]).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWindow(w)}
                      className={`px-3 py-1.5 rounded-full border-none bg-transparent cursor-pointer text-[13px] transition-colors ${
                        window === w
                          ? 'font-bold text-brand bg-[var(--brand-glow)]'
                          : 'font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {w === 'day' ? 'Jour' : w === 'week' ? 'Semaine' : 'Mois'}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowComposer(true)}
                className="ml-auto flex items-center gap-1.5 bg-brand hover:opacity-90 transition-opacity text-white font-bold text-[13px] rounded-full px-4 py-2 border-none cursor-pointer"
              >
                <Plus size={15} /> Publier
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-16 px-6 flex flex-col items-center gap-3">
              <div className="spinner" />
              <p className="m-0 text-sm text-[var(--text-muted)]">Chargement du fil...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="py-16 px-6 text-center flex flex-col items-center gap-3">
              <p className="m-0 text-[var(--text-secondary)]">Aucun post pour le moment. Sois le premier à publier !</p>
              <button
                type="button"
                onClick={() => setShowComposer(true)}
                className="mt-1 bg-brand hover:opacity-90 transition-opacity text-white font-bold text-sm rounded-full px-6 py-2.5 border-none cursor-pointer"
              >
                <PenSquare size={15} className="inline align-text-bottom mr-1" /> Publier un post
              </button>
            </div>
          ) : (
            posts.map((post) => (
              <CommunityPostCard
                key={post.id}
                post={post}
                myRole={community?.myRole ?? null}
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
      </div>

      {showEdit && community && (
        <CommunityEditModal
          community={community}
          onClose={() => setShowEdit(false)}
          onUpdated={(updated) => {
            setCommunity(updated);
            setShowEdit(false);
          }}
        />
      )}
      {showComposer && community && (
        <Composer community={community} onPosted={handlePosted} onClose={() => setShowComposer(false)} />
      )}
      {selectedPost && (
        <CommunityPostModal
          post={selectedPost}
          myRole={community?.myRole ?? null}
          onClose={() => setSelectedPost(null)}
          onVote={handleVote}
          onDeleted={handleDeleted}
          onPinned={handlePinned}
        />
      )}
    </div>
  );
}

/* ── Petit éditeur de post dans la communauté ── */
function Composer({
  community,
  onPosted,
  onClose,
}: {
  community: Community;
  onPosted: (post: CommunityPost) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'text' | 'link' | 'image'>('text');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!title.trim() || sending) {
      showToast('Un titre est requis', 'error');
      return;
    }
    if (type !== 'text' && !content.trim()) {
      showToast(type === 'link' ? 'Ajoute une URL' : 'Ajoute une image', 'error');
      return;
    }
    setSending(true);
    try {
      const post = await communitiesAPI.createPost(community.name, {
        title: title.trim(),
        content: content.trim() || undefined,
        type,
      });
      onPosted(post);
    } catch (err) {
      showToast((err as Error).message || 'Erreur lors de la publication', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="modal-overlay active"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex flex-col w-full max-w-[560px] rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center border-none bg-transparent cursor-pointer text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
            aria-label="Fermer"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="font-bold text-[var(--text-primary)] text-[16px]">Publier dans c/{community.name}</span>
        </div>
        <div className="px-4 py-4 flex flex-col gap-3">
          <div className="flex gap-2">
            {(['text', 'link', 'image'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-4 py-1.5 rounded-full border text-[13px] font-bold cursor-pointer transition-colors ${
                  type === t
                    ? 'bg-brand text-white border-transparent'
                    : 'bg-transparent border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t === 'text' ? 'Texte' : t === 'link' ? 'Lien' : 'Image'}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de ton post"
            maxLength={300}
            aria-label="Titre"
            className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--brand)] font-sans transition-colors"
          />
          {type === 'text' ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Contenu (Markdown, @mentions...)"
              maxLength={20000}
              rows={6}
              aria-label="Contenu"
              className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--brand)] font-sans resize-none transition-colors"
            />
          ) : (
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={type === 'link' ? 'https://...' : "URL de l'image ou data:image/..."}
              aria-label={type === 'link' ? 'URL du lien' : 'URL de l’image'}
              className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--brand)] font-sans transition-colors"
            />
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--border)] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border-none bg-transparent cursor-pointer text-[var(--text-secondary)] font-bold text-sm px-4 py-2 hover:bg-[var(--bg-hover)] transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="bg-brand hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-white font-bold text-sm rounded-full px-6 py-2.5 border-none cursor-pointer"
          >
            {sending ? 'Publication...' : 'Publier'}
          </button>
        </div>
      </div>
    </div>
  );
}
