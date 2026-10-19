import { Router } from 'express';
import { patchRouter } from '../middleware/asyncHandler.js';
import { authMiddleware, currentUser } from '../middleware/auth.js';
import { getNotifications, getUnreadNotificationCount, markNotificationsRead } from '../services/rtdb.js';
import { toInt } from '../utils/validation.js';

const router = patchRouter(Router());

router.get('/', authMiddleware, async (req, res) => {
  try {
    const uid = currentUser(req).uid;
    const rows = await getNotifications(uid, toInt(req.query.limit, 50, 1, 100), toInt(req.query.offset, 0, 0, 100000));
    res.json(
      rows.map((n) => ({
        id: n.id,
        type: n.type,
        read: !!n.is_read,
        createdAt: n.created_at,
        actor: n.actor_uid
          ? {
              uid: n.actor_uid,
              pseudo: n.actor_pseudo,
              displayName: n.actor_name,
              avatar: n.actor_avatar,
              verified: !!n.actor_verified,
            }
          : null,
        post: n.post_id ? { id: n.post_id, text: n.post_text } : null,
      })),
    );
  } catch (err) {
    console.error('[NOTIFS] Get error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/unread', authMiddleware, async (req, res) => {
  try {
    res.json({ count: await getUnreadNotificationCount(currentUser(req).uid) });
  } catch (err) {
    console.error('[NOTIFS] Unread error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/read', authMiddleware, async (req, res) => {
  try {
    await markNotificationsRead(currentUser(req).uid);
    res.json({ ok: true });
  } catch (err) {
    console.error('[NOTIFS] Read error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
