import { ArrowLeft, Calendar, LinkIcon, MapPin } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ComposeModal from '../components/ComposeModal';
import PostCard, { type Post } from '../components/PostCard';
import RightSidebar from '../components/RightSidebar';
import Sidebar from '../components/Sidebar';
import VerifiedBadge from '../components/VerifiedBadge';
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
  isOwn: boolean;
}

const TABS = ['Posts', 'Replies', 'Reposts'] as const;

export default function ProfilePage() {
  const { pseudo } = useParams<{ pseudo: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<string>('Posts');
  const [showCompose, setShowCompose] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!pseudo) return;
    try {
      const data = await api.get<Profile>(`/profiles/${pseudo}`);
      setProfile(data);
      const postsData = await api.get<Post[]>(`/profiles/${pseudo}/posts`);
      setPosts(postsData);
    } catch {}
    setLoading(false);
  }, [pseudo]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleFollow = async () => {
    if (!profile) return;
    try {
      await api.post(`/follows/${profile.pseudo}`);
      setProfile({
        ...profile,
        isFollowing: !profile.isFollowing,
        followersCount: profile.isFollowing ? profile.followersCount - 1 : profile.followersCount + 1,
      });
    } catch {}
  };

  const handleDelete = (id: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setProfile((p) => (p ? { ...p, tweetsCount: p.tweetsCount - 1 } : p));
  };

  if (loading)
    return (
      <div className="flex min-h-screen justify-center pb-16 md:pb-0">
        <Sidebar onCompose={() => setShowCompose(true)} />
        <main className="flex-1 min-w-0 max-w-[600px] border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-center">
          <div className="spinner" />
        </main>
        <RightSidebar />
      </div>
    );

  if (!profile)
    return (
      <div className="flex min-h-screen justify-center pb-16 md:pb-0">
        <Sidebar onCompose={() => setShowCompose(true)} />
        <main className="flex-1 min-w-0 max-w-[600px] border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)]">
          User not found
        </main>
        <RightSidebar />
      </div>
    );

  return (
    <div className="flex min-h-screen justify-center pb-16 md:pb-0">
      <Sidebar onCompose={() => setShowCompose(true)} />

      <main className="flex-1 min-w-0 border-r border-[var(--border-color)] max-w-[600px] bg-[var(--bg-secondary)]">
        <div className="sticky top-0 z-40 bg-[var(--bg-secondary)]/80 backdrop-blur-md border-b border-[var(--border-color)]">
          <div className="flex items-center gap-6 px-4 py-2">
            <Link to="/" className="p-2 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors">
              <ArrowLeft className="w-5 h-5 text-[var(--text-primary)]" />
            </Link>
            <div>
              <h1 className="font-bold text-xl leading-tight">{profile.displayName || profile.pseudo}</h1>
              <p className="text-sm text-[var(--text-secondary)]">{profile.tweetsCount} Posts</p>
            </div>
          </div>
        </div>

        <div className="h-[200px] bg-[var(--bg-tertiary)]">
          {profile.banner && <img src={profile.banner} alt="" className="w-full h-full object-cover" />}
        </div>

        <div className="px-4 pb-4 relative">
          <div className="flex justify-between items-end -mt-[68px] mb-3">
            <div className="relative z-10 w-[134px] h-[134px] rounded-full ring-4 ring-[var(--bg-secondary)] bg-[var(--bg-tertiary)] flex items-center justify-center text-4xl font-bold overflow-hidden">
              {profile.avatar ? (
                <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                (profile.pseudo || '?')[0].toUpperCase()
              )}
            </div>
            {profile.isOwn ? (
              <Link
                to="/settings"
                className="px-5 py-2 rounded-full border border-[var(--border-color)] text-[var(--text-primary)] font-bold hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                Edit profile
              </Link>
            ) : (
              <button
                onClick={handleFollow}
                className={`px-5 py-2 rounded-full font-bold transition-colors border ${
                  profile.isFollowing
                    ? 'bg-[var(--accent)] text-white border-transparent'
                    : 'bg-transparent text-[var(--text-primary)] border-[var(--border-color)] hover:border-[var(--text-secondary)]'
                }`}
              >
                {profile.isFollowing ? 'Following' : 'Follow'}
              </button>
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
            <p className="text-[var(--text-primary)] text-[15px] mt-3 whitespace-pre-wrap">{profile.bio}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-[var(--text-secondary)]">
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {profile.location}
              </span>
            )}
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[var(--accent)] hover:underline"
              >
                <LinkIcon className="w-4 h-4" />
                {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          </div>

          <div className="flex gap-5 mt-3 text-[15px]">
            <span>
              <strong className="text-[var(--text-primary)]">{profile.followingCount}</strong>{' '}
              <span className="text-[var(--text-secondary)]">Following</span>
            </span>
            <span>
              <strong className="text-[var(--text-primary)]">{profile.followersCount}</strong>{' '}
              <span className="text-[var(--text-secondary)]">Followers</span>
            </span>
            <span>
              <strong className="text-[var(--text-primary)]">{profile.tweetsCount}</strong>{' '}
              <span className="text-[var(--text-secondary)]">Posts</span>
            </span>
          </div>
        </div>

        <div className="flex border-b border-[var(--border-color)]">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors relative hover:bg-[var(--bg-tertiary)] ${
                tab === t ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-secondary)]'
              }`}
            >
              {t}
              {tab === t && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[var(--accent)] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {posts.map((post) => (
          <PostCard key={post.id} post={post} onDelete={handleDelete} />
        ))}
        {posts.length === 0 && <div className="text-center py-12 text-[var(--text-secondary)]">No posts yet</div>}
      </main>

      <RightSidebar />

      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} onPosted={fetchProfile} />}
    </div>
  );
}
