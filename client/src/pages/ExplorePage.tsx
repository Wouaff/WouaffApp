import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHeader, { Tabs } from '../components/PageHeader';
import type { Post } from '../components/PostCard';
import PostList from '../components/PostList';
import UserRow, { type UserSummary } from '../components/UserRow';
import { usePaged } from '../hooks/usePaged';
import { api } from '../services/api';

interface Trend {
  tag: string;
  count: number;
}

const TABS = ['accounts', 'posts'] as const;
const LABELS = { accounts: 'Comptes', posts: 'Posts' };

export default function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [input, setInput] = useState(urlQuery);
  const [query, setQuery] = useState(urlQuery.trim());
  const [tab, setTab] = useState<(typeof TABS)[number]>('accounts');
  const [trends, setTrends] = useState<Trend[]>([]);
  const [suggestions, setSuggestions] = useState<UserSummary[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  /* L'URL (?q=) est la source de vérité : on s'aligne dessus (recherche depuis la colonne de droite). */
  useEffect(() => {
    setInput(urlQuery);
    setQuery(urlQuery.trim());
  }, [urlQuery]);

  /* Saisie : on attend 300 ms sans frappe avant de chercher. */
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = input.trim();
      setQuery(next);
      setParams(next ? { q: next } : {}, { replace: true });
    }, 300);
    return () => window.clearTimeout(t);
  }, [input, setParams]);

  useEffect(() => {
    api
      .get<Trend[]>('/trends')
      .then(setTrends)
      .catch(() => setTrends([]));
    api
      .get<UserSummary[]>('/suggestions')
      .then(setSuggestions)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!query) {
      setUsers([]);
      return;
    }
    let cancelled = false;
    setUsersLoading(true);
    api
      .get<UserSummary[]>(`/search?q=${encodeURIComponent(query)}`)
      .then((r) => !cancelled && setUsers(r))
      .catch(() => !cancelled && setUsers([]))
      .finally(() => !cancelled && setUsersLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const posts = usePaged<Post>(
    (offset) =>
      query && tab === 'posts'
        ? api.get<Post[]>(`/posts/feed?q=${encodeURIComponent(query)}&offset=${offset}`)
        : Promise.resolve([]),
    `${query}|${tab}`,
  );

  const searching = query.length > 0;

  return (
    <AppShell>
      <PageHeader title="Explorer" back="/">
        <div className="px-4 pb-3">
          <div className="flex items-center gap-3 bg-[var(--bg-tertiary)] rounded-full px-4 py-2.5 border border-transparent focus-within:border-[var(--accent)]">
            <Search className="w-5 h-5 text-[var(--text-secondary)]" />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Rechercher sur Wouaff"
              aria-label="Rechercher sur Wouaff"
              className="bg-transparent text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none flex-1 text-[15px]"
            />
          </div>
        </div>
        {searching && <Tabs tabs={TABS} value={tab} onChange={setTab} labels={LABELS} />}
      </PageHeader>

      {searching ? (
        tab === 'accounts' ? (
          <div className="px-4">
            {usersLoading && users.length === 0 && (
              <div className="flex justify-center py-8">
                <div className="spinner" />
              </div>
            )}
            {!usersLoading && users.length === 0 && (
              <p className="py-10 text-center text-[var(--text-secondary)]">
                Aucun compte ne correspond à « {query} ».
              </p>
            )}
            {users.map((u) => (
              <UserRow key={u.uid} user={u} />
            ))}
          </div>
        ) : (
          <PostList
            posts={posts.items}
            loading={posts.loading}
            loadingMore={posts.loadingMore}
            hasMore={posts.hasMore}
            error={posts.error}
            emptyText={`Aucun post ne correspond à « ${query} ».`}
            onLoadMore={posts.loadMore}
            onRetry={posts.reload}
            onDelete={(id) => posts.setItems((prev) => prev.filter((p) => p.feedId !== id))}
            onBlocked={(uid) => posts.setItems((prev) => prev.filter((p) => p.user.uid !== uid))}
          />
        )
      ) : (
        <>
          <h2 className="font-extrabold text-xl px-4 py-3">Tendances</h2>
          {trends.length === 0 && (
            <p className="px-4 pb-4 text-sm text-[var(--text-secondary)]">Pas encore de tendances.</p>
          )}
          {trends.map((t, i) => (
            <Link
              key={t.tag}
              to={`/tag/${encodeURIComponent(t.tag.replace(/^#/, ''))}`}
              className="block px-4 py-3 border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/50 hover:no-underline"
            >
              <span className="text-sm text-[var(--text-secondary)]">{i + 1} · Tendance</span>
              <div className="font-bold text-[var(--text-primary)] mt-0.5 break-all">{t.tag}</div>
              <span className="text-sm text-[var(--text-secondary)]">
                {t.count} {t.count > 1 ? 'posts' : 'post'}
              </span>
            </Link>
          ))}

          {suggestions.length > 0 && (
            <div className="px-4 py-3">
              <h2 className="font-extrabold text-xl mb-1">À suivre</h2>
              {suggestions.map((s) => (
                <UserRow key={s.uid} user={s} />
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
