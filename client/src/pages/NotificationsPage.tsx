import { Bell, CheckCheck, Heart, MessageCircle, Repeat2, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../components/Common/Toast';
import LeftNav from '../components/Home/LeftNav';
import RightSidebar from '../components/Home/RightSidebar';
import { useAuth } from '../hooks/useAuth';
import { notifications as notificationsAPI } from '../services/api';
import { offNotificationNew, onNotificationNew } from '../services/socket';
import type { NotificationItem } from '../types';
import {
  notificationPermission,
  requestNotificationPermission,
  showBrowserNotification,
} from '../utils/browserNotifications';

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'hier';
  return `il y a ${d} j`;
}

function notifTitle(item: NotificationItem): string {
  switch (item.type) {
    case 'follow':
      return `${item.actorPseudo} a suivi votre compte`;
    case 'like':
      return `${item.actorPseudo} a aimé votre post`;
    case 'repost':
      return `${item.actorPseudo} a repartagé votre post`;
    case 'comment':
      return `${item.actorPseudo} a commenté votre post`;
    default:
      return 'Nouvelle notification';
  }
}

function notifVerb(item: NotificationItem): string {
  switch (item.type) {
    case 'follow':
      return 'a suivi votre compte';
    case 'like':
      return 'a aimé votre post';
    case 'repost':
      return 'a repartagé votre post';
    case 'comment':
      return 'a commenté votre post';
    default:
      return '';
  }
}

function notifUrl(item: NotificationItem): string {
  if (item.type === 'follow') {
    return item.actorHandle && item.actorHandle !== '@inconnu'
      ? `/@${item.actorHandle.replace(/^@/, '')}`
      : `/@${item.actorUid}`;
  }
  return '/';
}

function dispatchUnread(count: number): void {
  window.dispatchEvent(new CustomEvent('wouaff:unread-count', { detail: { count } }));
}

