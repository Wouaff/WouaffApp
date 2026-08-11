import { IonLabel, IonSegment, IonSegmentButton, IonSpinner, IonText } from '@ionic/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Toast from '../../components/Common/Toast';
import ComposeBox from '../../components/Home/ComposeBox';
import PostCard from '../../components/Home/PostCard';
import PostModal from '../../components/Home/PostModal';
import { useAuth } from '../../hooks/useAuth';
import { posts as postsAPI } from '../../services/api';
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
} from '../../services/socket';
import type { FeedItem, PostComment, SocialPost } from '../../types';
import MobilePage from '../MobilePage';

type FeedTab = 'forYou' | 'following';

function toPostItem(post: SocialPost): FeedItem {
  return { type: 'post', key: `post:${post.id}`, post };
}

export default function HomeMobile() {
  const { user } = useAuth();
  const [tab, setTab] = useState<FeedTab>('forYou');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const selectedPost = items.find((i) => i.post.id === selectedPostId)?.post || null;

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await postsAPI.list(1, 50);
      setItems(data);
    } catch (e) {
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
      setItems((prev) => (prev.some((i) => i.key === toPostItem(post).key) ? prev : [toPostItem(post), ...prev]));
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

  const handleLike = useCallback(
    async (id: string) => {
      updatePost(id, (p) => ({ ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }));
      try {
        const res = await postsAPI.like(id);
        updatePost(id, (p) => ({ ...p, liked: res.liked, likes: res.likes }));
      } catch {
        /* ignore */
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

  const visibleItems = useMemo(() => {
    if (tab === 'following') return items.filter((i) => i.type === 'repost' || i.repost);
    return items;
  }, [items, tab]);

  return (
    <MobilePage title="Accueil" onRefresh={loadPosts}>
      <div className="px-3 pt-1">
        <IonSegment value={tab} onIonChange={(e) => setTab((e.detail.value as FeedTab) || 'forYou')} color="primary">
          <IonSegmentButton value="forYou">
            <IonLabel>Pour toi</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="following">
            <IonLabel>Abonnements</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </div>

      <div className="mt-1">
        <ComposeBox onPost={handlePost} />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <IonSpinner />
          <IonText color="medium">Chargement du fil...</IonText>
        </div>
      ) : error ? (
        <div className="text-center py-16 px-6">
          <IonText color="medium">{error}</IonText>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="text-center py-16 px-6">
          <div className="text-4xl mb-3" aria-hidden="true">
            🐺
          </div>
          <IonText color="medium">
            {tab === 'following' ? 'Suis des comptes pour voir leurs posts ici !' : 'Aucun post pour le moment.'}
          </IonText>
        </div>
      ) : (
        visibleItems.map((item) => (
          <PostCard
            key={item.key}
            post={item.post}
            repostInfo={item.repost}
            onLike={handleLike}
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
          onLike={handleLike}
          onRepost={handleRepost}
          onVote={handleVote}
          onCommentDelta={handleCommentDelta}
        />
      )}

      <Toast />
    </MobilePage>
  );
}
