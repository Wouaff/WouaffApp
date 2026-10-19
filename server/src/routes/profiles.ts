import { Router } from 'express';
import { getOne, query } from '../config/database.js';
import { patchRouter } from '../middleware/asyncHandler.js';
import { authMiddleware, currentUser } from '../middleware/auth.js';
import { fetchPosts, filters } from '../services/postQuery.js';
import { findUserByPseudo, isBlockedEitherWay, updateUser } from '../services/rtdb.js';

/* Un compte banni n'a plus de profil public. */
async function findVisibleUser(pseudo: string) {
  const user = await findUserByPseudo(pseudo);
  return user && user.status !== 'banned' ? user : null;
}

import { uploadExists } from '../services/uploads.js';
import { isSafeUploadPath, normalizeWebsite, toInt } from '../utils/validation.js';

const router = patchRouter(Router());

interface UserListRow {
  uid: string;
  pseudo: string;
  displayName: string | null;
  avatar: string | null;
  verified: number;
  isFollowing: number;
}

router.get('/:pseudo', authMiddleware, async (req, res) => {
  try {
    const user = await findVisibleUser(req.params.pseudo);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const myUid = currentUser(req).uid;
    const [counts, isFollowingUser, blockedByMe, blockedMe] = await Promise.all([
      getOne<{ followers: number; following: number; posts: number }>(
        `SELECT
           (SELECT COUNT(*) FROM follows WHERE followed_uid = ?) AS followers,
           (SELECT COUNT(*) FROM follows WHERE follower_uid = ?) AS following,
           (SELECT COUNT(*) FROM posts WHERE uid = ? AND repost_of IS NULL) AS posts`,
        [user.uid, user.uid, user.uid],
      ),
      getOne<unknown>('SELECT follower_uid FROM follows WHERE follower_uid = ? AND followed_uid = ?', [
        myUid,
        user.uid,
      ]),
      getOne<unknown>('SELECT blocker_uid FROM blocks WHERE blocker_uid = ? AND blocked_uid = ?', [myUid, user.uid]),
      getOne<unknown>('SELECT blocker_uid FROM blocks WHERE blocker_uid = ? AND blocked_uid = ?', [user.uid, myUid]),
    ]);
    res.json({
      uid: user.uid,
      pseudo: user.pseudo,
      displayName: user.displayName,
      avatar: user.avatar,
      banner: user.banner,
      bio: user.bio,
      location: user.location,
      website: user.website,
      verified: !!user.verified,
      createdAt: user.createdAt,
      followersCount: counts?.followers || 0,
      followingCount: counts?.following || 0,
      tweetsCount: counts?.posts || 0,
      isFollowing: !!isFollowingUser,
      isBlocked: !!blockedByMe,
      hasBlockedMe: !!blockedMe,
      isOwn: myUid === user.uid,
    });
  } catch (err) {
    console.error('[PROFILES] Get error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/me', authMiddleware, async (req, res) => {
  try {
    const uid = currentUser(req).uid;
    const { displayName, bio, location, website, avatar, banner } = req.body ?? {};
    const fields: Record<string, unknown> = {};

    const text = (value: unknown, max: number, label: string): string | null | undefined | Error => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value !== 'string' || value.trim().length > max)
        return new Error(`${label} : ${max} caractères maximum`);
      return value.trim() || null;
    };

    for (const [key, raw, max, label] of [
      ['displayName', displayName, 50, 'Nom affiché'],
      ['bio', bio, 160, 'Bio'],
      ['location', location, 100, 'Localisation'],
    ] as const) {
      const v = text(raw, max, label);
      if (v instanceof Error) return res.status(400).json({ error: v.message });
      if (v !== undefined) fields[key] = v;
    }

    if (website !== undefined) {
      const url = normalizeWebsite(website);
      if (url === undefined)
        return res.status(400).json({ error: 'Site web invalide (http:// ou https:// uniquement)' });
      fields.website = url;
    }
    for (const [key, value] of [
      ['avatar', avatar],
      ['banner', banner],
    ] as const) {
      if (value === undefined) continue;
      if (value !== null && (!isSafeUploadPath(value) || !uploadExists(value))) {
        return res.status(400).json({ error: 'Image invalide' });
      }
      fields[key] = value;
    }

    await updateUser(uid, fields);
    res.json({ ok: true });
  } catch (err) {
    console.error('[PROFILES] Update error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:pseudo/posts', authMiddleware, async (req, res) => {
  try {
    const user = await findVisibleUser(req.params.pseudo);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const myUid = currentUser(req).uid;
    if (user.uid !== myUid && (await isBlockedEitherWay(myUid, user.uid))) return res.json([]);
    const filter = req.query.tab === 'reposts' ? filters.profileReposts(user.uid) : filters.profilePosts(user.uid);
    res.json(
      await fetchPosts(myUid, filter, toInt(req.query.limit, 20, 1, 100), toInt(req.query.offset, 0, 0, 100000)),
    );
  } catch (err) {
    console.error('[PROFILES] Posts error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:pseudo/replies', authMiddleware, async (req, res) => {
  try {
    const user = await findVisibleUser(req.params.pseudo);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const myUid = currentUser(req).uid;
    if (user.uid !== myUid && (await isBlockedEitherWay(myUid, user.uid))) return res.json([]);
    const limit = toInt(req.query.limit, 20, 1, 100);
    const offset = toInt(req.query.offset, 0, 0, 100000);
    const rows = await query<
      { id: number; text: string; created_at: string; post_id: number; post_text: string | null; post_pseudo: string }[]
    >(
      `SELECT c.id, c.text, c.created_at, p.id AS post_id, p.text AS post_text, pu.pseudo AS post_pseudo
       FROM comments c
       JOIN posts p ON p.id = c.post_id
       JOIN users pu ON pu.uid = p.uid
       WHERE c.uid = ?
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [user.uid],
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        text: r.text,
        createdAt: r.created_at,
        post: { id: r.post_id, text: r.post_text, pseudo: r.post_pseudo },
      })),
    );
  } catch (err) {
    console.error('[PROFILES] Replies error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

async function followList(req: Parameters<typeof currentUser>[0], column: 'follower_uid' | 'followed_uid') {
  const user = await findVisibleUser((req.params as { pseudo: string }).pseudo);
  if (!user) return null;
  const myUid = currentUser(req).uid;
  const other = column === 'follower_uid' ? 'followed_uid' : 'follower_uid';
  const limit = toInt(req.query.limit, 30, 1, 100);
  const offset = toInt(req.query.offset, 0, 0, 100000);
  const rows = await query<UserListRow[]>(
    `SELECT u.uid, u.pseudo, u.displayName, u.avatar, u.verified,
            (SELECT COUNT(*) FROM follows mine WHERE mine.follower_uid = ? AND mine.followed_uid = u.uid) AS isFollowing
     FROM follows f JOIN users u ON u.uid = f.${column}
     WHERE f.${other} = ? AND u.status <> 'banned'
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_uid = ? AND b.blocked_uid = u.uid) OR (b.blocker_uid = u.uid AND b.blocked_uid = ?))
     ORDER BY f.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    [myUid, user.uid, myUid, myUid],
  );
  return rows.map((r) => ({
    uid: r.uid,
    pseudo: r.pseudo,
    displayName: r.displayName,
    avatar: r.avatar,
    verified: !!r.verified,
    isFollowing: !!r.isFollowing,
    isOwn: r.uid === myUid,
  }));
}

router.get('/:pseudo/followers', authMiddleware, async (req, res) => {
  try {
    const list = await followList(req, 'follower_uid');
    if (!list) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(list);
  } catch (err) {
    console.error('[PROFILES] Followers error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:pseudo/following', authMiddleware, async (req, res) => {
  try {
    const list = await followList(req, 'followed_uid');
    if (!list) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(list);
  } catch (err) {
    console.error('[PROFILES] Following error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
