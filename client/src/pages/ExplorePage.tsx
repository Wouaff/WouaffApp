import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ComposeModal from '../components/ComposeModal';
import RightSidebar from '../components/RightSidebar';
import Sidebar from '../components/Sidebar';
import { api } from '../services/api';

const TABS = ['For you', 'Trending', 'News', 'Sports', 'Entertainment', 'Technology'] as const;

interface Trend {
  tag: string;
  count: number;
}

export default function ExplorePage() {
  const [tab, setTab] = useState<string>('For you');
  const [search, setSearch] = useState('');
  const [trends, setTrends] = useState<Trend[]>([]);
  const [showCompose, setShowCompose] = useState(false);

  useEffect(() => {
    api
      .get<Trend[]>('/trends')
      .then(setTrends)
      .catch(() => setTrends([]));
  }, []);

  return (
    <div className="flex min-h-screen justify-center pb-16 md:pb-0">
      <Sidebar onCompose={() => setShowCompose(true)} />

      <main className="flex-1 min-w-0 border-r border-[var(--border-color)] max-w-[600px] bg-[var(--bg-secondary)]">
        <div className="sticky top-0 z-40 bg-[var(--bg-secondary)]/80 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link
              to="/"
              className="text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] p-2 rounded-full transition-colors"
            >
              ←
            </Link>
            <h1 className="font-bold text-xl">Explore</h1>
          </div>

          <div className="px-4 pb-3">
            <div className="flex items-center gap-3 bg-[var(--bg-secondary)] rounded-full px-4 py-2.5 border border-transparent focus-within:border-[var(--accent)]">
              <Search className="w-5 h-5 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Wouaff"
                className="bg-transparent text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none flex-1 text-[15px]"
              />
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
        </div>

        <div>
          <h2 className="font-extrabold text-xl px-4 py-3">Trends for you</h2>
          {trends.length === 0 && <p className="px-4 py-3 text-sm text-[var(--text-secondary)]">No trends yet</p>}
          {trends.map((t, i) => (
            <div key={t.tag} className="px-4 py-3 border-b border-[var(--border-color)]">
              <span className="text-sm text-[var(--text-secondary)]">{i + 1} · Trending</span>
              <div className="font-bold text-[var(--text-primary)] mt-0.5 break-all">{t.tag}</div>
              <span className="text-sm text-[var(--text-secondary)]">
                {t.count} {t.count > 1 ? 'posts' : 'post'}
              </span>
            </div>
          ))}
        </div>

        <div className="px-4 py-3">
          <h2 className="font-extrabold text-xl mb-3">Who to follow</h2>
          <WhoToFollowInline />
        </div>
      </main>

      <RightSidebar />

      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} onPosted={() => {}} />}
    </div>
  );
}

function WhoToFollowInline() {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api
      .get<any[]>('/suggestions')
      .then(setSuggestions)
      .catch(() => {});
  }, []);

  const handleFollow = async (pseudo: string, uid: string) => {
    try {
      await api.post(`/follows/${pseudo}`);
      setFollowingMap((prev) => ({ ...prev, [uid]: !prev[uid] }));
    } catch {}
  };

  return (
    <div className="space-y-1">
      {suggestions.map((s) => (
        <div key={s.uid} className="flex items-center gap-3 py-3">
          <Link
            to={`/${s.pseudo}`}
            className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex-shrink-0 flex items-center justify-center text-sm font-bold overflow-hidden"
          >
            {s.avatar ? (
              <img src={s.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              (s.pseudo || '?')[0].toUpperCase()
            )}
          </Link>
          <Link to={`/${s.pseudo}`} className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">{s.displayName || s.pseudo}</div>
            <div className="text-sm text-[var(--text-secondary)] truncate">@{s.pseudo}</div>
          </Link>
          <button
            onClick={() => handleFollow(s.pseudo, s.uid)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors border ${
              followingMap[s.uid]
                ? 'bg-[var(--accent)] text-white border-transparent'
                : 'bg-transparent text-[var(--text-primary)] border-[var(--border-color)] hover:border-[var(--text-secondary)]'
            }`}
          >
            {followingMap[s.uid] ? 'Following' : 'Follow'}
          </button>
        </div>
      ))}
    </div>
  );
}
