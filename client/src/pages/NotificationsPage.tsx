import { AtSign, CheckCircle2, Heart, MessageCircle, Repeat2, ShieldAlert, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import PageHeader, { Tabs } from '../components/PageHeader';
import { UNREAD_REFRESH_EVENT } from '../hooks/useUnread';
import { timeAgo } from '../lib/time';
import { api } from '../services/api';

const TABS = ['all', 'mentions', 'follows', 'activity'] as const;
const LABELS = { all: 'Tout', mentions: 'Mentions', follows: 'Abonnés', activity: 'Activité' };

interface Notification {
  id: number;
  type: string;
  read: boolean;
  createdAt: string;
  actor: { uid: string; pseudo: string; displayName: string | null; avatar: string | null; verified: boolean } | null;
  post: { id: number; text: string | null } | null;
  /* Texte libre des notifications émises par la plateforme (modération). */
  message: string | null;
}

const MESSAGES: Record<string, string> = {
  follow: "s'est abonné à ton compte",
  like: 'a aimé ton post',
  repost: 'a reposté ton post',
  comment: 'a répondu à ton post',
  mention: "t'a mentionné",
};

function Icon({ type }: { type: string }) {
  const cls = 'w-8 h-8';
  switch (type) {
    case 'follow':
      return <UserPlus className={`${cls} text-[var(--accent)]`} />;
    case 'like':
      return <Heart className={`${cls} text-[var(--like-color)] fill-current`} />;
    case 'repost':
      return <Repeat2 className={`${cls} text-[var(--repost-color)]`} />;
    case 'comment':
      return <MessageCircle className={`${cls} text-[var(--accent)]`} />;
    case 'moderation':
      return <ShieldAlert className={`${cls} text-[var(--danger)]`} />;
    case 'report_outcome':
      return <CheckCircle2 className={`${cls} text-[var(--repost-color)]`} />;
    default:
      return <AtSign className={`${cls} text-[var(--accent)]`} />;
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<Notification[]>('/notifications');
      setNotifications(data);
      /* On les marque lues, puis on remet le badge à jour. */
      api
        .put('/notifications/read')
        .then(() => window.dispatchEvent(new Event(UNREAD_REFRESH_EVENT)))
        .catch(() => {});
    } catch {
      setError('Impossible de charger les notifications.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = notifications.filter((n) => {
    if (tab === 'mentions') return n.type === 'mention' || n.type === 'comment';
    if (tab === 'follows') return n.type === 'follow';
    if (tab === 'activity') return n.type === 'like' || n.type === 'repost';
    return true;
  });

  return (
    <AppShell>
      <PageHeader title="Notifications" back="/">
        <Tabs tabs={TABS} value={tab} onChange={setTab} labels={LABELS} />
      </PageHeader>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          <p className="mb-3">{error}</p>
          <button type="button" onClick={load} className="font-bold text-[var(--accent)]">
            Réessayer
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-secondary)]">Aucune notification</div>
      ) : (
        filtered.map((n) => {
          const isSystem = n.type === 'moderation' || n.type === 'report_outcome';
          const target = isSystem
            ? n.type === 'moderation'
              ? '/legal/regles'
              : '/'
            : n.post
              ? `/post/${n.post.id}`
              : n.actor
                ? `/${n.actor.pseudo}`
                : '/';
          return (
            <Link
              key={n.id}
              to={target}
              className={`flex gap-3 px-4 py-4 border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/50 transition-colors hover:no-underline ${!n.read ? 'bg-[var(--accent)]/5' : ''}`}
            >
              <div className="flex-shrink-0 mt-1">
                <Icon type={n.type} />
              </div>
              <div className="flex-1 min-w-0">
                {isSystem ? (
                  <p className="text-[var(--text-primary)]">
                    <span className="font-bold">{n.type === 'moderation' ? 'Modération Wouaff' : 'Signalement'}</span>
                    {' · '}
                    {n.message}
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    {n.actor && <Avatar src={n.actor.avatar} name={n.actor.pseudo} className="w-8 h-8 text-xs" />}
                    <p className="text-[var(--text-primary)]">
                      <span className="font-bold">{n.actor?.displayName || n.actor?.pseudo || 'Quelqu’un'}</span>{' '}
                      {MESSAGES[n.type] ?? 'a interagi avec toi'}
                    </p>
                  </div>
                )}
                {n.post && (
                  <p className="text-sm text-[var(--text-secondary)] mt-1 truncate">{n.post.text || 'Voir le post'}</p>
                )}
                <span className="text-xs text-[var(--text-secondary)]">{timeAgo(n.createdAt)}</span>
              </div>
            </Link>
          );
        })
      )}
    </AppShell>
  );
}
