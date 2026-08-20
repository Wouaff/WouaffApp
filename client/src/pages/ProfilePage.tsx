import { ChevronLeft, MessageSquare, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FollowModal from '../components/Home/FollowModal';
import LeftNav from '../components/Home/LeftNav';
import PostCard from '../components/Home/PostCard';
import PostModal from '../components/Home/PostModal';
import RightSidebar from '../components/Home/RightSidebar';
import MusicCard, { parseProfileMusic } from '../components/Profile/MusicCard';
import { useAuth } from '../hooks/useAuth';
import { posts as postsAPI, profiles as profilesAPI } from '../services/api';
import { offPostPoll, onPostPoll } from '../services/socket';
import type { FeedItem, PostPoll, SocialPost } from '../types';
import { PLATFORMS, parseSocialLinks } from '../utils/socialLinks';

interface BadgeDef {
  name?: string;
  icon?: string;
}

interface ProfileData {
  uid: string;
  profile: Record<string, unknown>;
  badges: Record<string, BadgeDef>;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
  isMe: boolean;
  verified: boolean;
}

type PageState = 'loading' | 'error' | 'profile';

export default function ProfilePage() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const rawId = loc.pathname.match(/^\/@(.+)/)?.[1] || null;
  const wouaffId = rawId ? `@${rawId.replace(/^@/, '')}` : null;

  const [state, setState] = useState<PageState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [data, setData] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followPending, setFollowPending] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null);

  const selectedPost = posts.find((i) => i.post.id === selectedPostId)?.post || null;

  const loadProfile = useCallback(async () => {
    if (!wouaffId || wouaffId === '@') {
      setState('error');
      setErrorMsg('Aucun identifiant spécifié.');
      return;
    }
    setState('loading');
    try {
      const res = await fetch(`/api/public/profile/${encodeURIComponent(wouaffId)}`);
      if (!res.ok) {
        setState('error');
        setErrorMsg(res.status === 404 ? "Ce profil n'existe pas." : 'Impossible de charger le profil.');
        return;
      }
      const json = (await res.json()) as ProfileData;
      if (!json.profile) {
        setState('error');
        setErrorMsg("Ce profil n'existe pas.");
        return;
      }
      setData(json);
      setFollowing(json.isFollowing);
      setFollowers(json.followersCount);
      setFollowingCount(json.followingCount);
      setState('profile');
      const handle = String(json.profile.wouaffId || wouaffId).replace(/^@/, '');
      document.title = `${json.profile.pseudo || 'Utilisateur'} (@${handle}) — Wouaff`;
    } catch {
      setState('error');
      setErrorMsg('Impossible de charger le profil.');
    }
  }, [wouaffId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const loadPosts = useCallback(async (uid: string) => {
    setPostsLoading(true);
    try {
      setPosts(await postsAPI.list(1, 50, uid));
    } catch (e) {
      console.error(e);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (data?.uid) loadPosts(data.uid);
  }, [data?.uid, loadPosts]);

  const handleFollow = useCallback(async () => {
    if (!data) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    setFollowPending(true);
    try {
      if (following) {
        await profilesAPI.unfollow(data.uid);
        setFollowing(false);
        setFollowers((f) => Math.max(0, f - 1));
      } else {
        await profilesAPI.follow(data.uid);
        setFollowing(true);
        setFollowers((f) => f + 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFollowPending(false);
    }
  }, [data, following, user, navigate]);

  const handleFollowCountChange = useCallback((kind: 'followers' | 'following', delta: number) => {
    if (kind === 'followers') setFollowers((f) => Math.max(0, f + delta));
    else setFollowingCount((f) => Math.max(0, f + delta));
  }, []);

  const updatePost = useCallback((id: string, fn: (p: SocialPost) => SocialPost) => {
    setPosts((prev) => {
      const idx = prev.findIndex((i) => i.post.id === id);
      if (idx === -1) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx], post: fn(next[idx].post) };
      return next;
    });
  }, []);

  const postsRef = useRef(posts);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const openPost = useCallback((p: SocialPost) => setSelectedPostId(p.id), []);

  const handleReact = useCallback(
    async (id: string, type: string) => {
      const was = postsRef.current.find((i) => i.post.id === id)?.post.myReaction ?? null;
      const delta = was ? (was === type ? -1 : 0) : 1;
      updatePost(id, (p) => ({
        ...p,
        myReaction: was === type ? null : type,
        likes: Math.max(0, p.likes + delta),
      }));
      try {
        const res = await postsAPI.react(id, type);
        updatePost(id, (p) => ({ ...p, myReaction: res.reaction, likes: res.total, reactions: res.reactions }));
      } catch (e) {
        console.error(e);
        updatePost(id, (p) => ({ ...p, myReaction: was, likes: p.likes - delta }));
      }
    },
    [updatePost],
  );

  const handleRepost = useCallback(
    async (id: string) => {
      const wasReposted = postsRef.current.find((i) => i.post.id === id)?.post.reposted;
      updatePost(id, (p) => ({ ...p, reposted: !p.reposted, reposts: p.reposts + (p.reposted ? -1 : 1) }));
      try {
        const res = await postsAPI.repost(id);
        updatePost(id, (p) => ({ ...p, reposted: res.reposted, reposts: res.reposts }));
        if (res.reposted && res.item) {
          setPosts((prev) => (prev.some((i) => i.key === res.item!.key) ? prev : [res.item!, ...prev]));
        } else if (!res.reposted) {
          setPosts((prev) =>
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

  useEffect(() => {
    if (!user) return;
    const onPoll = (data: { postId: string; poll: PostPoll }) => {
      updatePost(data.postId, (p) => ({ ...p, poll: data.poll }));
    };
    onPostPoll(onPoll);
    return () => offPostPoll(onPoll);
  }, [user, updatePost]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  if (state === 'loading') {
    return (
      <div className="flex h-full">
        <LeftNav />
        <main className="flex-1 min-w-0 h-full overflow-y-auto bg-[var(--bg-deep)]">
          <div className="h-full flex items-center justify-center">
            <div className="spinner" />
          </div>
        </main>
        <RightSidebar />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex h-full">
        <LeftNav />
        <main className="flex-1 min-w-0 h-full overflow-y-auto bg-[var(--bg-deep)]">
          <div className="h-full flex items-center justify-center px-4">
            <div className="text-center">
              <div className="text-6xl mb-3">🐺</div>
              <h1 className="text-2xl font-extrabold m-0 mb-1 text-[var(--text-primary)]">Profil introuvable</h1>
              <p className="m-0 mb-5 text-[var(--text-secondary)]">{errorMsg}</p>
              <Link
                to="/"
                className="inline-block bg-brand hover:opacity-90 transition-opacity text-white font-bold text-sm rounded-full px-6 py-2.5 no-underline"
              >
                Retour à l'accueil
              </Link>
            </div>
          </div>
        </main>
        <RightSidebar />
      </div>
    );
  }

  if (!data) return null;
  const { profile } = data;
  const p = profile;
  const pseudo = (p.pseudo as string) || 'Utilisateur';
  const handle = ((p.wouaffId as string) || wouaffId || '').replace(/^@/, '');
  const avatar = p.avatar as string | undefined;
  const banner = p.banner as string | undefined;
  const bio = p.bio as string | undefined;
  const socialLinks = parseSocialLinks(p.social_links).filter((l) => l.url.trim());
  const music = parseProfileMusic(p);
  const ownedBadgesRaw = p.ownedBadges as string[] | Record<string, string> | undefined;
  let badgeIds: string[] = [];
  if (ownedBadgesRaw) {
    if (Array.isArray(ownedBadgesRaw)) badgeIds = ownedBadgesRaw.filter(Boolean) as string[];
    else if (typeof ownedBadgesRaw === 'object') badgeIds = Object.values(ownedBadgesRaw).filter(Boolean) as string[];
  }
  const validBadges = badgeIds.map((id) => data.badges[id]).filter((b): b is BadgeDef => !!b && !!b.icon);
  const initial = (pseudo[0] || '?').toUpperCase();

  const actionBtn = data.isMe ? (
    <button
      type="button"
      onClick={() => navigate('/settings')}
      className="border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors font-bold text-sm rounded-full px-5 py-2 bg-transparent cursor-pointer"
    >
      Modifier le profil
    </button>
  ) : (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => navigate(`/messages?uid=${encodeURIComponent(data.uid)}`)}
        className="flex items-center gap-1.5 border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors font-bold text-sm rounded-full px-5 py-2 bg-transparent cursor-pointer"
      >
        <MessageSquare size={15} />
        Message
      </button>
      <button
        type="button"
        onClick={handleFollow}
        disabled={followPending}
        className={`transition-colors font-bold text-sm rounded-full px-5 py-2 cursor-pointer border-none disabled:opacity-50 ${
          following
            ? 'bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border)]'
            : 'bg-brand text-white hover:opacity-90'
        }`}
      >
        {following ? 'Abonné' : 'Suivre'}
      </button>
    </div>
  );

  return (
    <div className="flex h-full">
      <LeftNav />
      <main className="flex-1 min-w-0 h-full overflow-y-auto bg-[var(--bg-deep)]">
        <div className="mx-auto max-w-[600px] min-h-full border-x border-[var(--border)] bg-[var(--bg-base)]">
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
                <div className="font-extrabold text-[17px] text-[var(--text-primary)] leading-tight truncate">
                  {pseudo}
                </div>
                <div className="text-[12px] text-[var(--text-muted)]">{data.postsCount} posts</div>
              </div>
            </div>
          </header>

          <div
            className="h-40 bg-gradient-to-br from-brand to-brand-dark bg-cover bg-center flex-shrink-0"
            style={banner ? { backgroundImage: `url(${banner})` } : undefined}
          />

          <div className="flex items-start justify-between px-4">
            <div className="w-24 h-24 -mt-12 rounded-full border-4 border-[var(--bg-base)] bg-gradient-to-br from-brand to-brand-dark overflow-hidden flex items-center justify-center text-white font-extrabold text-3xl flex-shrink-0">
              {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <span>{initial}</span>}
            </div>
            <div className="mt-3">{actionBtn}</div>
          </div>

          <div className="px-4 pt-2 pb-3">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-extrabold m-0 text-[var(--text-primary)]">{pseudo}</h1>
              {validBadges.map((b) => (
                <img
                  key={b.icon}
                  src={b.icon}
                  alt={b.name || 'Badge'}
                  title={b.name || ''}
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ))}
            </div>
            <div className="text-[15px] text-[var(--text-muted)]">@{handle}</div>

            {bio && (
              <p className="m-0 mt-3 text-[15px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                {bio}
              </p>
            )}

            {socialLinks.length > 0 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {socialLinks.map((link) => {
                  const pf = PLATFORMS.find((p) => p.id === link.platform);
                  return (
                    <a
                      key={link.url + (pf?.id || '')}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[13px] text-brand no-underline hover:underline"
                      title={link.url}
                    >
                      {pf && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-4 h-4"
                          dangerouslySetInnerHTML={{ __html: pf.svg }}
                        />
                      )}
                      <span>{pf?.label || link.platform}</span>
                    </a>
                  );
                })}
              </div>
            )}

            {music && <MusicCard music={music} />}

            <div className="flex items-center gap-4 mt-3">
              <span className="text-[14px] text-[var(--text-primary)]">
                <strong>{data.postsCount}</strong> <span className="text-[var(--text-muted)]">posts</span>
              </span>
              <button
                type="button"
                onClick={() => setFollowModal('followers')}
                className="text-[14px] text-[var(--text-primary)] rounded-full border-none bg-transparent p-0 cursor-pointer hover:underline"
              >
                <strong>{followers}</strong> <span className="text-[var(--text-muted)]">abonnés</span>
              </button>
              <button
                type="button"
                onClick={() => setFollowModal('following')}
                className="text-[14px] text-[var(--text-primary)] rounded-full border-none bg-transparent p-0 cursor-pointer hover:underline"
              >
                <strong>{followingCount}</strong> <span className="text-[var(--text-muted)]">abonnements</span>
              </button>
            </div>
          </div>

          <div className="border-b border-[var(--border)]">
            <button
              type="button"
              className="w-full relative flex items-center justify-center py-3.5 border-none bg-transparent cursor-pointer text-[var(--text-primary)]"
              aria-current="page"
            >
              <span className="text-[15px] font-extrabold">Posts</span>
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-brand rounded-full" />
            </button>
          </div>

          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
            <UserPlus size={16} className="text-[var(--text-muted)]" />
            <span className="text-[13px] text-[var(--text-muted)]">Les posts de @{handle}</span>
          </div>

          {postsLoading ? (
            <div className="py-12 flex justify-center">
              <div className="spinner" />
            </div>
          ) : posts.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className="text-4xl mb-3" aria-hidden="true">
                🐺
              </div>
              <p className="m-0 text-[var(--text-secondary)]">
                {data.isMe ? "Vous n'avez pas encore publié de post." : `@${handle} n'a pas encore publié de post.`}
              </p>
            </div>
          ) : (
            posts.map((item) => (
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
      {followModal && (
        <FollowModal
          wouaffId={wouaffId!}
          kind={followModal}
          onClose={() => setFollowModal(null)}
          onChange={handleFollowCountChange}
        />
      )}
    </div>
  );
}
