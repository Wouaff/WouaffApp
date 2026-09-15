import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import VerifiedBadge from './VerifiedBadge';

interface Suggestion {
  uid: string;
  pseudo: string;
  displayName: string | null;
  avatar: string | null;
  verified: boolean;
}

interface Trend {
  tag: string;
  count: number;
}

export default function RightSidebar() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api
      .get<Suggestion[]>('/suggestions')
      .then(setSuggestions)
      .catch(() => {});
    api
      .get<Trend[]>('/trends')
      .then(setTrends)
      .catch(() => {});
  }, []);

  const handleFollow = async (pseudo: string, uid: string) => {
    try {
      await api.post(`/follows/${pseudo}`);
      setFollowingMap((prev) => ({ ...prev, [uid]: !prev[uid] }));
    } catch {}
  };

  return (
    <aside className="w-[350px] h-screen overflow-y-auto sticky top-0 pl-8 py-3 pr-6 hidden lg:block">
      <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 mb-4">
        <h2 className="font-extrabold text-xl mb-3">Who to follow</h2>
        {suggestions.map((s) => (
          <div key={s.uid} className="flex items-center gap-3 py-3">
            <Link to={`/${s.pseudo}`} className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-sm font-bold overflow-hidden">
                {s.avatar ? (
                  <img src={s.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  (s.pseudo || '?')[0].toUpperCase()
                )}
              </div>
            </Link>
            <Link to={`/${s.pseudo}`} className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate flex items-center gap-1">
                {s.displayName || s.pseudo}
                {s.verified && <VerifiedBadge />}
              </div>
              <div className="text-sm text-[var(--text-secondary)] truncate">@{s.pseudo}</div>
            </Link>
            <button
              onClick={() => handleFollow(s.pseudo, s.uid)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors border ${
                followingMap[s.uid]
                  ? 'border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--danger)] hover:text-[var(--danger)]'
                  : 'border-transparent bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
              }`}
            >
              {followingMap[s.uid] ? 'Following' : 'Follow'}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 pb-2">
        <h2 className="font-extrabold text-xl mb-3">Trends for you</h2>
        {trends.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] pb-2">No trends yet</p>
        ) : (
          <div className="space-y-1">
            {trends.map((t) => (
              <div key={t.tag} className="-mx-4 px-4 py-2">
                <div className="font-bold break-all">{t.tag}</div>
                <div className="text-sm text-[var(--text-secondary)]">
                  {t.count} {t.count > 1 ? 'posts' : 'post'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
