import { Inbox } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { showToast, default as Toast } from '../components/Common/Toast';
import BuyMeACoffee from '../components/Home/BuyMeACoffee';
import ComposeBox from '../components/Home/ComposeBox';
import LeftNav from '../components/Home/LeftNav';
import OnboardingController from '../components/Home/OnboardingController';
import PostCard from '../components/Home/PostCard';
import PostModal from '../components/Home/PostModal';
import RightSidebar from '../components/Home/RightSidebar';
import WelcomeIntro from '../components/Home/WelcomeIntro';
import { useAuth } from '../hooks/useAuth';
import { posts as postsAPI } from '../services/api';
import {
  offPostComment,
  offPostDeleted,
  offPostNew,
  offPostPoll,
  offPostReacted,
  offPostRepost,
  offPostReposted,
  offPostUnrepost,
  onPostComment,
  onPostDeleted,
  onPostNew,
  onPostPoll,
  onPostReacted,
  onPostRepost,
  onPostReposted,
  onPostUnrepost,
} from '../services/socket';
import type { FeedItem, PostComment, PostPoll, PostReaction, SocialPost } from '../types';

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
  const [introOpen, setIntroOpen] = useState(() => !localStorage.getItem('wouaff_intro_seen'));

  const closeIntro = useCallback(() => {
    localStorage.setItem('wouaff_intro_seen', '1');
    setIntroOpen(false);
  }, []);

  const selectedPost = items.find((i) => i.post.id === selectedPostId)?.post || null;

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const feed = tab === 'following' ? 'following' : 'forYou';
      const data = await postsAPI.list(1, 50, undefined, undefined, feed);
      setItems(data);
    } catch (e) {
      console.error(e);
      setError((e as Error).message || 'Impossible de charger le fil');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  /* Mise à jour ciblée : seul l'item concerné change d'identité → les PostCard memoïsés
     des autres items ne re-rendent pas. */
  const updateItem = useCallback((id: string, fn: (item: FeedItem) => FeedItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.post.id === id);
      if (idx === -1) return prev;
      const next = prev.slice();
      next[idx] = fn(next[idx]);
      return next;
    });
  }, []);

  const updatePost = useCallback(
    (id: string, fn: (p: SocialPost) => SocialPost) => {
      updateItem(id, (item) => ({ ...item, post: fn(item.post) }));
    },
    [updateItem],
  );

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const openPost = useCallback((p: SocialPost) => setSelectedPostId(p.id), []);

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
    const handleReacted = (data: {
      postId: string;
      uid: string;
      type: string;
      reaction: string | null;
      reactions: PostReaction[];
      total: number;
    }) => {
      if (data.uid === user.uid) return;
      updateItem(data.postId, (i) => ({
        ...i,
        post: {
          ...i.post,
          likes: data.total,
          reactions: data.reactions,
          myReaction: data.uid === user.uid ? data.reaction : i.post.myReaction,
        },
      }));
    };
    const handleReposted = (data: { postId: string; uid: string; reposted: boolean; reposts: number }) => {
      if (data.uid === user.uid) return;
      updateItem(data.postId, (i) => ({ ...i, post: { ...i.post, reposted: data.reposted, reposts: data.reposts } }));
    };
    const handleComment = (data: { postId: string; comment: PostComment }) => {
      if (data.comment.uid === user.uid) return;
      updateItem(data.postId, (i) => ({ ...i, post: { ...i.post, comments: i.post.comments + 1 } }));
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
    const handlePoll = (data: { postId: string; poll: PostPoll }) => {
      updateItem(data.postId, (i) => ({ ...i, post: { ...i.post, poll: data.poll } }));
    };
    onPostNew(handleNew);
    onPostReacted(handleReacted);
    onPostReposted(handleReposted);
    onPostComment(handleComment);
    onPostDeleted(handleDeleted);
    onPostRepost(handleRepost);
    onPostUnrepost(handleUnrepost);
    onPostPoll(handlePoll);
    return () => {
      offPostNew(handleNew);
      offPostReacted(handleReacted);
      offPostReposted(handleReposted);
      offPostComment(handleComment);
      offPostDeleted(handleDeleted);
      offPostRepost(handleRepost);
      offPostUnrepost(handleUnrepost);
      offPostPoll(handlePoll);
    };
  }, [user, updateItem]);

  const handlePost = useCallback(
    async (
      text: string,
      image?: string,
      audio?: string,
      audioDuration?: number,
      poll?: { question?: string; options: string[] },
      capToken?: string,
    ) => {
      try {
        const post = await postsAPI.create(text, image, audio, audioDuration, poll, capToken);
        setItems((prev) => {
          const item = toPostItem(post);
          return prev.some((i) => i.key === item.key) ? prev : [item, ...prev];
        });
        showToast('Post publié !');
      } catch (e) {
        showToast((e as Error).message || 'Erreur lors de la publication', 'error');
      }
    },
    [],
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
                votes: p.poll.votes.map((v, i) => {
                  if (i === p.poll?.votedIndex) return Math.max(0, v - 1);
                  if (i === option) return v + 1;
                  return v;
                }),
                total: p.poll.votedIndex === null ? p.poll.total + 1 : p.poll.total,
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

  const handleReact = useCallback(
    async (id: string, type: string) => {
      const current = itemsRef.current.find((i) => i.post.id === id)?.post;
      const was = current?.myReaction ?? null;
      const delta = was ? (was === type ? -1 : 0) : 1;
      updatePost(id, (p) => ({
        ...p,
        myReaction: was === type ? null : type,
        likes: Math.max(0, p.likes + delta),
      }));
      try {
        const res = await postsAPI.react(id, type);
        updatePost(id, (p) => ({
          ...p,
          myReaction: res.reaction,
          likes: res.total,
          reactions: res.reactions,
        }));
      } catch (e) {
        console.error(e);
        updatePost(id, (p) => ({ ...p, myReaction: was, likes: p.likes - delta }));
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
          setItems((prev) =>
            prev.filter((i) => !(i.type === 'repost' && i.repost?.uid === user?.uid && i.post.id === id)),
          );
        }
      } catch (e) {
        console.error(e);
        updatePost(id, (p) => ({ ...p, reposted: !!wasReposted, reposts: p.reposts + (p.reposted ? -1 : 1) }));
      }
    },
    [updatePost, user],
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
          <div className="w-full max-w-[600px] mx-auto flex">
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
                <span className={tab === t.id ? 'text-md font-extrabold' : 'text-md font-medium'}>{t.label}</span>
                {tab === t.id && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-brand rounded-full" />
                )}
              </button>
            ))}
          </div>
        </header>

        <div className="w-full max-w-[600px] mx-auto">
          <ComposeBox onPost={handlePost} />
          <BuyMeACoffee />

          {loading ? (
            <div className="py-16 px-6 flex flex-col items-center gap-3">
              <div className="spinner" />
              <p className="m-0 text-sm text-[var(--text-muted)]">Chargement du fil...</p>
            </div>
          ) : error ? (
            <div className="py-16 px-6 text-center">
              <p className="m-0 text-[var(--text-secondary)]">{error}</p>
              <button type="button" onClick={loadPosts} className="mt-4 btn btn-primary btn-pill text-sm px-6 py-2.5">
                Réessayer
              </button>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className="text-4xl mb-3 text-brand" aria-hidden="true">
                <Inbox size={36} />
              </div>
              <p className="m-0 text-[var(--text-secondary)]">
                {tab === 'following'
                  ? 'Aucun post de vos abonnements pour le moment. Suis des comptes pour voir leurs posts ici !'
                  : 'Aucun post pour le moment. Publie le premier pour lancer la conversation !'}
              </p>
            </div>
          ) : (
            visibleItems.map((item) => (
              <PostCard
                key={item.key}
                post={item.post}
                repostInfo={item.repost}
                onReact={handleReact}
                onRepost={handleRepost}
                onVote={handleVote}
                onOpen={openPost}
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
          onReact={handleReact}
          onRepost={handleRepost}
          onVote={handleVote}
          onCommentDelta={handleCommentDelta}
        />
      )}
      <Toast />
      {introOpen && <WelcomeIntro onDone={closeIntro} />}
      <OnboardingController />
    </div>
  );
}
