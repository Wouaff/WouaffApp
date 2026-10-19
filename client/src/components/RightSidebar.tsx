import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import UserRow, { type UserSummary } from './UserRow';

interface Trend {
  tag: string;
  count: number;
}

export default function RightSidebar() {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<UserSummary[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    api
      .get<UserSummary[]>('/suggestions')
      .then(setSuggestions)
      .catch(() => {});
    api
      .get<Trend[]>('/trends?limit=5')
      .then(setTrends)
      .catch(() => {});
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`/explore?q=${encodeURIComponent(q.trim())}`);
  };

  /* Colonnes : 275 + 600 + 350 = 1225px. En dessous de 1280px la colonne de droite
     comprime le fil : on la masque plutôt que de tasser la colonne centrale. */
  return (
    <aside className="w-[350px] h-screen overflow-y-auto sticky top-0 pl-8 py-3 pr-6 hidden xl:block">
      <form
        onSubmit={submit}
        role="search"
        className="flex items-center gap-3 bg-[var(--bg-secondary)] rounded-full px-4 py-2.5 mb-4 border border-transparent focus-within:border-[var(--accent)]"
      >
        <Search className="w-5 h-5 text-[var(--text-secondary)]" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher sur Wouaff"
          aria-label="Rechercher sur Wouaff"
          className="bg-transparent outline-none flex-1 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
        />
      </form>

      {suggestions.length > 0 && (
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 mb-4">
          <h2 className="font-extrabold text-xl mb-1">À suivre</h2>
          {suggestions.map((s) => (
            <UserRow key={s.uid} user={s} />
          ))}
        </div>
      )}

      <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 pb-2">
        <h2 className="font-extrabold text-xl mb-3">Tendances</h2>
        {trends.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] pb-2">Pas encore de tendances</p>
        ) : (
          <div className="space-y-1">
            {trends.map((t) => (
              <Link
                key={t.tag}
                to={`/tag/${encodeURIComponent(t.tag.replace(/^#/, ''))}`}
                className="block -mx-4 px-4 py-2 hover:bg-[var(--bg-tertiary)] hover:no-underline"
              >
                <div className="font-bold break-all text-[var(--text-primary)]">{t.tag}</div>
                <div className="text-sm text-[var(--text-secondary)]">
                  {t.count} {t.count > 1 ? 'posts' : 'post'}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
