import { useState } from 'react';
import AppShell from '../components/AppShell';
import ComposeBox from '../components/ComposeBox';
import PageHeader, { Tabs } from '../components/PageHeader';
import type { Post } from '../components/PostCard';
import PostList from '../components/PostList';
import { usePaged } from '../hooks/usePaged';
import { api } from '../services/api';

const TABS = ['for-you', 'following'] as const;
const LABELS = { 'for-you': 'Pour toi', following: 'Abonnements' };

export default function FeedPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('for-you');
  const feed = usePaged<Post>((offset) => api.get<Post[]>(`/posts/feed?tab=${tab}&offset=${offset}`), tab);

  return (
    <AppShell onPosted={feed.reload}>
      <PageHeader title="Accueil" back="/">
        <Tabs tabs={TABS} value={tab} onChange={setTab} labels={LABELS} />
      </PageHeader>

      <ComposeBox onPosted={feed.reload} />

      <PostList
        posts={feed.items}
        loading={feed.loading}
        loadingMore={feed.loadingMore}
        hasMore={feed.hasMore}
        error={feed.error}
        emptyText={
          tab === 'following'
            ? "Rien à voir pour l'instant : abonne-toi à des comptes pour remplir ce fil."
            : 'Aucun post pour le moment. Sois le premier à publier !'
        }
        onLoadMore={feed.loadMore}
        onRetry={feed.reload}
        onDelete={(id) => feed.setItems((prev) => prev.filter((p) => p.feedId !== id))}
        onBlocked={(uid) =>
          feed.setItems((prev) => prev.filter((p) => p.user.uid !== uid && p.repostedBy?.uid !== uid))
        }
      />
    </AppShell>
  );
}
