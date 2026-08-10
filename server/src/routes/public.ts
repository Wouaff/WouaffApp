import { parseCookie } from 'cookie';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { getOne, query } from '../config/database.js';
import { getBadges, getProfile, searchByWouaffId } from '../services/rtdb.js';

const router: Router = Router();

async function getOptionalUid(req: Request): Promise<string | null> {
  let sessionId = (req.cookies as { session_id?: string } | undefined)?.session_id as string | undefined;
  if (!sessionId && req.headers.cookie) {
    try {
      sessionId = parseCookie(req.headers.cookie).session_id;
    } catch {
      sessionId = undefined;
    }
  }
  if (!sessionId) return null;
  const session = await getOne<{ uid: string }>('SELECT uid FROM sessions WHERE sessionId = ?', [sessionId]);
  return session?.uid || null;
}

async function count(sql: string, param: string): Promise<number> {
  const rows = await query<Array<{ c: number }>>(sql, [param]);
  return rows[0]?.c || 0;
}

router.get('/profile/:wouaffId', async (req: Request, res: Response) => {
  try {
    let wouaffId = req.params.wouaffId;
    if (!wouaffId.startsWith('@')) wouaffId = `@${wouaffId}`;
    const uid = await searchByWouaffId(wouaffId);
    if (!uid) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    const [profile, badges, viewerUid] = await Promise.all([getProfile(uid), getBadges(), getOptionalUid(req)]);
    if (!profile) {
      res.status(404).json({ error: 'Profil introuvable' });
      return;
    }
    const [followersCount, followingCount, postsCount, staff] = await Promise.all([
      count('SELECT COUNT(*) AS c FROM follows WHERE followedUid = ?', uid),
      count('SELECT COUNT(*) AS c FROM follows WHERE followerUid = ?', uid),
      count('SELECT COUNT(*) AS c FROM posts WHERE uid = ?', uid),
      getOne<{ uid: string }>('SELECT uid FROM staff WHERE uid = ?', [uid]),
    ]);
    let isFollowing = false;
    if (viewerUid && viewerUid !== uid) {
      const f = await getOne<{ followerUid: string }>(
        'SELECT followerUid FROM follows WHERE followerUid = ? AND followedUid = ?',
        [viewerUid, uid],
      );
      isFollowing = !!f;
    }
    res.json({
      uid,
      profile,
      badges,
      followersCount,
      followingCount,
      postsCount,
      isFollowing,
      isMe: viewerUid === uid,
      verified: !!staff,
    });
  } catch {
    res.status(500).json({ error: 'Erreur lors du chargement du profil' });
  }
});

export default router;
