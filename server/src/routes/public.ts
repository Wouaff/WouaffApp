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

async function resolveUid(wouaffId: string): Promise<string | null> {
  let id = wouaffId;
  if (!id.startsWith('@')) id = `@${id}`;
  return searchByWouaffId(id);
}

async function getFollowList(
  uid: string,
  viewerUid: string | null,
  kind: 'followers' | 'following',
): Promise<
  Array<{
    uid: string;
    pseudo: string;
    avatar: string | null;
    wouaffId: string | null;
    isFollowing: boolean;
    isMe: boolean;
  }>
> {
  const rows = await query<Array<{ uid: string; pseudo: string; avatar: string | null; wouaffId: string | null }>>(
    kind === 'followers'
      ? 'SELECT p.uid, p.pseudo, p.avatar, p.wouaffId FROM follows f JOIN users p ON p.uid = f.followerUid WHERE f.followedUid = ? ORDER BY f.createdAt DESC'
      : 'SELECT p.uid, p.pseudo, p.avatar, p.wouaffId FROM follows f JOIN users p ON p.uid = f.followedUid WHERE f.followerUid = ? ORDER BY f.createdAt DESC',
    [uid],
  );
  if (rows.length === 0 || !viewerUid) {
    return rows.map((r) => ({ ...r, isFollowing: false, isMe: viewerUid === r.uid }));
  }
  const placeholders = rows.map(() => '?').join(',');
  const followRows = await query<Array<{ followerUid: string }>>(
    `SELECT followerUid FROM follows WHERE followerUid = ? AND followedUid IN (${placeholders})`,
    [viewerUid, ...rows.map((r) => r.uid)],
  );
  const followingSet = new Set(followRows.map((r) => r.followerUid));
  return rows.map((r) => ({ ...r, isFollowing: followingSet.has(r.uid), isMe: viewerUid === r.uid }));
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

router.get('/profile/:wouaffId/followers', async (req: Request, res: Response) => {
  try {
    const uid = await resolveUid(req.params.wouaffId);
    if (!uid) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    const viewerUid = await getOptionalUid(req);
    const list = await getFollowList(uid, viewerUid, 'followers');
    res.json({ users: list });
  } catch {
    res.status(500).json({ error: 'Erreur lors du chargement des abonnés' });
  }
});

router.get('/profile/:wouaffId/following', async (req: Request, res: Response) => {
  try {
    const uid = await resolveUid(req.params.wouaffId);
    if (!uid) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    const viewerUid = await getOptionalUid(req);
    const list = await getFollowList(uid, viewerUid, 'following');
    res.json({ users: list });
  } catch {
    res.status(500).json({ error: 'Erreur lors du chargement des abonnements' });
  }
});

/* GET /public/posts/:id, un post partageable (sans authentification) */
router.get('/posts/:id', async (req: Request, res: Response) => {
  try {
    const row = await getOne<Record<string, unknown>>(
      `SELECT p.id, p.uid, p.text, p.image, p.audio, p.audioDuration, p.poll, p.likesCount, p.repostsCount, p.commentsCount, p.createdAt,
              pr.pseudo, pr.avatar, pr.wouaffId, s.uid AS staffUid
       FROM posts p
       LEFT JOIN users pr ON pr.uid = p.uid
       LEFT JOIN staff s ON s.uid = p.uid
       WHERE p.id = ?`,
      [req.params.id],
    );
    if (!row) {
      res.status(404).json({ error: 'Post introuvable' });
      return;
    }
    let poll: Record<string, unknown> | null = null;
    if (row.poll) {
      try {
        const parsed = JSON.parse(row.poll as string) as { question?: string; options?: string[] };
        if (Array.isArray(parsed.options) && parsed.options.length > 0) {
          const votes = await query<Array<{ postId: string; optionIndex: number }>>(
            'SELECT postId, optionIndex FROM poll_votes WHERE postId = ?',
            [req.params.id],
          );
          const counts = new Array(parsed.options.length).fill(0);
          for (const v of votes) counts[v.optionIndex] = (counts[v.optionIndex] || 0) + 1;
          poll = {
            question: parsed.question || 'Sondage',
            options: parsed.options,
            votes: counts,
            total: votes.length,
            votedIndex: null,
          };
        }
      } catch {
        /* sondage invalide ignoré */
      }
    }
    res.json({
      id: row.id,
      uid: row.uid,
      pseudo: (row.pseudo as string) || 'Utilisateur',
      handle: (row.wouaffId as string) ? `@${row.wouaffId}` : '@inconnu',
      avatar: row.avatar as string,
      time: row.createdAt as number,
      text: row.text as string,
      image: (row.image as string) || undefined,
      audio: (row.audio as string) || undefined,
      audioDuration: (row.audioDuration as number) || 0,
      poll: poll || undefined,
      likes: row.likesCount as number,
      reposts: row.repostsCount as number,
      comments: row.commentsCount as number,
      liked: false,
      reposted: false,
      verified: !!row.staffUid,
    });
  } catch {
    res.status(500).json({ error: 'Erreur lors du chargement du post' });
  }
});

export default router;
