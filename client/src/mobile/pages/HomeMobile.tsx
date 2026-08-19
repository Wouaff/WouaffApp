import {
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonLabel,
  IonSegment,
  IonSegmentButton,
} from '@ionic/react';
import { paw } from 'ionicons/icons';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Toast from '../../components/Common/Toast';
import ComposeBox from '../../components/Home/ComposeBox';
import OnboardingController from '../../components/Home/OnboardingController';
import PostCard from '../../components/Home/PostCard';
import PostModal from '../../components/Home/PostModal';
import { useAuth } from '../../hooks/useAuth';
import { posts as postsAPI } from '../../services/api';
import {
  offPostComment,
  offPostDeleted,
  offPostNew,
  offPostReacted,
  offPostRepost,
  offPostReposted,
  offPostUnrepost,
  onPostComment,
  onPostDeleted,
  onPostNew,
  onPostReacted,
  onPostRepost,
  onPostReposted,
  onPostUnrepost,
} from '../../services/socket';
import type { FeedItem, PostComment, PostReaction, SocialPost } from '../../types';
import MobilePage from '../MobilePage';
import { MobileEmpty, MobileError, MobileSkeleton } from '../MobileState';
import SearchButton from '../SearchButton';

type FeedTab = 'forYou' | 'following';

function toPostItem(post: SocialPost): FeedItem {
  return { type: 'post', key: `post:${post.id}`, post };
}

export default function HomeMobile() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<FeedTab>('forYou');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);

  const selectedPost = items.find((i) => i.post.id === selectedPostId)?.post || null;

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const feed = tab === 'following' ? 'following' : 'forYou';
      const data = await postsAPI.list(1, 20, undefined, undefined, feed);
      setItems(data);
      setPage(1);
      setHasMore(data.length > 0);
    } catch (e) {
      setError((e as Error).message || 'Impossible de charger le fil');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const feed = tab === 'following' ? 'following' : 'forYou';
      const next = page + 1;
      const data = await postsAPI.list(next, 20, undefined, undefined, feed);
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.key));
        return [...prev, ...data.filter((i) => !seen.has(i.key))];
      });
      setPage(next);
      setHasMore(data.length > 0);
    } catch {
      /* silencieux — on pourra réessayer au prochain scroll */
    } finally {
      setLoadingMore(false);
    }
  }, [page, hasMore, loadingMore, tab]);

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
        .catch(() => {})
        .finally(() => setPendingPostId(null));
    }
  }, [pendingPostId, items]);

  useEffect(() => {
    if (!user) return;
    const handleNew = (post: SocialPost) => {
      setItems((prev) => (prev.some((i) => i.key === toPostItem(post).key) ? prev : [toPostItem(post), ...prev]));
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
      setItems((prev) =>
        prev.map((i) =>
          i.post.id === data.postId ? { ...i, post: { ...i.post, likes: data.total, reactions: data.reactions } } : i,
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
    onPostReacted(handleReacted);
    onPostReposted(handleReposted);
    onPostComment(handleComment);
    onPostDeleted(handleDeleted);
    onPostRepost(handleRepost);
    onPostUnrepost(handleUnrepost);
    return () => {
      offPostNew(handleNew);
      offPostReacted(handleReacted);
      offPostReposted(handleReposted);
      offPostComment(handleComment);
      offPostDeleted(handleDeleted);
      offPostRepost(handleRepost);
      offPostUnrepost(handleUnrepost);
    };
  }, [user]);

  const handlePost = useCallback(async (text: string, image?: string, audio?: string, audioDuration?: number) => {
    try {
      const post = await postsAPI.create(text, image, audio, audioDuration);
      const item = toPostItem(post);
      setItems((prev) => (prev.some((i) => i.key === item.key) ? prev : [item, ...prev]));
    } catch {
      /* toast géré par ComposeBox */
    }
  }, []);

  const updatePost = useCallback((id: string, fn: (p: SocialPost) => SocialPost) => {
    setItems((prev) => prev.map((i) => (i.post.id === id ? { ...i, post: fn(i.post) } : i)));
  }, []);

  const handleReact = useCallback(
    async (id: string, type: string) => {
      const was = items.find((i) => i.post.id === id)?.post.myReaction ?? null;
      const delta = was ? (was === type ? -1 : 0) : 1;
      updatePost(id, (p) => ({
        ...p,
        myReaction: was === type ? null : type,
        likes: Math.max(0, p.likes + delta),
      }));
      try {
        const res = await postsAPI.react(id, type);
        updatePost(id, (p) => ({ ...p, myReaction: res.reaction, likes: res.total, reactions: res.reactions }));
      } catch {
        /* ignore */
      }
    },
    [updatePost, items],
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
      } catch {
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

  const handleVote = useCallback(
    async (id: string, option: number) => {
      updatePost(id, (p) => ({ ...p, poll: { ...p.poll, votedIndex: option } as SocialPost['poll'] }));
      try {
        const res = await postsAPI.vote(id, option);
        updatePost(id, (p) => ({ ...p, poll: res.poll as SocialPost['poll'] }));
      } catch {
        /* ignore */
      }
    },
    [updatePost],
  );

  return (
    <MobilePage title="Accueil" onRefresh={loadPosts} rightSlot={<SearchButton />}>
      <div className="px-4 pt-3">
        <IonSegment value={tab} onIonChange={(e) => setTab((e.detail.value as FeedTab) || 'forYou')} color="primary">
          <IonSegmentButton value="forYou">
            <IonLabel>Pour toi</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="following">
            <IonLabel>Abonnements</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </div>

      <div className="mt-2">
        <ComposeBox onPost={handlePost} />
      </div>

      {loading ? (
        <MobileSkeleton count={5} />
      ) : error ? (
        <MobileError message={error} onRetry={loadPosts} />
      ) : items.length === 0 ? (
        <MobileEmpty
          icon={<IonIcon icon={paw} />}
          title={tab === 'following' ? 'Ton fil est vide' : 'Aucun post pour le moment'}
          text={
            tab === 'following'
              ? 'Suis des comptes pour voir leurs posts ici.'
              : 'Sois le premier à publier quelque chose.'
          }
        />
      ) : (
        items.map((item) => (
          <PostCard
            key={item.key}
            post={item.post}
            repostInfo={item.repost}
            onReact={handleReact}
            onRepost={handleRepost}
            onVote={handleVote}
            onOpen={(p) => setSelectedPostId(p.id)}
          />
        ))
      )}

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

      <IonInfiniteScroll
        threshold="100px"
        disabled={!hasMore}
        onIonInfinite={async (e) => {
          await loadMore();
          e.target.complete();
        }}
      >
        <IonInfiniteScrollContent loadingSpinner="crescent" loadingText="Chargement..." />
      </IonInfiniteScroll>

      <Toast />
      <OnboardingController />
    </MobilePage>
  );
}
