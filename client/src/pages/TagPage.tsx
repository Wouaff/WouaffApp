import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import type { Post } from '../components/PostCard';
import PostList from '../components/PostList';
import { usePaged } from '../hooks/usePaged';
import { api } from '../services/api';

export default function TagPage() {
  const { tag = '' } = useParams<{ tag: string }>();
  const feed = usePaged<Post>(
    (offset) => api.get<Post[]>(`/posts/feed?tag=${encodeURIComponent(tag)}&offset=${offset}`),
    tag,
  );

  return (
    <AppShell onPosted={feed.reload}>
      <PageHeader title={`#${tag}`} back="/explore" />
      <PostList
        posts={feed.items}
        loading={feed.loading}
        loadingMore={feed.loadingMore}
        hasMore={feed.hasMore}
        error={feed.error}
        emptyText={`Aucun post avec #${tag} pour le moment.`}
        onLoadMore={feed.loadMore}
        onRetry={feed.reload}
        onDelete={(id) => feed.setItems((prev) => prev.filter((p) => p.feedId !== id))}
        onBlocked={(uid) => feed.setItems((prev) => prev.filter((p) => p.user.uid !== uid))}
      />
    </AppShell>
  );
}
