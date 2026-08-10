import type { Request, Response } from 'express';
import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { removeFcmToken, setFcmToken } from '../services/rtdb.js';
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notifications.js';
import type { AuthRequest } from '../types/index.js';

const router: Router = Router();
router.use(verifyToken);

/* POST /notifications/fcm-token — enregistrer un token FCM */
router.post('/fcm-token', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { token } = req.body as { token: string };
  if (!token) {
    res.status(400).json({ error: 'Token requis' });
    return;
  }
  await setFcmToken(authReq.uid!, token);
  res.json({ success: true });
});

/* DELETE /notifications/fcm-token — supprimer un token FCM */
router.delete('/fcm-token', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { token } = req.body as { token: string };
  if (!token) {
    res.status(400).json({ error: 'Token requis' });
    return;
  }
  await removeFcmToken(authReq.uid!, token);
  res.json({ success: true });
});

/* GET /notifications — liste des notifications */
router.get('/', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const before = req.query.before ? parseInt(req.query.before as string, 10) || undefined : undefined;
  const items = await listNotifications(authReq.uid!, limit, before);
  const unread = await getUnreadCount(authReq.uid!);
  res.json({ items, unread });
});

/* GET /notifications/unread-count — nombre de notifications non lues */
router.get('/unread-count', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const count = await getUnreadCount(authReq.uid!);
  res.json({ count });
});

/* POST /notifications/read-all — tout marquer comme lu */
router.post('/read-all', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  await markAllNotificationsRead(authReq.uid!);
  res.json({ success: true });
});

/* POST /notifications/:id/read — marquer une notification comme lue */
router.post('/:id/read', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'ID invalide' });
    return;
  }
  await markNotificationRead(authReq.uid!, id);
  res.json({ success: true });
});

export default router;
