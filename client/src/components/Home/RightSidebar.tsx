import { Check, Lock, Search, Server, ShieldCheck, TrendingUp, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { MOCK_TRENDS } from '../../data/mockFeed';
import { profiles } from '../../services/api';

interface Suggestion {
  uid: string;
  pseudo: string;
  avatar: string | null;
  bio: string | null;
  wouaffId: string | null;
}

function toHandle(s: Suggestion): string {
  const id = s.wouaffId?.trim();
  if (id) return id.startsWith('@') ? id : `@${id}`;
  return `@${s.pseudo?.toLowerCase().replace(/\s+/g, '') || 'utilisateur'}`;
}

export default function RightSidebar() {
  const [q, setQ] = useState('');
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const loadSuggestions = useCallback(async () => {
    try {
      const res = await profiles.suggestions(3);
      setSuggestions(res.results);
    } catch (e) {
      console.error(e);
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const toggleFollow = async (s: Suggestion) => {
    const isFollowing = !!following[s.uid];
    setFollowing((prev) => ({ ...prev, [s.uid]: !isFollowing }));
    try {
      if (isFollowing) {
        await profiles.unfollow(s.uid);
      } else {
        await profiles.follow(s.uid);
      }
    } catch (e) {
      console.error(e);
      setFollowing((prev) => ({ ...prev, [s.uid]: isFollowing }));
    }
  };

  return (
    <aside className="hidden lg:flex flex-col flex-shrink-0 h-full w-[350px] border-l border-[var(--border)] bg-[var(--bg-base)]">
      <div className="flex-1 overflow-y-auto px-6 py-3">
        <div className="sticky top-0 z-10 pb-2 -mx-2 px-2 bg-[var(--bg-base)]">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher sur Wouaff"
              aria-label="Rechercher sur Wouaff"
              className="w-full bg-[var(--bg-input)] border border-transparent focus:border-[var(--brand)] outline-none rounded-full py-2.5 pl-11 pr-4 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-sans transition-colors"
            />
          </div>
        </div>

        <div className="mt-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <TrendingUp size={18} className="text-brand" />
            <h2 className="text-lg font-extrabold text-[var(--text-primary)] m-0">Tendances en France</h2>
          </div>
          {MOCK_TRENDS.map((t) => (
            <button
              key={t.tag}
              type="button"
              className="w-full text-left px-4 py-3 border-none bg-transparent cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span className="block text-[12px] text-[var(--text-muted)]">{t.category}</span>
              <span className="block text-[15px] font-bold text-[var(--text-primary)]">#{t.tag}</span>
              <span className="block text-[12px] text-[var(--text-muted)]">{t.posts} publications</span>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
          <h2 className="text-lg font-extrabold text-[var(--text-primary)] m-0 mb-3">La souveraineté Wouaff</h2>
          <ul className="list-none p-0 m-0 flex flex-col gap-3">
            <li className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[var(--brand-glow)] flex items-center justify-center flex-shrink-0">
                <Server size={18} className="text-brand" />
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)]">Hébergé en France</div>
                <div className="text-xs text-[var(--text-muted)]">Aucune donnée à l'étranger</div>
              </div>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[var(--brand-glow)] flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={18} className="text-brand" />
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)]">RGPD &amp; lois européennes</div>
                <div className="text-xs text-[var(--text-muted)]">Vos données sont protégées</div>
              </div>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[var(--brand-glow)] flex items-center justify-center flex-shrink-0">
                <Lock size={18} className="text-brand" />
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)]">Politique zéro log</div>
                <div className="text-xs text-[var(--text-muted)]">Nous ne traçons pas vos activités</div>
              </div>
            </li>
          </ul>
        </div>

        <div className="mt-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
          <h2 className="text-lg font-extrabold text-[var(--text-primary)] m-0 px-4 pt-4 pb-2">À qui suivre</h2>
          {suggestions.length === 0 ? (
            <div className="px-4 py-4 text-[13px] text-[var(--text-muted)]">Aucune suggestion pour le moment</div>
          ) : (
            suggestions.map((s) => {
              const isFollowing = following[s.uid];
              const initial = (s.pseudo || '?')[0]?.toUpperCase() || '?';
              return (
                <div
                  key={s.uid}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-sm overflow-hidden flex-shrink-0">
                    {s.avatar ? (
                      <img
                        src={s.avatar}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span>{initial}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-bold text-[var(--text-primary)] truncate">{s.pseudo}</div>
                    <div className="text-[13px] text-[var(--text-muted)] truncate">{s.bio || toHandle(s)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFollow(s)}
                    className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-[13px] font-bold border-none cursor-pointer transition-colors ${
                      isFollowing
                        ? 'bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border)]'
                        : 'bg-[var(--text-primary)] text-[var(--bg-base)] hover:opacity-90'
                    }`}
                    aria-label={isFollowing ? `Ne plus suivre ${s.pseudo}` : `Suivre ${s.pseudo}`}
                  >
                    {isFollowing ? <Check size={14} /> : <UserPlus size={14} />}
                    <span>{isFollowing ? 'Suivi' : 'Suivre'}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <p className="m-0 mt-4 text-[12px] text-[var(--text-muted)] px-1">
          Wouaff · Réseau social souverain · Fait en France 🇫🇷
        </p>
      </div>
    </aside>
  );
}
