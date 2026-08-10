import type { Server } from 'socket.io';
import { getOne, query } from '../config/database.js';
import type { NotificationItem, NotificationType } from '../types/index.js';

function toNotificationItem(row: Record<string, unknown>): NotificationItem {
  const wouaffId = (row.actorWouaffId as string) || '';
  return {
    id: row.id as number,
    type: row.type as NotificationType,
    actorUid: row.actorUid as string,
    actorPseudo: (row.actorPseudo as string) || 'Utilisateur',
    actorHandle: wouaffId ? `@${wouaffId}` : '@inconnu',
    actorAvatar: (row.actorAvatar as string) || undefined,
    postId: (row.postId as string) || null,
    postText: (row.postText as string) || null,
    postImage: (row.postImage as string) || null,
    commentId: (row.commentId as number) || null,
    read: (row.read as number) === 1,
    createdAt: row.createdAt as number,
  };
}

const NOTIFICATION_SELECT = `SELECT n.id, n.uid, n.actorUid, n.type, n.postId, n.commentId, n.read, n.createdAt,
            u.pseudo AS actorPseudo, u.wouaffId AS actorWouaffId, u.avatar AS actorAvatar,
            p.text AS postText, p.image AS postImage
     FROM notifications n
     LEFT JOIN users u ON u.uid = n.actorUid
     LEFT JOIN posts p ON p.id = n.postId`;

async function getNotificationItem(id: number): Promise<NotificationItem | null> {
  const row = await getOne<Record<string, unknown>>(`${NOTIFICATION_SELECT} WHERE n.id = ?`, [id]);
  return row ? toNotificationItem(row) : null;
}

/* Crée une notification, l'enregistre et l'envoie en temps réel au destinataire */
export async function createNotification(
  io: Server | null,
  opts: { uid: string; actorUid: string; type: NotificationType; postId?: string; commentId?: number },
): Promise<void> {
  const { uid, actorUid, type, postId, commentId } = opts;
  if (!uid || !actorUid || uid === actorUid) return;
  try {
    const result = await query<{ insertId: number }>(
      'INSERT INTO notifications (uid, actorUid, type, postId, commentId, read, createdAt) VALUES (?,?,?,?,?,0,?)',
      [uid, actorUid, type, postId || null, commentId ?? null, Date.now()],
    );
    const insertId = (result as unknown as { insertId?: number }).insertId || 0;
    if (!insertId) return;
    const item = await getNotificationItem(insertId);
    if (io && item) io.to(`user:${uid}`).emit('notification:new', item);
  } catch (err) {
    console.error('[NOTIFICATION]', err);
  }
}

export async function listNotifications(uid: string, limit = 50, before?: number): Promise<NotificationItem[]> {
  const rows = await query<Array<Record<string, unknown>>>(
    before
      ? `${NOTIFICATION_SELECT} WHERE n.uid = ? AND n.createdAt < ? ORDER BY n.createdAt DESC LIMIT ?`
      : `${NOTIFICATION_SELECT} WHERE n.uid = ? ORDER BY n.createdAt DESC LIMIT ?`,
    before ? [uid, before, limit] : [uid, limit],
  );
  return rows.map(toNotificationItem);
}

export async function getUnreadCount(uid: string): Promise<number> {
  const [row] = await query<Array<{ c: number }>>(
    'SELECT COUNT(*) AS c FROM notifications WHERE uid = ? AND read = 0',
    [uid],
  );
  return row?.c ?? 0;
}

export async function markNotificationRead(uid: string, id: number): Promise<void> {
  await query('UPDATE notifications SET read = 1 WHERE id = ? AND uid = ?', [id, uid]);
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  await query('UPDATE notifications SET read = 1 WHERE uid = ? AND read = 0', [uid]);
}
