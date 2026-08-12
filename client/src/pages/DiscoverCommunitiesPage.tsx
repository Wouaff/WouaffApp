import { Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import CommunityCard from '../components/Home/CommunityCard';
import CommunityCreateModal from '../components/Home/CommunityCreateModal';
import LeftNav from '../components/Home/LeftNav';
import { communities as communitiesAPI } from '../services/api';
import type { Community } from '../types';

const CATEGORIES = [
  'Toutes',
  'Actu FR',
  'Politique',
  'Tech',
  'Sport',
  'Humour',
  'Culture',
  'Jeux vidéo',
  'Sciences',
  'Musique',
];

export default function DiscoverCommunitiesPage() {
  const [category, setCategory] = useState('Toutes');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (query.trim()) {
        setCommunities(await communitiesAPI.search(query.trim()));
      } else {
        setCommunities(await communitiesAPI.discoverCategory(category === 'Toutes' ? undefined : category));
      }
    } catch {
      setCommunities([]);
    } finally {
      setLoading(false);
    }
  }, [category, query]);

  useEffect(() => {
    const t = setTimeout(load, query ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  const handleChanged = useCallback((updated: Community) => {
    setCommunities((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }, []);

  return (
    <div className="flex h-full">
      <LeftNav />
      <main className="flex-1 min-w-0 h-full overflow-y-auto border-x border-[var(--border)] bg-[var(--bg-deep)]">
        <header className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-[12px] border-b border-[var(--border)]">
          <div className="flex items-center px-4 h-14 gap-3">
            <h1 className="text-xl font-extrabold m-0 text-[var(--text-primary)]">Découvrir</h1>
            <div className="flex-1 max-w-[280px] flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-full px-3">
              <Search size={15} className="text-[var(--text-muted)] flex-shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher c/..."
                aria-label="Rechercher une communauté"
                className="flex-1 bg-transparent border-none outline-none py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] font-sans"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="ml-auto flex items-center gap-1.5 bg-brand hover:opacity-90 transition-opacity text-white font-bold text-sm rounded-full px-4 py-2 border-none cursor-pointer"
            >
              <Plus size={16} /> Créer
            </button>
          </div>
          <div className="flex items-center gap-1.5 px-4 pb-3 overflow-x-auto">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-current={category === c ? 'page' : undefined}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full border-none bg-transparent cursor-pointer text-[13px] transition-colors ${
                  category === c
                    ? 'font-extrabold text-[var(--text-primary)] bg-[var(--bg-input)]'
                    : 'font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div className="py-16 px-6 flex flex-col items-center gap-3">
            <div className="spinner" />
            <p className="m-0 text-sm text-[var(--text-muted)]">Chargement...</p>
          </div>
        ) : communities.length === 0 ? (
          <div className="py-20 px-6 text-center flex flex-col items-center gap-3">
            <p className="m-0 text-[var(--text-secondary)]">
              {query.trim()
                ? `Aucune communauté ne correspond à « ${query.trim()} ».`
                : 'Aucune communauté dans cette catégorie pour le moment.'}
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-1 bg-brand hover:opacity-90 transition-opacity text-white font-bold text-sm rounded-full px-6 py-2.5 border-none cursor-pointer"
            >
              Créer la première
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
            {communities.map((c) => (
              <CommunityCard key={c.id} community={c} onChanged={handleChanged} />
            ))}
          </div>
        )}
      </main>
      {showCreate && <CommunityCreateModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
