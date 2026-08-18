import { IonButton, IonIcon, IonItem, IonLabel, IonList } from '@ionic/react';
import { chatbubble, checkmarkDone, heart, personAdd, repeat } from 'ionicons/icons';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../../components/Common/Toast';
import { communities as communitiesAPI, notifications as notificationsAPI } from '../../services/api';
import { offNotificationNew, onNotificationNew } from '../../services/socket';
import type { NotificationItem } from '../../types';
import MobilePage from '../MobilePage';
import { MobileEmpty, MobileSkeleton } from '../MobileState';

const TYPE_META: Record<NotificationItem['type'], { icon: string; color: string }> = {
  like: { icon: heart, color: 'var(--danger)' },
  repost: { icon: repeat, color: 'var(--online)' },
  comment: { icon: chatbubble, color: 'var(--brand)' },
  follow: { icon: personAdd, color: 'var(--brand)' },
  community_reply: { icon: chatbubble, color: 'var(--brand)' },
  community_mention: { icon: personAdd, color: 'var(--brand)' },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export default function NotificationsMobile() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

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
    const onNew = (item: NotificationItem) => {
      setItems((prev) => (prev.some((n) => n.id === item.id) ? prev : [item, ...prev]));
    };
    onNotificationNew(onNew);
    return () => offNotificationNew(onNew);
  }, []);

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
    if (item.type === 'follow' && item.actorHandle && item.actorHandle !== '@inconnu') {
      navigate(`/@${item.actorHandle.replace(/^@/, '')}`);
      return;
    }
    if (item.type === 'community_reply' || item.type === 'community_mention') {
      if (!item.postId) return;
      try {
        const post = await communitiesAPI.getPost(item.postId);
        navigate(`/c/${encodeURIComponent(post.communityName)}/p/${encodeURIComponent(post.id)}`);
      } catch {
        navigate('/communities');
      }
      return;
    }
    if (item.postId) navigate(`/?post=${encodeURIComponent(item.postId)}`);
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <MobilePage
      title="Notifications"
      onRefresh={load}
      rightSlot={
        unread > 0 ? (
          <IonButton size="small" onClick={markAll}>
            <IonIcon slot="icon-only" icon={checkmarkDone} />
          </IonButton>
        ) : undefined
      }
    >
      {loading ? (
        <MobileSkeleton count={6} />
      ) : items.length === 0 ? (
        <MobileEmpty
          icon={<IonIcon icon={checkmarkDone} />}
          title="Tout est calme"
          text="Tes notifications apparaîtront ici quand quelqu'un interagira avec tes posts."
        />
      ) : (
        <IonList>
          {items.map((n) => {
            const meta = TYPE_META[n.type];
            return (
              <IonItem key={n.id} button onClick={() => open(n)} detail={false}>
                <div
                  slot="start"
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${meta.color}20`, color: meta.color }}
                >
                  <IonIcon icon={meta.icon} />
                </div>
                <IonLabel className="ion-text-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-bold text-[var(--text-primary)]">
                      {n.actorPseudo || "Quelqu'un"}
                    </span>
                    {!n.read && (
                      <span role="img" className="h-2 w-2 rounded-full bg-brand flex-shrink-0" aria-label="Non lue" />
                    )}
                  </div>
                  <p className="m-0 text-[13px] text-[var(--text-secondary)]">
                    {n.type === 'follow' && 'a suivi votre compte'}
                    {n.type === 'like' && 'a aimé votre post'}
                    {n.type === 'repost' && 'a repartagé votre post'}
                    {n.type === 'comment' && 'a commenté votre post'}
                  </p>
                  {n.postText && <p className="m-0 text-[12px] text-[var(--text-muted)] truncate">{n.postText}</p>}
                  <p className="m-0 text-[11px] text-[var(--text-muted)]">{timeAgo(n.createdAt)}</p>
                </IonLabel>
              </IonItem>
            );
          })}
        </IonList>
      )}
    </MobilePage>
  );
}
