import { randomBytes } from 'node:crypto';
import { getOne, query, withTransaction } from '../config/database.js';
import { hashSessionId, sha256Hex } from '../utils/crypto.js';
import { countHashtags, type HashtagTrend } from '../utils/hashtags.js';
import { decryptSecret, encryptSecret, isSecretEncryptionEnabled } from './secrets.js';
import { removeUploadsIfUnreferenced } from './uploads.js';

export interface User {
  uid: string;
  pseudo: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  verified: number;
  emailVerified: number;
  totp_secret: string | null;
  totp_enabled: number;
  /* Dernier pas TOTP (30 s) déjà consommé : empêche de rejouer un code. */
  totp_last_step: number | null;
  createdAt: number;
}

/* ── Utilisateurs ───────────────────────────────────────────────────────────── */

/* Le secret TOTP est chiffré en base (si TOTP_ENCRYPTION_KEY est définie) : on le déchiffre ici, une fois. */
function hydrateUser(user: User | null): User | null {
  if (user) user.totp_secret = decryptSecret(user.totp_secret);
  return user;
}

export async function findUserByEmail(email: string) {
  return hydrateUser(await getOne<User>('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]));
}

export async function findUserByPseudo(pseudo: string) {
  return hydrateUser(await getOne<User>('SELECT * FROM users WHERE pseudo = ?', [pseudo]));
}

export async function findUserByUid(uid: string) {
  return hydrateUser(await getOne<User>('SELECT * FROM users WHERE uid = ?', [uid]));
}

export async function createUser(uid: string, pseudo: string, email: string, passwordHash: string) {
  await query('INSERT INTO users (uid, pseudo, email, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?)', [
    uid,
    pseudo,
    email.trim().toLowerCase(),
    passwordHash,
    Date.now(),
  ]);
}

const UPDATABLE_USER_FIELDS = new Set([
  'displayName',
  'bio',
  'location',
  'website',
  'avatar',
  'banner',
  'passwordHash',
  'emailVerified',
  'totp_secret',
  'totp_enabled',
  'totp_last_step',
]);

export async function updateUser(uid: string, fields: Record<string, unknown>) {
  const keys = Object.keys(fields).filter((k) => UPDATABLE_USER_FIELDS.has(k));
  if (keys.length === 0) return;
  const sets = keys.map((k) => `\`${k}\` = ?`).join(', ');
  const values = keys.map((k) => {
    const value = fields[k];
    return k === 'totp_secret' && typeof value === 'string' ? encryptSecret(value) : value;
  });
  /* Avatar / bannière remplacés ou retirés : l'ancien fichier est supprimé du disque s'il n'est plus utilisé. */
  const touchesMedia = keys.includes('avatar') || keys.includes('banner');
  const before = touchesMedia
    ? await getOne<{ avatar: string | null; banner: string | null }>('SELECT avatar, banner FROM users WHERE uid = ?', [
        uid,
      ])
    : null;
  await query(`UPDATE users SET ${sets} WHERE uid = ?`, [...values, uid]);
  if (before) await removeUploadsIfUnreferenced([before.avatar, before.banner]);
}

/* Consomme un pas TOTP de façon atomique : faux si ce pas (ou un plus récent) a déjà servi. */
export async function claimTotpStep(uid: string, step: number): Promise<boolean> {
  const result = await query<{ affectedRows: number }>(
    'UPDATE users SET totp_last_step = ? WHERE uid = ? AND (totp_last_step IS NULL OR totp_last_step < ?)',
    [step, uid, step],
  );
  return result.affectedRows === 1;
}

/* Au démarrage, si une clé de chiffrement vient d'être configurée : chiffre les secrets TOTP encore en clair. */
export async function encryptLegacyTotpSecrets(): Promise<number> {
  if (!isSecretEncryptionEnabled()) return 0;
  const rows = await query<{ uid: string; totp_secret: string }[]>(
    "SELECT uid, totp_secret FROM users WHERE totp_secret IS NOT NULL AND totp_secret NOT LIKE 'enc:v1:%'",
  );
  for (const row of rows) {
    await query('UPDATE users SET totp_secret = ? WHERE uid = ? AND totp_secret = ?', [
      encryptSecret(row.totp_secret),
      row.uid,
      row.totp_secret,
    ]);
  }
  return rows.length;
}

/* ── Sessions ───────────────────────────────────────────────────────────────── */

/* `id` est la valeur brute du cookie ; seule son empreinte est stockée. */
export async function createSession(id: string, uid: string, expiresAt: number, userAgent?: string) {
  await query('INSERT INTO sessions (id, uid, expires_at, user_agent) VALUES (?, ?, ?, ?)', [
    hashSessionId(id),
    uid,
    expiresAt,
    userAgent ? userAgent.slice(0, 255) : null,
  ]);
}

/* `id` est la valeur brute du cookie. */
export async function deleteSession(id: string) {
  await query('DELETE FROM sessions WHERE id = ?', [hashSessionId(id)]);
}

export async function deleteSessionOfUser(uid: string, id: string) {
  await query('DELETE FROM sessions WHERE id = ? AND uid = ?', [id, uid]);
}

/* Révoque toutes les sessions d'un compte, sauf éventuellement `exceptId`. */
export async function deleteUserSessions(uid: string, exceptId?: string) {
  if (exceptId) await query('DELETE FROM sessions WHERE uid = ? AND id <> ?', [uid, exceptId]);
  else await query('DELETE FROM sessions WHERE uid = ?', [uid]);
}

export async function listSessions(uid: string) {
  return query<{ id: string; expires_at: number; user_agent: string | null; created_at: string }[]>(
    'SELECT id, expires_at, user_agent, created_at FROM sessions WHERE uid = ? AND expires_at > ? ORDER BY created_at DESC',
    [uid, Date.now()],
  );
}

export async function purgeExpiredSessions() {
  await query('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
  await query('DELETE FROM auth_tokens WHERE expires_at < ?', [Date.now()]);
}

/* ── Jetons à usage unique (reset mot de passe, vérification e-mail) ────────── */

const hashToken = sha256Hex;

export async function createAuthToken(uid: string, type: 'reset' | 'verify', ttlMs: number): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await query('DELETE FROM auth_tokens WHERE uid = ? AND type = ?', [uid, type]);
  await query('INSERT INTO auth_tokens (token_hash, uid, type, expires_at) VALUES (?, ?, ?, ?)', [
    hashToken(token),
    uid,
    type,
    Date.now() + ttlMs,
  ]);
  return token;
}

/* Retourne l'uid et consomme le jeton, ou null s'il est inconnu/expiré. */
export async function consumeAuthToken(token: string, type: 'reset' | 'verify'): Promise<string | null> {
  const hash = hashToken(token);
  const row = await getOne<{ uid: string; expires_at: number }>(
    'SELECT uid, expires_at FROM auth_tokens WHERE token_hash = ? AND type = ?',
    [hash, type],
  );
  if (!row) return null;
  /* Suppression atomique : si deux requêtes présentent le même jeton en même temps, une seule le consomme. */
  const result = await query<{ affectedRows: number }>('DELETE FROM auth_tokens WHERE token_hash = ? AND type = ?', [
    hash,
    type,
  ]);
  if (result.affectedRows !== 1) return null;
  return row.expires_at < Date.now() ? null : row.uid;
}

/* ── Tendances ──────────────────────────────────────────────────────────────── */

/* Nombre de posts récents examinés pour calculer les tendances. */
const TREND_SCAN_LIMIT = 5000;

/**
 * Tendances calculées depuis les posts : un hashtag compte une fois par post qui le
 * contient. `days = 0` couvre tout l'historique, sinon fenêtre glissante en jours.
 */
const TREND_CACHE_MS = 60_000;
const trendCache = new Map<string, { at: number; value: HashtagTrend[] }>();

export async function getTrendingHashtags(days = 0, limit = 10): Promise<HashtagTrend[]> {
  const window = Math.max(0, Math.trunc(days));
  const max = Math.max(1, Math.trunc(limit));
  /* Cache de 60 s : sans lui, chaque ouverture de la colonne de droite relisait jusqu'à 5000 posts. */
  const cacheKey = `${window}:${max}`;
  const hit = trendCache.get(cacheKey);
  if (hit && Date.now() - hit.at < TREND_CACHE_MS) return hit.value;
  const rows = await query<{ text: string | null }[]>(
    `SELECT text FROM posts
     WHERE text IS NOT NULL AND text LIKE '%#%'${window > 0 ? ` AND created_at >= NOW() - INTERVAL ${window} DAY` : ''}
     ORDER BY created_at DESC
     LIMIT ${TREND_SCAN_LIMIT}`,
  );
  const value = countHashtags(rows.map((row) => row.text)).slice(0, max);
  if (trendCache.size >= 200) trendCache.clear(); // borne la mémoire (days/limit viennent de la requête)
  trendCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

/* ── Posts ──────────────────────────────────────────────────────────────────── */

export async function createPost(uid: string, text: string | null, image: string | null, video?: string | null) {
  const result = await query<{ insertId: number }>('INSERT INTO posts (uid, text, image, video) VALUES (?, ?, ?, ?)', [
    uid,
    text,
    image,
    video || null,
  ]);
  return result.insertId;
}

export async function findPostById(postId: number) {
  return getOne<{ id: number; uid: string; text: string | null; repost_of: number | null }>(
    'SELECT * FROM posts WHERE id = ?',
    [postId],
  );
}

/* Supprime un post (ou annule un repost) appartenant à `uid`. Faux s'il n'existe pas / pas à lui. */
export async function deletePost(postId: number, uid: string): Promise<boolean> {
  const row = await getOne<{ id: number; image: string | null; video: string | null }>(
    'SELECT id, image, video FROM posts WHERE id = ? AND uid = ?',
    [postId, uid],
  );
  if (!row) return false;
  await withTransaction(async (conn) => {
    await conn.execute('DELETE FROM posts WHERE repost_of = ?', [postId]);
    await conn.execute('DELETE FROM likes WHERE post_id = ?', [postId]);
    await conn.execute('DELETE FROM comments WHERE post_id = ?', [postId]);
    await conn.execute('DELETE FROM notifications WHERE post_id = ?', [postId]);
    await conn.execute('DELETE FROM posts WHERE id = ?', [postId]);
  });
  /* Le média du post part aussi du disque (droit à l'effacement), sauf s'il sert encore ailleurs. */
  await removeUploadsIfUnreferenced([row.image, row.video]);
  return true;
}

export async function toggleLike(uid: string, postId: number) {
  const existing = await getOne<{ uid: string }>('SELECT uid FROM likes WHERE uid = ? AND post_id = ?', [uid, postId]);
  if (existing) {
    await query('DELETE FROM likes WHERE uid = ? AND post_id = ?', [uid, postId]);
    return false;
  }
  await query('INSERT IGNORE INTO likes (uid, post_id) VALUES (?, ?)', [uid, postId]);
  return true;
}

export async function toggleRepost(uid: string, postId: number) {
  const existing = await getOne<{ id: number }>('SELECT id FROM posts WHERE uid = ? AND repost_of = ?', [uid, postId]);
  if (existing) {
    await query('DELETE FROM posts WHERE id = ?', [existing.id]);
    return false;
  }
  /* IGNORE + index UNIQUE (uid, repost_of) : un double-clic ne crée jamais deux reposts. */
  await query('INSERT IGNORE INTO posts (uid, repost_of) VALUES (?, ?)', [uid, postId]);
  return true;
}

/* ── Abonnements & blocages ─────────────────────────────────────────────────── */

export async function toggleFollow(followerUid: string, followedUid: string) {
  const existing = await getOne<{ follower_uid: string }>(
    'SELECT follower_uid FROM follows WHERE follower_uid = ? AND followed_uid = ?',
    [followerUid, followedUid],
  );
  if (existing) {
    await query('DELETE FROM follows WHERE follower_uid = ? AND followed_uid = ?', [followerUid, followedUid]);
    return false;
  }
  await query('INSERT IGNORE INTO follows (follower_uid, followed_uid) VALUES (?, ?)', [followerUid, followedUid]);
  return true;
}

export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const row = await getOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM blocks
     WHERE (blocker_uid = ? AND blocked_uid = ?) OR (blocker_uid = ? AND blocked_uid = ?)`,
    [a, b, b, a],
  );
  return (row?.n || 0) > 0;
}

export async function toggleBlock(blockerUid: string, blockedUid: string): Promise<boolean> {
  const existing = await getOne<{ blocker_uid: string }>(
    'SELECT blocker_uid FROM blocks WHERE blocker_uid = ? AND blocked_uid = ?',
    [blockerUid, blockedUid],
  );
  if (existing) {
    await query('DELETE FROM blocks WHERE blocker_uid = ? AND blocked_uid = ?', [blockerUid, blockedUid]);
    return false;
  }
  await withTransaction(async (conn) => {
    await conn.execute('INSERT IGNORE INTO blocks (blocker_uid, blocked_uid) VALUES (?, ?)', [blockerUid, blockedUid]);
    await conn.execute(
      `DELETE FROM follows WHERE (follower_uid = ? AND followed_uid = ?) OR (follower_uid = ? AND followed_uid = ?)`,
      [blockerUid, blockedUid, blockedUid, blockerUid],
    );
  });
  return true;
}

export async function listBlocked(uid: string) {
  return query<{ uid: string; pseudo: string; displayName: string | null; avatar: string | null }[]>(
    `SELECT u.uid, u.pseudo, u.displayName, u.avatar
     FROM blocks b JOIN users u ON u.uid = b.blocked_uid
     WHERE b.blocker_uid = ? ORDER BY b.created_at DESC`,
    [uid],
  );
}

export async function createReport(
  reporterUid: string,
  postId: number | null,
  reportedUid: string | null,
  reason: string | null,
) {
  await query('INSERT IGNORE INTO reports (reporter_uid, post_id, reported_uid, reason) VALUES (?, ?, ?, ?)', [
    reporterUid,
    postId,
    reportedUid,
    reason,
  ]);
}

/* ── Notifications ──────────────────────────────────────────────────────────── */

const DEDUPED_TYPES = new Set(['like', 'repost', 'follow']);

export async function createNotification(uid: string, type: string, actorUid: string, postId?: number) {
  if (uid === actorUid) return;
  if (await isBlockedEitherWay(uid, actorUid)) return;
  /* Un like/unlike répété ne doit pas spammer : une seule notification par (acteur, type, post). */
  if (DEDUPED_TYPES.has(type)) {
    const existing = await getOne<{ id: number }>(
      'SELECT id FROM notifications WHERE uid = ? AND type = ? AND actor_uid = ? AND post_id <=> ?',
      [uid, type, actorUid, postId ?? null],
    );
    if (existing) return;
  }
  await query('INSERT INTO notifications (uid, type, actor_uid, post_id) VALUES (?, ?, ?, ?)', [
    uid,
    type,
    actorUid,
    postId ?? null,
  ]);
}

const MENTION_RE = /(?:^|[^\w])@([a-zA-Z0-9_]{3,30})/g;

/* Notifie chaque @pseudo cité (une fois), sauf l'auteur et ceux déjà notifiés pour ce post. */
export async function notifyMentions(text: string, actorUid: string, postId: number, skipUids: string[] = []) {
  const pseudos = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) pseudos.add(m[1]);
  for (const pseudo of [...pseudos].slice(0, 10)) {
    const target = await findUserByPseudo(pseudo);
    if (target && !skipUids.includes(target.uid)) await createNotification(target.uid, 'mention', actorUid, postId);
  }
}

export interface NotificationRow {
  id: number;
  type: string;
  is_read: number;
  created_at: string;
  post_id: number | null;
  post_text: string | null;
  actor_uid: string | null;
  actor_pseudo: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
  actor_verified: number | null;
}

export async function getNotifications(uid: string, limit = 50, offset = 0) {
  const lim = Math.max(1, Math.trunc(limit));
  const off = Math.max(0, Math.trunc(offset));
  return query<NotificationRow[]>(
    `SELECT n.id, n.type, n.is_read, n.created_at, n.post_id, p.text AS post_text,
            a.uid AS actor_uid, a.pseudo AS actor_pseudo, a.displayName AS actor_name,
            a.avatar AS actor_avatar, a.verified AS actor_verified
     FROM notifications n
     LEFT JOIN users a ON a.uid = n.actor_uid
     LEFT JOIN posts p ON p.id = n.post_id
     WHERE n.uid = ?
     ORDER BY n.created_at DESC, n.id DESC
     LIMIT ${lim} OFFSET ${off}`,
    [uid],
  );
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

/* ── Commentaires ───────────────────────────────────────────────────────────── */

export async function createComment(postId: number, uid: string, text: string) {
  const result = await query<{ insertId: number }>('INSERT INTO comments (post_id, uid, text) VALUES (?, ?, ?)', [
    postId,
    uid,
    text,
  ]);
  return result.insertId;
}

export async function getComments(postId: number, viewerUid: string, limit = 50, offset = 0) {
  const lim = Math.max(1, Math.trunc(limit));
  const off = Math.max(0, Math.trunc(offset));
  return query<
    {
      id: number;
      text: string;
      created_at: string;
      uid: string;
      pseudo: string;
      displayName: string | null;
      avatar: string | null;
      verified: number;
    }[]
  >(
    `SELECT c.id, c.text, c.created_at, u.uid, u.pseudo, u.displayName, u.avatar, u.verified
     FROM comments c JOIN users u ON c.uid = u.uid
     WHERE c.post_id = ?
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_uid = ? AND b.blocked_uid = c.uid) OR (b.blocker_uid = c.uid AND b.blocked_uid = ?))
     ORDER BY c.created_at ASC, c.id ASC
     LIMIT ${lim} OFFSET ${off}`,
    [postId, viewerUid, viewerUid],
  );
}

export async function deleteComment(commentId: number, postId: number, uid: string): Promise<boolean> {
  /* L'auteur du commentaire ou celui du post peut le supprimer. */
  const row = await getOne<{ id: number }>(
    `SELECT c.id FROM comments c JOIN posts p ON p.id = c.post_id
     WHERE c.id = ? AND c.post_id = ? AND (c.uid = ? OR p.uid = ?)`,
    [commentId, postId, uid, uid],
  );
  if (!row) return false;
  await query('DELETE FROM comments WHERE id = ?', [commentId]);
  return true;
}

/* ── RGPD : export & suppression ────────────────────────────────────────────── */

export async function exportUserData(uid: string) {
  const [profile, posts, comments, likes, following, followers, notifications, blocks, sessions] = await Promise.all([
    getOne<Record<string, unknown>>(
      'SELECT uid, pseudo, email, displayName, avatar, banner, bio, location, website, verified, emailVerified, totp_enabled, createdAt FROM users WHERE uid = ?',
      [uid],
    ),
    query<unknown[]>('SELECT id, text, image, video, repost_of, created_at FROM posts WHERE uid = ?', [uid]),
    query<unknown[]>('SELECT id, post_id, text, created_at FROM comments WHERE uid = ?', [uid]),
    query<unknown[]>('SELECT post_id, created_at FROM likes WHERE uid = ?', [uid]),
    query<unknown[]>(
      'SELECT u.pseudo, f.created_at FROM follows f JOIN users u ON u.uid = f.followed_uid WHERE f.follower_uid = ?',
      [uid],
    ),
    query<unknown[]>(
      'SELECT u.pseudo, f.created_at FROM follows f JOIN users u ON u.uid = f.follower_uid WHERE f.followed_uid = ?',
      [uid],
    ),
    query<unknown[]>('SELECT type, actor_uid, post_id, created_at FROM notifications WHERE uid = ?', [uid]),
    query<unknown[]>('SELECT blocked_uid, created_at FROM blocks WHERE blocker_uid = ?', [uid]),
    query<unknown[]>('SELECT user_agent, created_at, expires_at FROM sessions WHERE uid = ?', [uid]),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile,
    posts,
    comments,
    likes,
    following,
    followers,
    notifications,
    blocks,
    sessions,
  };
}

/* Suppression définitive : toutes les données du compte, en une transaction. */
export async function deleteAccount(uid: string) {
  /* Médias à effacer du disque une fois la transaction validée. */
  const [ownPosts, owner] = await Promise.all([
    query<{ image: string | null; video: string | null }[]>('SELECT image, video FROM posts WHERE uid = ?', [uid]),
    getOne<{ avatar: string | null; banner: string | null }>('SELECT avatar, banner FROM users WHERE uid = ?', [uid]),
  ]);
  await withTransaction(async (conn) => {
    await conn.execute('DELETE r FROM posts r JOIN posts o ON r.repost_of = o.id WHERE o.uid = ?', [uid]);
    for (const sql of [
      'DELETE FROM notifications WHERE uid = ? OR actor_uid = ?',
      'DELETE FROM likes WHERE uid = ? OR post_id IN (SELECT id FROM (SELECT id FROM posts WHERE uid = ?) AS mine)',
      'DELETE FROM comments WHERE uid = ? OR post_id IN (SELECT id FROM (SELECT id FROM posts WHERE uid = ?) AS mine)',
      'DELETE FROM follows WHERE follower_uid = ? OR followed_uid = ?',
      'DELETE FROM blocks WHERE blocker_uid = ? OR blocked_uid = ?',
      'DELETE FROM reports WHERE reporter_uid = ? OR reported_uid = ?',
    ]) {
      await conn.execute(sql, [uid, uid]);
    }
    await conn.execute('DELETE FROM auth_tokens WHERE uid = ?', [uid]);
    await conn.execute('DELETE FROM sessions WHERE uid = ?', [uid]);
    await conn.execute('DELETE FROM posts WHERE uid = ?', [uid]);
    await conn.execute('DELETE FROM users WHERE uid = ?', [uid]);
  });
  await removeUploadsIfUnreferenced([...ownPosts.flatMap((p) => [p.image, p.video]), owner?.avatar, owner?.banner]);
}
