import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import UserRow, { type UserSummary } from '../components/UserRow';
import { usePaged } from '../hooks/usePaged';
import { api } from '../services/api';

export default function FollowListPage({ kind }: { kind: 'followers' | 'following' }) {
  const { pseudo = '' } = useParams<{ pseudo: string }>();
  const list = usePaged<UserSummary>(
    (offset) => api.get<UserSummary[]>(`/profiles/${encodeURIComponent(pseudo)}/${kind}?offset=${offset}`),
    `${pseudo}|${kind}`,
    30,
  );

  return (
    <AppShell>
      <PageHeader
        title={kind === 'followers' ? 'Abonnés' : 'Abonnements'}
        subtitle={`@${pseudo}`}
        back={`/${pseudo}`}
      />
      <div className="px-4">
        {list.loading && (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        )}
        {!list.loading && list.error && <p className="py-12 text-center text-[var(--text-secondary)]">{list.error}</p>}
        {!list.loading && !list.error && list.items.length === 0 && (
          <p className="py-12 text-center text-[var(--text-secondary)]">
            {kind === 'followers' ? 'Aucun abonné pour le moment.' : 'Aucun abonnement pour le moment.'}
          </p>
        )}
        {list.items.map((u) => (
          <UserRow key={u.uid} user={u} />
        ))}
        {list.hasMore && (
          <button
            type="button"
            onClick={list.loadMore}
            disabled={list.loadingMore}
            className="w-full py-4 text-[var(--accent)] font-bold"
          >
            {list.loadingMore ? '…' : 'Voir plus'}
          </button>
        )}
      </div>
    </AppShell>
  );
}
