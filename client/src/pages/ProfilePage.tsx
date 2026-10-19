import { Calendar, LinkIcon, MapPin } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import FollowButton from '../components/FollowButton';
import PageHeader, { Tabs } from '../components/PageHeader';
import type { Post } from '../components/PostCard';
import PostList from '../components/PostList';
import RichText from '../components/RichText';
import VerifiedBadge from '../components/VerifiedBadge';
import { usePaged } from '../hooks/usePaged';
import { monthYear, timeAgo } from '../lib/time';
import { api } from '../services/api';

interface Profile {
  uid: string;
  pseudo: string;
  displayName: string | null;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  verified: boolean;
  createdAt: number;
  followersCount: number;
  followingCount: number;
  tweetsCount: number;
  isFollowing: boolean;
  isBlocked: boolean;
  hasBlockedMe: boolean;
  isOwn: boolean;
}

interface Reply {
  id: number;
  text: string;
  createdAt: string;
  post: { id: number; text: string | null; pseudo: string };
}

const TABS = ['posts', 'replies', 'reposts'] as const;
const LABELS = { posts: 'Posts', replies: 'Réponses', reposts: 'Reposts' };

export default function ProfilePage() {
  const { pseudo = '' } = useParams<{ pseudo: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [tab, setTab] = useState<(typeof TABS)[number]>('posts');

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await api.get<Profile>(`/profiles/${encodeURIComponent(pseudo)}`));
      setStatus('ok');
    } catch {
      setStatus('missing');
    }
  }, [pseudo]);

  useEffect(() => {
    setStatus('loading');
    setTab('posts');
    loadProfile();
  }, [loadProfile]);

  const posts = usePaged<Post>(
    (offset) =>
      tab === 'replies'
        ? Promise.resolve([])
        : api.get<Post[]>(`/profiles/${encodeURIComponent(pseudo)}/posts?tab=${tab}&offset=${offset}`),
    `${pseudo}|${tab}`,
  );
  const replies = usePaged<Reply>(
    (offset) =>
      tab === 'replies'
        ? api.get<Reply[]>(`/profiles/${encodeURIComponent(pseudo)}/replies?offset=${offset}`)
        : Promise.resolve([]),
    `${pseudo}|${tab}`,
  );

  const toggleBlock = async () => {
    if (!profile) return;
    if (
      !profile.isBlocked &&
      !window.confirm(`Bloquer @${profile.pseudo} ? Vous ne verrez plus vos contenus respectifs.`)
    ) {
      return;
    }
    try {
      await api.post(`/blocks/${profile.pseudo}`);
      await loadProfile();
      posts.reload();
    } catch {
      /* inchangé */
    }
  };

  if (status === 'loading') {
    return (
      <AppShell>
        <div className="flex justify-center py-24">
          <div className="spinner" />
        </div>
      </AppShell>
    );
  }
  if (status === 'missing' || !profile) {
    return (
      <AppShell>
        <PageHeader title="Profil" back="/" />
        <div className="text-center py-16 text-[var(--text-secondary)]">Ce compte n'existe pas.</div>
      </AppShell>
    );
  }

  return (
    <AppShell onPosted={posts.reload}>
      <PageHeader
        title={profile.displayName || profile.pseudo}
        subtitle={`${profile.tweetsCount} ${profile.tweetsCount > 1 ? 'posts' : 'post'}`}
        back="/"
      />

      <div className="h-[200px] bg-[var(--bg-tertiary)]">
        {profile.banner && <img src={profile.banner} alt="" className="w-full h-full object-cover" />}
      </div>

      <div className="px-4 pb-4 relative">
        <div className="flex justify-between items-end -mt-[68px] mb-3">
          <Avatar
            src={profile.avatar}
            name={profile.pseudo}
            className="relative z-10 w-[134px] h-[134px] text-4xl ring-4 ring-[var(--bg-secondary)]"
          />
          {profile.isOwn ? (
            <Link
              to="/settings?tab=profile"
              className="px-5 py-2 rounded-full border border-[var(--border-color)] text-[var(--text-primary)] font-bold hover:bg-[var(--bg-tertiary)] transition-colors hover:no-underline"
            >
              Modifier le profil
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleBlock}
                className="px-4 py-2 rounded-full border border-[var(--border-color)] text-sm font-bold text-[var(--text-primary)] hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors"
              >
                {profile.isBlocked ? 'Débloquer' : 'Bloquer'}
              </button>
              {!profile.isBlocked && !profile.hasBlockedMe && (
                <FollowButton
                  key={profile.uid}
                  pseudo={profile.pseudo}
                  initialFollowing={profile.isFollowing}
                  size="md"
                  onChange={(following) =>
                    setProfile((p) =>
                      p ? { ...p, isFollowing: following, followersCount: p.followersCount + (following ? 1 : -1) } : p,
                    )
                  }
                />
              )}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="font-extrabold text-xl">{profile.displayName || profile.pseudo}</h2>
            {profile.verified && <VerifiedBadge className="w-5 h-5" />}
          </div>
          <p className="text-[var(--text-secondary)] text-[15px]">@{profile.pseudo}</p>
        </div>

        {profile.bio && (
          <p className="text-[var(--text-primary)] text-[15px] mt-3 whitespace-pre-wrap break-words">
            <RichText text={profile.bio} />
          </p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-[var(--text-secondary)]">
          {profile.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {profile.location}
            </span>
          )}
          {profile.website && /^https?:\/\//i.test(profile.website) && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex items-center gap-1 text-[var(--accent)] hover:underline"
            >
              <LinkIcon className="w-4 h-4" />
              {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />A rejoint Wouaff en {monthYear(profile.createdAt)}
          </span>
        </div>

        <div className="flex gap-5 mt-3 text-[15px]">
          <Link to={`/${profile.pseudo}/following`} className="hover:underline text-[var(--text-primary)]">
            <strong>{profile.followingCount}</strong> <span className="text-[var(--text-secondary)]">abonnements</span>
          </Link>
          <Link to={`/${profile.pseudo}/followers`} className="hover:underline text-[var(--text-primary)]">
            <strong>{profile.followersCount}</strong>{' '}
            <span className="text-[var(--text-secondary)]">{profile.followersCount > 1 ? 'abonnés' : 'abonné'}</span>
          </Link>
        </div>
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} labels={LABELS} />

      {profile.hasBlockedMe ? (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          Tu ne peux pas voir les posts de ce compte.
        </div>
      ) : profile.isBlocked ? (
        <div className="text-center py-12 text-[var(--text-secondary)]">Tu as bloqué @{profile.pseudo}.</div>
      ) : tab === 'replies' ? (
        replies.loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : replies.items.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">Aucune réponse pour le moment.</div>
        ) : (
          replies.items.map((r) => (
            <Link
              key={r.id}
              to={`/post/${r.post.id}`}
              className="block px-4 py-3 border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/50 hover:no-underline"
            >
              <p className="text-sm text-[var(--text-secondary)] truncate">
                En réponse à @{r.post.pseudo} · {timeAgo(r.createdAt)}
              </p>
              <p className="text-[15px] text-[var(--text-primary)] whitespace-pre-wrap break-words mt-0.5">{r.text}</p>
            </Link>
          ))
        )
      ) : (
        <PostList
          posts={posts.items}
          loading={posts.loading}
          loadingMore={posts.loadingMore}
          hasMore={posts.hasMore}
          error={posts.error}
          emptyText={tab === 'reposts' ? 'Aucun repost pour le moment.' : 'Aucun post pour le moment.'}
          onLoadMore={posts.loadMore}
          onRetry={posts.reload}
          onDelete={(id) => {
            posts.setItems((prev) => prev.filter((p) => p.feedId !== id));
            if (tab === 'posts') setProfile((p) => (p ? { ...p, tweetsCount: Math.max(0, p.tweetsCount - 1) } : p));
          }}
          onBlocked={() => {
            loadProfile();
            posts.reload();
          }}
        />
      )}
    </AppShell>
  );
}
