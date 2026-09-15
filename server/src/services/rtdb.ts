import { getOne, query } from '../config/database.js';
import { countHashtags, type HashtagTrend } from '../utils/hashtags.js';

export interface User {
  uid: string;
  pseudo: string | null;
  email: string;
  passwordHash: string;
  displayName: string | null;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  verified: number;
  createdAt: number;
}

export async function findUserByEmail(email: string) {
  return getOne<User>('SELECT * FROM users WHERE email = ?', [email]);
}

export async function findUserByPseudo(pseudo: string) {
  return getOne<User>('SELECT * FROM users WHERE pseudo = ?', [pseudo]);
}

export async function findUserByUid(uid: string) {
  return getOne<User>('SELECT * FROM users WHERE uid = ?', [uid]);
}

export async function createUser(uid: string, pseudo: string, email: string, passwordHash: string) {
  await query('INSERT INTO users (uid, pseudo, email, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?)', [
    uid,
    pseudo,
    email,
    passwordHash,
    Date.now(),
  ]);
}

export async function updateUser(uid: string, fields: Record<string, unknown>) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `\`${k}\` = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  await query(`UPDATE users SET ${sets} WHERE uid = ?`, [...values, uid]);
}

export async function createSession(id: string, uid: string, expiresAt: number, userAgent?: string) {
  await query('INSERT INTO sessions (id, uid, expires_at, user_agent) VALUES (?, ?, ?, ?)', [
    id,
    uid,
    expiresAt,
    userAgent || null,
  ]);
}

export async function findSession(id: string) {
  return getOne<{ id: string; uid: string; expires_at: number }>(
    'SELECT id, uid, expires_at FROM sessions WHERE id = ?',
    [id],
  );
}

export async function deleteSession(id: string) {
  await query('DELETE FROM sessions WHERE id = ?', [id]);
}

/* Nombre de posts récents examinés pour calculer les tendances. */
const TREND_SCAN_LIMIT = 5000;

/**
 * Tendances calculées depuis les posts : un hashtag compte une fois par post qui le
 * contient. `days = 0` couvre tout l'historique, sinon fenêtre glissante en jours.
 * Le calcul se fait à la lecture : aucune table d'occurrences à maintenir.
 */
export async function getTrendingHashtags(days = 0, limit = 10): Promise<HashtagTrend[]> {
  const window = Math.max(0, Math.trunc(days));
  const rows = await query<{ text: string | null }[]>(
    `SELECT text FROM posts
     WHERE text IS NOT NULL AND text LIKE '%#%'${window > 0 ? ` AND created_at >= NOW() - INTERVAL ${window} DAY` : ''}
     ORDER BY created_at DESC
     LIMIT ${TREND_SCAN_LIMIT}`,
  );
  return countHashtags(rows.map((row) => row.text)).slice(0, Math.max(1, Math.trunc(limit)));
}

export async function createPost(
  uid: string,
  text: string | null,
  image: string | null,
  repostOf?: number,
  video?: string | null,
) {
  const result = await query<{ insertId: number }>(
    'INSERT INTO posts (uid, text, image, video, repost_of) VALUES (?, ?, ?, ?, ?)',
    [uid, text, image, video || null, repostOf || null],
  );
  return result.insertId;
}

export async function deletePost(postId: number, uid: string) {
  await query('DELETE FROM posts WHERE id = ? AND uid = ?', [postId, uid]);
}

export async function findPostById(postId: number) {
  return getOne<any>('SELECT * FROM posts WHERE id = ?', [postId]);
}

export async function toggleLike(uid: string, postId: number) {
  const existing = await getOne<{ uid: string }>('SELECT uid FROM likes WHERE uid = ? AND post_id = ?', [uid, postId]);
  if (existing) {
    await query('DELETE FROM likes WHERE uid = ? AND post_id = ?', [uid, postId]);
    return false;
  }
  await query('INSERT INTO likes (uid, post_id) VALUES (?, ?)', [uid, postId]);
  return true;
}

export async function toggleRepost(uid: string, postId: number) {
  const existing = await getOne<{ uid: string }>('SELECT uid FROM posts WHERE uid = ? AND repost_of = ?', [
    uid,
    postId,
  ]);
  if (existing) {
    await query('DELETE FROM posts WHERE uid = ? AND repost_of = ?', [uid, postId]);
    return false;
  }
  await query('INSERT INTO posts (uid, repost_of) VALUES (?, ?)', [uid, postId]);
  return true;
}

export async function toggleFollow(followerUid: string, followedUid: string) {
  const existing = await getOne<{ follower_uid: string }>(
    'SELECT follower_uid FROM follows WHERE follower_uid = ? AND followed_uid = ?',
    [followerUid, followedUid],
  );
  if (existing) {
    await query('DELETE FROM follows WHERE follower_uid = ? AND followed_uid = ?', [followerUid, followedUid]);
    return false;
  }
  await query('INSERT INTO follows (follower_uid, followed_uid) VALUES (?, ?)', [followerUid, followedUid]);
  return true;
}

export async function createNotification(uid: string, type: string, actorUid: string, postId?: number) {
  if (uid === actorUid) return;
  await query('INSERT INTO notifications (uid, type, actor_uid, post_id) VALUES (?, ?, ?, ?)', [
    uid,
    type,
    actorUid,
    postId || null,
  ]);
}

export async function getNotifications(uid: string, limit = 50, offset = 0) {
  return query<any[]>('SELECT * FROM notifications WHERE uid = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', [
    uid,
    limit,
    offset,
  ]);
}

export async function markNotificationsRead(uid: string) {
  await query('UPDATE notifications SET is_read = 1 WHERE uid = ? AND is_read = 0', [uid]);
}

export async function getUnreadNotificationCount(uid: string) {
  const result = await getOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM notifications WHERE uid = ? AND is_read = 0',
    [uid],
  );
  return result?.count || 0;
}

export async function createComment(postId: number, uid: string, text: string) {
  const result = await query<{ insertId: number }>('INSERT INTO comments (post_id, uid, text) VALUES (?, ?, ?)', [
    postId,
    uid,
    text,
  ]);
  return result.insertId;
}

export async function getComments(postId: number, limit = 50, offset = 0) {
  return query<any[]>(
    `SELECT c.*, u.pseudo, u.displayName, u.avatar, u.verified
     FROM comments c JOIN users u ON c.uid = u.uid
     WHERE c.post_id = ? ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
    [postId, limit, offset],
  );
}
