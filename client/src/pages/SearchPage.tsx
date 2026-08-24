import { ChevronLeft, Search, User } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LeftNav from '../components/Home/LeftNav';
import RightSidebar from '../components/Home/RightSidebar';
import { search as searchAPI } from '../services/api';
import type { SearchResult } from '../types';

export default function SearchPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const urlQ = params.get('q') || '';
  const [q, setQ] = useState(urlQ);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runSearch = useCallback(async (value: string) => {
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchAPI.users(value);
      setResults(data.results);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* Recherche en direct (debounce) */
  useEffect(() => {
    const value = q.trim();
    if (!value) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      runSearch(value);
    }, 350);
    return () => clearTimeout(timer);
  }, [q, runSearch]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = q.trim();
    if (!value) return;
    setParams({ q: value }, { replace: true });
  };

  const openProfile = (r: SearchResult) => {
    const id = r.wouaffId?.replace(/^@/, '');
    if (id) navigate(`/@${id}`);
  };

  const initial = (s: SearchResult) =>
    (s.profile?.pseudo || s.wouaffId?.replace(/^@/, '') || '?')[0]?.toUpperCase() || '?';

  return (
    <div className="flex h-full">
      <LeftNav />
      <main className="flex-1 min-w-0 h-full overflow-y-auto border-x border-[var(--border)] bg-[var(--bg-deep)]">
        <header className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-[12px] border-b border-[var(--border)]">
          <div className="flex items-center px-2 h-14">
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
              aria-label="Retour"
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <ChevronLeft size={22} />
            </button>
            <h1 className="text-xl font-extrabold m-0 text-[var(--text-primary)]">Recherche</h1>
          </div>
        </header>

        <form onSubmit={submit} className="px-4 py-3 border-b border-[var(--border)]">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher des comptes (@pseudo)"
              aria-label="Rechercher des comptes"
              className="w-full bg-[var(--bg-input)] border border-transparent focus:border-[var(--brand)] outline-none rounded-full py-2.5 pl-11 pr-4 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-sans transition-colors"
            />
          </div>
        </form>

        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="spinner" />
          </div>
        ) : !searched ? (
          <div className="py-20 px-6 text-center">
            <div className="text-4xl mb-3" aria-hidden="true">
              🔍
            </div>
            <p className="m-0 text-[15px] text-[var(--text-primary)] font-bold">Trouvez des comptes à suivre</p>
            <p className="m-0 mt-1 text-[13px] text-[var(--text-secondary)]">
              Recherchez par pseudo ou @wouaffId pour découvrir de nouveaux profils.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="py-20 px-6 text-center">
            <p className="m-0 text-[var(--text-secondary)]">Aucun compte trouvé pour «&nbsp;{q.trim()}&nbsp;».</p>
          </div>
        ) : (
          <ul className="list-none m-0 p-0">
            {results.map((r) => {
              const pseudo = r.profile?.pseudo || 'Utilisateur';
              const handle = r.wouaffId;
              const bio = r.profile?.bio;
              return (
                <li key={r.uid}>
                  <button
                    type="button"
                    onClick={() => openProfile(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[var(--border)] bg-transparent cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-base overflow-hidden flex-shrink-0">
                      {r.profile?.avatar ? (
                        <img
                          src={r.profile.avatar}
                          alt={`Avatar de ${r.profile.pseudo || "l'utilisateur"}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span>{initial(r)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[var(--text-primary)] text-[15px] truncate">{pseudo}</span>
                        {handle && <span className="text-[var(--text-muted)] text-[14px] truncate">{handle}</span>}
                      </div>
                      {bio && <p className="m-0 mt-0.5 text-[13px] text-[var(--text-secondary)] truncate">{bio}</p>}
                    </div>
                    <span className="flex items-center gap-1 text-[13px] font-bold text-brand flex-shrink-0">
                      <User size={14} />
                      Voir
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <RightSidebar />
    </div>
  );
}