const TYPE_ICONS: Record<NotificationItem['type'], { Icon: typeof Bell; cls: string }> = {
  like: { Icon: Heart, cls: 'text-red-500 bg-red-500/10' },
  repost: { Icon: Repeat2, cls: 'text-online bg-online/10' },
  comment: { Icon: MessageCircle, cls: 'text-brand bg-[var(--brand-glow)]' },
  follow: { Icon: UserPlus, cls: 'text-brand bg-[var(--brand-glow)]' },
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifOn, setNotifOn] = useState(notificationPermission() === 'granted');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationsAPI.list(50);
      setItems(data.items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    dispatchUnread(items.filter((n) => !n.read).length);
  }, [items]);

  useEffect(() => {
    if (!user) return;
    const onNew = (item: NotificationItem) => {
      setItems((prev) => (prev.some((n) => n.id === item.id) ? prev : [item, ...prev]));
      showBrowserNotification(notifTitle(item), {
        body: item.postText || undefined,
        url: notifUrl(item),
      });
    };
    onNotificationNew(onNew);
    return () => offNotificationNew(onNew);
  }, [user]);

  const enableBrowser = async () => {
    const granted = await requestNotificationPermission();
    setNotifOn(granted);
    showToast(
      granted ? 'Notifications du navigateur activées !' : 'Permission de notification refusée',
      granted ? 'success' : 'error',
    );
  };

  const markAll = async () => {
    try {
      await notificationsAPI.markAllRead();
    } catch {
      /* silencieux */
    }
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast('Tout est marqué comme lu', 'success');
  };

  const open = async (item: NotificationItem) => {
    if (!item.read) {
      try {
        await notificationsAPI.markRead(item.id);
      } catch {
        /* silencieux */
      }
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    }
    if (item.type === 'follow') {
      navigate(notifUrl(item));
      return;
    }
    if (item.postId) {
      navigate(`/?post=${encodeURIComponent(item.postId)}`);
    }
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="flex h-full">
      <LeftNav />
      <main className="flex-1 min-w-0 h-full overflow-y-auto border-x border-[var(--border)] bg-[var(--bg-deep)]">
        <header className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-[12px] border-b border-[var(--border)]">
          <div className="flex items-center justify-between px-4 h-14">
            <h1 className="text-xl font-extrabold m-0 text-[var(--text-primary)]">
              Notifications
              {unread > 0 && (
                <span className="ml-2 align-middle text-[13px] font-bold text-brand bg-[var(--brand-glow)] rounded-full px-2.5 py-0.5">
                  {unread} nouvelle{unread > 1 ? 's' : ''}
                </span>
              )}
            </h1>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="flex items-center gap-1.5 text-[13px] font-bold text-brand rounded-full border-none bg-transparent cursor-pointer px-3 py-1.5 hover:bg-[var(--brand-glow)] transition-colors"
              >
                <CheckCheck size={16} />
                Tout marquer lu
              </button>
            )}
          </div>
        </header>

        {notifOn ? (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
            <span className="w-9 h-9 rounded-full bg-[var(--brand-glow)] flex items-center justify-center flex-shrink-0">
              <Bell size={16} className="text-brand" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold text-[var(--text-primary)]">Notifications du navigateur</div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                Alertes actives — vous serez notifié même en dehors de l'onglet
              </div>
            </div>
            <span className="text-[12px] font-bold text-online flex-shrink-0">Activées</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={enableBrowser}
            className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] w-full text-left bg-[var(--bg-card)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
          >
            <span className="w-9 h-9 rounded-full bg-[var(--brand-glow)] flex items-center justify-center flex-shrink-0">
              <Bell size={16} className="text-brand" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold text-[var(--text-primary)]">Notifications du navigateur</div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                Recevoir une alerte système même onglet fermé
              </div>
            </div>
            <span className="text-brand font-bold text-[13px] flex-shrink-0">Activer</span>
          </button>
        )}

        {loading ? (
          <div className="py-16 px-6 flex flex-col items-center gap-3">
            <div className="spinner" />
            <p className="m-0 text-sm text-[var(--text-muted)]">Chargement des notifications...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 px-6 flex flex-col items-center gap-4 text-center">
            <span className="w-16 h-16 rounded-full bg-[var(--brand-glow)] flex items-center justify-center">
              <Bell size={28} className="text-brand" />
            </span>
            <p className="m-0 text-[15px] text-[var(--text-primary)] font-bold">Aucune notification pour le moment</p>
            <p className="m-0 text-[13px] text-[var(--text-secondary)] max-w-[340px]">
              Les likes, reposts, commentaires et nouveaux abonnements apparaîtront ici.
            </p>
          </div>
        ) : (
          <ul className="list-none m-0 p-0">
            {items.map((item) => {
              const { Icon, cls } = TYPE_ICONS[item.type];
              const initial = (item.actorPseudo || '?')[0]?.toUpperCase() || '?';
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => open(item)}
                    className={`w-full flex gap-3 px-4 py-3.5 text-left border-b border-[var(--border)] cursor-pointer transition-colors ${
                      item.read
                        ? 'bg-transparent hover:bg-[var(--bg-hover)]'
                        : 'bg-[rgba(249,123,59,0.14)] hover:bg-[rgba(249,123,59,0.22)] border-l-[3px] border-l-brand'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-base overflow-hidden">
                        {item.actorAvatar ? (
                          <img src={item.actorAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{initial}</span>
                        )}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 border-[var(--bg-base)] ${cls}`}
                      >
                        <Icon size={12} />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <p className="m-0 text-[14px] leading-snug">
                        <span className="font-bold text-[var(--text-primary)]">{item.actorPseudo}</span>{' '}
                        <span className="text-[var(--text-primary)]">{notifVerb(item)}</span>
                        {!item.read && (
                          <span
                            className="ml-2 inline-block w-2 h-2 rounded-full bg-brand align-middle"
                            aria-label="Non lue"
                          />
                        )}
                      </p>
                      {item.postText && (
                        <div className="mt-1.5 flex items-center gap-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] px-3 py-2">
                          {item.postImage && (
                            <img
                              src={item.postImage}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                              loading="lazy"
                              decoding="async"
                            />
                          )}
                          <span className="text-[13px] text-[var(--text-secondary)] truncate">{item.postText}</span>
                        </div>
                      )}
                      <p className="m-0 mt-1 text-[12px] text-[var(--text-muted)]">{formatTime(item.createdAt)}</p>
                    </div>
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
