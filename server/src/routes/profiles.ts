import { Router } from 'express';
import { getOne, query } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { findUserByPseudo, updateUser } from '../services/rtdb.js';

const router = Router();

router.get('/:pseudo', authMiddleware, async (req, res) => {
  try {
    const pseudo = req.params.pseudo;
    const user = await findUserByPseudo(pseudo);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const myUid = (req as any).user.uid;
    const followersCount = await getOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM follows WHERE followed_uid = ?',
      [user.uid],
    );
    const followingCount = await getOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM follows WHERE follower_uid = ?',
      [user.uid],
    );
    const tweetsCount = await getOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM posts WHERE uid = ? AND repost_of IS NULL',
      [user.uid],
    );
    const isFollowingUser = await getOne<any>(
      'SELECT follower_uid FROM follows WHERE follower_uid = ? AND followed_uid = ?',
      [myUid, user.uid],
    );
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
      followersCount: followersCount?.count || 0,
      followingCount: followingCount?.count || 0,
      tweetsCount: tweetsCount?.count || 0,
      isFollowing: !!isFollowingUser,
      isOwn: myUid === user.uid,
    });
  } catch (err) {
    console.error('[PROFILES] Get error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/me', authMiddleware, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const { displayName, bio, location, website, avatar, banner } = req.body;
    const fields: Record<string, unknown> = {};
    if (displayName !== undefined) fields.displayName = displayName;
    if (bio !== undefined) fields.bio = bio;
    if (location !== undefined) fields.location = location;
    if (website !== undefined) fields.website = website;
    if (avatar !== undefined) fields.avatar = avatar;
    if (banner !== undefined) fields.banner = banner;
    await updateUser(uid, fields);
    res.json({ ok: true });
  } catch (err) {
    console.error('[PROFILES] Update error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:pseudo/posts', authMiddleware, async (req, res) => {
  try {
    const pseudo = req.params.pseudo;
    const user = await findUserByPseudo(pseudo);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const myUid = (req as any).user.uid;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const posts = await query<any[]>(
      `SELECT p.*, u.pseudo, u.displayName, u.avatar, u.verified,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM posts WHERE repost_of = p.id) as reposts_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND uid = ?) as user_liked,
        (SELECT COUNT(*) FROM posts WHERE uid = ? AND repost_of = p.id) as user_reposted
        FROM posts p JOIN users u ON p.uid = u.uid
        WHERE p.uid = ? ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [myUid, myUid, user.uid, limit, offset],
    );
    res.json(
      posts.map((p) => ({
        id: p.id,
        text: p.text,
        image: p.image,
        createdAt: p.created_at,
        likesCount: p.likes_count,
        repostsCount: p.reposts_count,
        commentsCount: p.comments_count,
        userLiked: !!p.user_liked,
        userReposted: !!p.user_reposted,
        repostOf: p.repost_of,
        user: {
          uid: p.uid,
          pseudo: p.pseudo,
          displayName: p.displayName,
          avatar: p.avatar,
          verified: !!p.verified,
        },
      })),
    );
  } catch (err) {
    console.error('[PROFILES] Posts error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
