import { AtSign, Heart, Repeat2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ComposeModal from '../components/ComposeModal';
import RightSidebar from '../components/RightSidebar';
import Sidebar from '../components/Sidebar';
import { api } from '../services/api';

const TABS = ['All', 'Verified', 'Mentions', 'VERIF'] as const;

interface NotifActor {
  uid: string;
  pseudo: string;
  displayName: string | null;
  avatar: string | null;
  verified: boolean;
}

interface Notification {
  id: number;
  type: string;
  read: boolean;
  createdAt: string;
  actor: NotifActor | null;
  post: { id: number; text: string | null } | null;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tab, setTab] = useState<string>('All');
  const [showCompose, setShowCompose] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Notification[]>('/notifications')
      .then((data) => {
        setNotifications(data);
        setLoading(false);
        api.put('/notifications/read').catch(() => {});
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = notifications.filter((n) => {
    if (tab === 'Verified') return n.type === 'follow';
    if (tab === 'Mentions') return n.type === 'mention';
    if (tab === 'VERIF') return n.type === 'like' || n.type === 'repost';
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'follow':
        return <UserPlus className="w-8 h-8 text-[var(--accent)]" />;
      case 'like':
        return <Heart className="w-8 h-8 text-[var(--like-color)] fill-current" />;
      case 'repost':
        return <Repeat2 className="w-8 h-8 text-[var(--repost-color)]" />;
      case 'mention':
        return <AtSign className="w-8 h-8 text-[var(--accent)]" />;
      default:
        return <Heart className="w-8 h-8 text-[var(--text-secondary)]" />;
    }
  };

  const getMessage = (type: string) => {
    switch (type) {
      case 'follow':
        return 'followed you';
      case 'like':
        return 'liked your post';
      case 'repost':
        return 'reposted your post';
      case 'mention':
        return 'mentioned you';
      default:
        return 'interacted with you';
    }
  };

  return (
    <div className="flex min-h-screen justify-center">
      <Sidebar onCompose={() => setShowCompose(true)} />

      <main className="flex-1 min-w-0 border-r border-[var(--border-color)] max-w-[600px] bg-[var(--bg-secondary)]">
        <div className="sticky top-0 z-40 bg-[var(--bg-secondary)]/80 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link
              to="/"
              className="text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] p-2 rounded-full transition-colors"
            >
              ←
            </Link>
            <h1 className="font-bold text-xl">Notifications</h1>
          </div>

          <div className="flex border-b border-[var(--border-color)]">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-medium transition-colors relative hover:bg-[var(--bg-tertiary)] ${
                  tab === t ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-secondary)]'
                }`}
              >
                {t}
                {tab === t && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[var(--accent)] rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">No notifications</div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              className={`flex gap-3 px-4 py-4 border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/50 transition-colors ${!n.read ? 'bg-[var(--accent)]/5' : ''}`}
            >
              <div className="flex-shrink-0 mt-1">{getIcon(n.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {n.actor && (
                    <Link
                      to={`/${n.actor.pseudo}`}
                      className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex-shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden"
                    >
                      {n.actor.avatar ? (
                        <img src={n.actor.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (n.actor.pseudo || '?')[0].toUpperCase()
                      )}
                    </Link>
                  )}
                  <p className="text-[var(--text-primary)]">
                    <Link to={`/${n.actor?.pseudo}`} className="font-bold hover:underline">
                      {n.actor?.displayName || n.actor?.pseudo || 'Someone'}
                    </Link>{' '}
                    {getMessage(n.type)}
                  </p>
                </div>
                {n.post && (
                  <p className="text-sm text-[var(--text-secondary)] mt-1 truncate">{n.post.text || 'View post'}</p>
                )}
                <span className="text-xs text-[var(--text-secondary)]">
                  {new Date(n.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </main>

      <RightSidebar />

      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} onPosted={() => {}} />}
    </div>
  );
}
