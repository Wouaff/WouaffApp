import { Router } from 'express';
import { query } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { createNotification, findUserByPseudo, toggleFollow } from '../services/rtdb.js';

const router = Router();

router.post('/follows/:pseudo', authMiddleware, async (req, res) => {
  try {
    const target = await findUserByPseudo(req.params.pseudo);
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const uid = (req as any).user.uid;
    const nowFollowing = await toggleFollow(uid, target.uid);
    if (nowFollowing) {
      createNotification(target.uid, 'follow', uid);
    }
    res.json({ following: nowFollowing });
  } catch (err) {
    console.error('[SOCIAL] Follow error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/suggestions', authMiddleware, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const suggestions = await query<any[]>(
      `SELECT u.uid, u.pseudo, u.displayName, u.avatar, u.verified
       FROM users u
       WHERE u.uid != ? AND u.uid NOT IN (SELECT followed_uid FROM follows WHERE follower_uid = ?)
       ORDER BY RAND() LIMIT 5`,
      [uid, uid],
    );
    res.json(
      suggestions.map((s) => ({
        uid: s.uid,
        pseudo: s.pseudo,
        displayName: s.displayName,
        avatar: s.avatar,
        verified: !!s.verified,
      })),
    );
  } catch (err) {
    console.error('[SOCIAL] Suggestions error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/search', authMiddleware, async (req, res) => {
  try {
    const q = (req.query.q as string) || '';
    if (q.length < 1) return res.json([]);
    const users = await query<any[]>(
      `SELECT uid, pseudo, displayName, avatar, verified
       FROM users WHERE pseudo LIKE ? OR displayName LIKE ? LIMIT 10`,
      [`%${q}%`, `%${q}%`],
    );
    res.json(
      users.map((u) => ({
        uid: u.uid,
        pseudo: u.pseudo,
        displayName: u.displayName,
        avatar: u.avatar,
        verified: !!u.verified,
      })),
    );
  } catch (err) {
    console.error('[SOCIAL] Search error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
