import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Server } from 'socket.io';
import { query } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';
import { createNotification } from '../services/notifications.js';
import {
  deleteUserProfile,
  getMutualContacts,
  getProfile,
  getPublicKey,
  getRandomUserSuggestions,
  getReverseContactUids,
  updateProfile,
} from '../services/rtdb.js';
import type { AuthRequest } from '../types/index.js';

const router: Router = Router();
router.use(verifyToken);

/* GET /profiles/me — mon propre profil */
router.get('/me', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const profile = await getProfile(authReq.uid!);
  if (!profile) {
    res.status(404).json({ error: 'Profil introuvable' });
    return;
  }
  res.json(profile);
});

/* GET /profiles/suggestions — comptes suggérés aléatoirement */
router.get('/suggestions', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const limit = Math.min(10, Math.max(1, parseInt(req.query.limit as string, 10) || 3));
  const suggestions = await getRandomUserSuggestions(authReq.uid!, limit);
  res.json({ results: suggestions });
});

/* GET /profiles/:uid */
router.get('/:uid', async (req: Request, res: Response) => {
  const profile = await getProfile(req.params.uid);
  if (!profile) {
    res.status(404).json({ error: 'Profil introuvable' });
    return;
  }
  res.json(profile);
});

/* GET /profiles/:uid/mutual — amis en commun */
router.get('/:uid/mutual', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const mutual = await getMutualContacts(authReq.uid!, req.params.uid);
  res.json(mutual);
});

/* POST /profiles/:uid/follow — suivre un utilisateur */
router.post('/:uid/follow', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (authReq.uid === req.params.uid) {
    res.status(400).json({ error: 'Impossible de se suivre soi-même' });
    return;
  }
  const target = await getProfile(req.params.uid);
  if (!target) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  const result = await query<{ affectedRows: number }>(
    'INSERT INTO follows (followerUid, followedUid, createdAt) VALUES (?,?,?) ON DUPLICATE KEY UPDATE createdAt=VALUES(createdAt)',
    [authReq.uid!, req.params.uid, Date.now()],
  );
  if (result.affectedRows === 1) {
    const io: Server = req.app.get('io');
    if (io) {
      await createNotification(io, { uid: req.params.uid, actorUid: authReq.uid!, type: 'follow' });
    }
  }
  res.json({ following: true });
});

/* DELETE /profiles/:uid/follow — ne plus suivre */
router.delete('/:uid/follow', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  await query('DELETE FROM follows WHERE followerUid = ? AND followedUid = ?', [authReq.uid!, req.params.uid]);
  res.json({ following: false });
});

/* GET /profiles/:uid/publicKey */
router.get('/:uid/publicKey', async (req: Request, res: Response) => {
  const key = await getPublicKey(req.params.uid);
  res.json({ publicKey: key });
});

/* PUT /profiles/me — mettre à jour mon profil */
router.put('/me', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (typeof req.body.pseudo === 'string' && /[A-Z]/.test(req.body.pseudo)) {
    res.status(400).json({ error: 'Le pseudo ne peut pas contenir de majuscules' });
    return;
  }
  await updateProfile(authReq.uid!, req.body);
  const io: Server = req.app.get('io');
  if (io) {
    const contactUids = await getReverseContactUids(authReq.uid!);
    for (const cu of contactUids) {
      io.to(`user:${cu}`).emit('profile:updated', { uid: authReq.uid!, ...req.body });
    }
  }
  res.json({ success: true });
});

/* DELETE /profiles/me — supprimer mon compte */
router.delete('/me', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  await deleteUserProfile(authReq.uid!);
  const io: Server = req.app.get('io');
  if (io) {
    const contactUids = await getReverseContactUids(authReq.uid!);
    for (const cu of contactUids) {
      io.to(`user:${cu}`).emit('account:deleted', { uid: authReq.uid! });
    }
  }
  res.json({ success: true });
});

/* PUT /profiles/me/publicKey — mettre à jour ma clé publique E2EE */
router.put('/me/publicKey', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { publicKey } = req.body as { publicKey: Record<string, unknown> };
  if (!publicKey) {
    res.status(400).json({ error: 'Clé publique requise' });
    return;
  }
  await updateProfile(authReq.uid!, { publicKey });
  const io: Server = req.app.get('io');
  if (io) {
    const contactUids = await getReverseContactUids(authReq.uid!);
    for (const cu of contactUids) {
      io.to(`user:${cu}`).emit('key:changed', { uid: authReq.uid! });
    }
  }
  res.json({ success: true });
});

export default router;
