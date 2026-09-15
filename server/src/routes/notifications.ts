import { Router } from 'express';
import { query } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { getNotifications, getUnreadNotificationCount, markNotificationsRead } from '../services/rtdb.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const notifications = await getNotifications(uid, limit, offset);

    // Enrich with actor info
    const enriched = await Promise.all(
      notifications.map(async (n) => {
        let actor: any = null;
        if (n.actor_uid) {
          actor = await query<any>('SELECT uid, pseudo, displayName, avatar, verified FROM users WHERE uid = ?', [
            n.actor_uid,
          ]).then((rows) => rows[0] || null);
        }
        let post: any = null;
        if (n.post_id) {
          post = await query<any>('SELECT id, text FROM posts WHERE id = ?', [n.post_id]).then(
            (rows) => rows[0] || null,
          );
        }
        return {
          id: n.id,
          type: n.type,
          read: !!n.is_read,
          createdAt: n.created_at,
          actor: actor
            ? {
                uid: actor.uid,
                pseudo: actor.pseudo,
                displayName: actor.displayName,
                avatar: actor.avatar,
                verified: !!actor.verified,
              }
            : null,
          post: post ? { id: post.id, text: post.text } : null,
        };
      }),
    );

    res.json(enriched);
  } catch (err) {
    console.error('[NOTIFS] Get error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/unread', authMiddleware, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const count = await getUnreadNotificationCount(uid);
    res.json({ count });
  } catch (err) {
    console.error('[NOTIFS] Unread error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/read', authMiddleware, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    await markNotificationsRead(uid);
    res.json({ ok: true });
  } catch (err) {
    console.error('[NOTIFS] Read error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
