import { Router } from 'express';
import { query } from '../config/database.js';
import { patchRouter } from '../middleware/asyncHandler.js';
import { authMiddleware, currentUser } from '../middleware/auth.js';
import { byUser, rateLimit } from '../middleware/rateLimit.js';
import {
  createNotification,
  findUserByPseudo,
  isBlockedEitherWay,
  listBlocked,
  toggleBlock,
  toggleFollow,
} from '../services/rtdb.js';
import { escapeLike } from '../utils/validation.js';

const router = patchRouter(Router());
const actionLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, key: byUser });

interface UserRow {
  uid: string;
  pseudo: string;
  displayName: string | null;
  avatar: string | null;
  verified: number;
}

const toUser = (u: UserRow) => ({
  uid: u.uid,
  pseudo: u.pseudo,
  displayName: u.displayName,
  avatar: u.avatar,
  verified: !!u.verified,
});

router.post('/follows/:pseudo', authMiddleware, actionLimiter, async (req, res) => {
  try {
    const target = await findUserByPseudo(req.params.pseudo);
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const uid = currentUser(req).uid;
    if (target.uid === uid) return res.status(400).json({ error: 'Tu ne peux pas te suivre toi-même' });
    if (await isBlockedEitherWay(uid, target.uid)) return res.status(403).json({ error: 'Action impossible' });
    const nowFollowing = await toggleFollow(uid, target.uid);
    if (nowFollowing) await createNotification(target.uid, 'follow', uid);
    res.json({ following: nowFollowing });
  } catch (err) {
    console.error('[SOCIAL] Follow error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/blocks/:pseudo', authMiddleware, actionLimiter, async (req, res) => {
  try {
    const target = await findUserByPseudo(req.params.pseudo);
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const uid = currentUser(req).uid;
    if (target.uid === uid) return res.status(400).json({ error: 'Tu ne peux pas te bloquer toi-même' });
    res.json({ blocked: await toggleBlock(uid, target.uid) });
  } catch (err) {
    console.error('[SOCIAL] Block error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/blocks', authMiddleware, async (req, res) => {
  try {
    const rows = await listBlocked(currentUser(req).uid);
    res.json(rows.map((u) => ({ uid: u.uid, pseudo: u.pseudo, displayName: u.displayName, avatar: u.avatar })));
  } catch (err) {
    console.error('[SOCIAL] Blocks list error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* Suggestions : comptes les plus suivis que je ne suis pas encore (pas d'ORDER BY RAND()). */
router.get('/suggestions', authMiddleware, async (req, res) => {
  try {
    const uid = currentUser(req).uid;
    const suggestions = await query<UserRow[]>(
      `SELECT u.uid, u.pseudo, u.displayName, u.avatar, u.verified
       FROM users u
       WHERE u.uid <> ? AND u.status <> 'banned'
         AND u.uid NOT IN (SELECT followed_uid FROM follows WHERE follower_uid = ?)
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_uid = ? AND b.blocked_uid = u.uid) OR (b.blocker_uid = u.uid AND b.blocked_uid = ?))
       ORDER BY (SELECT COUNT(*) FROM follows f WHERE f.followed_uid = u.uid) DESC, u.createdAt DESC
       LIMIT 5`,
      [uid, uid, uid, uid],
    );
    res.json(suggestions.map(toUser));
  } catch (err) {
    console.error('[SOCIAL] Suggestions error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/search', authMiddleware, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().replace(/^@/, '').slice(0, 50) : '';
    if (q.length < 1) return res.json([]);
    const uid = currentUser(req).uid;
    const like = `%${escapeLike(q)}%`;
    const users = await query<UserRow[]>(
      `SELECT u.uid, u.pseudo, u.displayName, u.avatar, u.verified
       FROM users u
       WHERE (u.pseudo LIKE ? ESCAPE '!' OR u.displayName LIKE ? ESCAPE '!') AND u.status <> 'banned'
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_uid = ? AND b.blocked_uid = u.uid) OR (b.blocker_uid = u.uid AND b.blocked_uid = ?))
       ORDER BY (u.pseudo = ?) DESC, u.pseudo
       LIMIT 10`,
      [like, like, uid, uid, q],
    );
    res.json(users.map(toUser));
  } catch (err) {
    console.error('[SOCIAL] Search error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
