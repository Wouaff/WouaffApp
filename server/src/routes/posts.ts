import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Server } from 'socket.io';
import { getOne, query } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';
import { getProfile } from '../services/rtdb.js';
import type { AuthRequest, PostComment, PostData, PostFeedItem } from '../types/index.js';

const MAX_LENGTH = 280;

const router: Router = Router();
router.use(verifyToken);

async function isVerified(uid: string): Promise<boolean> {
  const staff = await getOne<{ uid: string }>('SELECT uid FROM staff WHERE uid = ?', [uid]);
  return !!staff;
}

async function toPostData(
  row: Record<string, unknown>,
  likedMap?: Set<string>,
  repostedMap?: Set<string>,
): Promise<PostData> {
  return {
    id: row.id as string,
    uid: row.uid as string,
    pseudo: (row.pseudo as string) || 'Utilisateur',
    handle: (row.wouaffId as string) ? `@${row.wouaffId}` : '@inconnu',
    avatar: row.avatar as string,
    time: row.createdAt as number,
    text: row.text as string,
    likes: row.likesCount as number,
    reposts: row.repostsCount as number,
    comments: row.commentsCount as number,
    liked: likedMap ? likedMap.has(row.id as string) : false,
    reposted: repostedMap ? repostedMap.has(row.id as string) : false,
    verified: !!row.staffUid,
  };
}

async function fetchLikedMap(uid: string, ids: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  if (ids.length === 0) return set;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await query<Array<{ postId: string }>>(
    `SELECT postId FROM post_likes WHERE uid = ? AND postId IN (${placeholders})`,
    [uid, ...ids],
  );
  for (const r of rows) set.add(r.postId);
  return set;
}

async function fetchRepostedMap(uid: string, ids: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  if (ids.length === 0) return set;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await query<Array<{ postId: string }>>(
    `SELECT postId FROM post_reposts WHERE uid = ? AND postId IN (${placeholders})`,
    [uid, ...ids],
  );
  for (const r of rows) set.add(r.postId);
  return set;
}

const REPOST_SELECT = `SELECT r.uid AS repostedByUid, r.createdAt AS repostedAt,
            p.id, p.uid, p.text, p.likesCount, p.repostsCount, p.commentsCount, p.createdAt,
            pr.pseudo, pr.avatar, pr.wouaffId, s.uid AS staffUid,
            ru.pseudo AS reposterPseudo, ru.avatar AS reposterAvatar, ru.wouaffId AS reposterWouaffId,
            rs.uid AS reposterStaffUid
     FROM post_reposts r
     JOIN posts p ON p.id = r.postId
     LEFT JOIN users pr ON pr.uid = p.uid
     LEFT JOIN staff s ON s.uid = p.uid
     LEFT JOIN users ru ON ru.uid = r.uid
     LEFT JOIN staff rs ON rs.uid = r.uid`;

async function getRepostItem(repostedByUid: string, postId: string, viewerUid?: string): Promise<PostFeedItem | null> {
  const row = await getOne<Record<string, unknown>>(`${REPOST_SELECT} WHERE r.uid = ? AND r.postId = ?`, [
    repostedByUid,
    postId,
  ]);
  if (!row) return null;
  const likedMap = viewerUid ? await fetchLikedMap(viewerUid, [postId]) : undefined;
  const repostedMap = viewerUid ? await fetchRepostedMap(viewerUid, [postId]) : undefined;
  return {
    type: 'repost',
    key: `repost:${repostedByUid}:${postId}`,
    post: await toPostData(row, likedMap, repostedMap),
    repost: {
      uid: repostedByUid,
      pseudo: (row.reposterPseudo as string) || 'Utilisateur',
      handle: (row.reposterWouaffId as string) ? `@${row.reposterWouaffId}` : '@inconnu',
      avatar: row.reposterAvatar as string,
      verified: !!row.reposterStaffUid,
      time: row.repostedAt as number,
    },
  };
}

router.post('/', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { text } = req.body as { text?: string };
  const content = (text || '').trim();
  if (!content) {
    res.status(400).json({ error: 'Texte requis' });
    return;
  }
  if (content.length > MAX_LENGTH) {
    res.status(400).json({ error: `Maximum ${MAX_LENGTH} caractères` });
    return;
  }
  const id = randomUUID();
  const now = Date.now();
  try {
    await query(
      'INSERT INTO posts (id, uid, text, likesCount, repostsCount, commentsCount, createdAt) VALUES (?,?,?,0,0,0,?)',
      [id, authReq.uid!, content, now],
    );
    const profile = await getProfile(authReq.uid!);
    const verified = await isVerified(authReq.uid!);
    const wouaffId = (profile?.wouaffId as string) || '';
    const post: PostData = {
      id,
      uid: authReq.uid!,
      pseudo: (profile?.pseudo as string) || 'Utilisateur',
      handle: wouaffId ? `@${wouaffId}` : '@inconnu',
      avatar: profile?.avatar as string,
      time: now,
      text: content,
      likes: 0,
      reposts: 0,
      comments: 0,
      liked: false,
      reposted: false,
      verified,
    };
    const io: Server = req.app.get('io');
    if (io) io.emit('post:new', post);
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: (err as { message?: string }).message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const offset = (page - 1) * limit;
  const uidFilter = (req.query.uid as string) || '';
  const window = Math.max(limit, limit * 3);

  const postParams: Array<string | number> = [];
  let postWhere = '';
  if (uidFilter) {
    postWhere = 'WHERE p.uid = ?';
    postParams.push(uidFilter);
  }
  postParams.push(window, offset);
  const postRows = await query<Array<Record<string, unknown>>>(
    `SELECT p.id, p.uid, p.text, p.likesCount, p.repostsCount, p.commentsCount, p.createdAt,
            pr.pseudo, pr.avatar, pr.wouaffId, s.uid AS staffUid
     FROM posts p
     LEFT JOIN users pr ON pr.uid = p.uid
     LEFT JOIN staff s ON s.uid = p.uid
     ${postWhere}
     ORDER BY p.createdAt DESC
     LIMIT ? OFFSET ?`,
    postParams,
  );

  const repostParams: Array<string | number> = [];
  let repostWhere = '';
  if (uidFilter) {
    repostWhere = 'WHERE r.uid = ?';
    repostParams.push(uidFilter);
  }
  repostParams.push(window, offset);
  const repostRows = await query<Array<Record<string, unknown>>>(
    `SELECT r.uid AS repostedByUid, r.createdAt AS repostedAt,
            p.id, p.uid, p.text, p.likesCount, p.repostsCount, p.commentsCount, p.createdAt,
            pr.pseudo, pr.avatar, pr.wouaffId, s.uid AS staffUid,
            ru.pseudo AS reposterPseudo, ru.avatar AS reposterAvatar, ru.wouaffId AS reposterWouaffId,
            rs.uid AS reposterStaffUid
     FROM post_reposts r
     JOIN posts p ON p.id = r.postId
     LEFT JOIN users pr ON pr.uid = p.uid
     LEFT JOIN staff s ON s.uid = p.uid
     LEFT JOIN users ru ON ru.uid = r.uid
     LEFT JOIN staff rs ON rs.uid = r.uid
     ${repostWhere}
     ORDER BY r.createdAt DESC
     LIMIT ? OFFSET ?`,
    repostParams,
  );

  const ids = [...postRows, ...repostRows].map((r) => r.id as string);
  const likedMap = authReq.uid ? await fetchLikedMap(authReq.uid, ids) : undefined;
  const repostedMap = authReq.uid ? await fetchRepostedMap(authReq.uid, ids) : undefined;

  const items: PostFeedItem[] = [];
  for (const row of postRows) {
    items.push({ type: 'post', key: `post:${row.id}`, post: await toPostData(row, likedMap, repostedMap) });
  }
  for (const row of repostRows) {
    items.push({
      type: 'repost',
      key: `repost:${row.repostedByUid}:${row.id}`,
      post: await toPostData(row, likedMap, repostedMap),
      repost: {
        uid: row.repostedByUid as string,
        pseudo: (row.reposterPseudo as string) || 'Utilisateur',
        handle: (row.reposterWouaffId as string) ? `@${row.reposterWouaffId}` : '@inconnu',
        avatar: row.reposterAvatar as string,
        verified: !!row.reposterStaffUid,
        time: row.repostedAt as number,
      },
    });
  }
  items.sort((a, b) => {
    const ta = a.type === 'repost' && a.repost ? a.repost.time : a.post.time;
    const tb = b.type === 'repost' && b.repost ? b.repost.time : b.post.time;
    return tb - ta;
  });
  res.json(items.slice(0, limit));
});

router.get('/:id', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getOne<Record<string, unknown>>(
    `SELECT p.id, p.uid, p.text, p.likesCount, p.repostsCount, p.commentsCount, p.createdAt,
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
  const likedMap = authReq.uid ? await fetchLikedMap(authReq.uid, [req.params.id]) : undefined;
  const repostedMap = authReq.uid ? await fetchRepostedMap(authReq.uid, [req.params.id]) : undefined;
  res.json(await toPostData(row, likedMap, repostedMap));
});

router.delete('/:id', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getOne<{ uid: string }>('SELECT uid FROM posts WHERE id = ?', [req.params.id]);
  if (!row) {
    res.status(404).json({ error: 'Post introuvable' });
    return;
  }
  if (row.uid !== authReq.uid) {
    res.status(403).json({ error: 'Interdit' });
    return;
  }
  await query('DELETE FROM posts WHERE id = ?', [req.params.id]);
  await query('DELETE FROM post_likes WHERE postId = ?', [req.params.id]);
  await query('DELETE FROM post_reposts WHERE postId = ?', [req.params.id]);
  await query('DELETE FROM post_comments WHERE postId = ?', [req.params.id]);
  const io: Server = req.app.get('io');
  if (io) io.emit('post:deleted', { postId: req.params.id });
  res.json({ success: true });
});

router.post('/:id/like', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const existing = await getOne<{ uid: string }>('SELECT uid FROM post_likes WHERE uid = ? AND postId = ?', [
    authReq.uid!,
    req.params.id,
  ]);
  if (existing) {
    await query('DELETE FROM post_likes WHERE uid = ? AND postId = ?', [authReq.uid!, req.params.id]);
    await query('UPDATE posts SET likesCount = GREATEST(0, likesCount - 1) WHERE id = ?', [req.params.id]);
    const [row] = await query<Array<{ likesCount: number }>>('SELECT likesCount FROM posts WHERE id = ?', [
      req.params.id,
    ]);
    const io: Server = req.app.get('io');
    if (io) io.emit('post:liked', { postId: req.params.id, uid: authReq.uid!, liked: false, likes: row.likesCount });
    res.json({ liked: false, likes: row.likesCount });
  } else {
    await query('INSERT INTO post_likes (uid, postId, createdAt) VALUES (?,?,?)', [
      authReq.uid!,
      req.params.id,
      Date.now(),
    ]);
    await query('UPDATE posts SET likesCount = likesCount + 1 WHERE id = ?', [req.params.id]);
    const [row] = await query<Array<{ likesCount: number }>>('SELECT likesCount FROM posts WHERE id = ?', [
      req.params.id,
    ]);
    const io: Server = req.app.get('io');
    if (io) io.emit('post:liked', { postId: req.params.id, uid: authReq.uid!, liked: true, likes: row.likesCount });
    res.json({ liked: true, likes: row.likesCount });
  }
});

router.post('/:id/repost', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const existing = await getOne<{ uid: string }>('SELECT uid FROM post_reposts WHERE uid = ? AND postId = ?', [
    authReq.uid!,
    req.params.id,
  ]);
  const io: Server = req.app.get('io');
  if (existing) {
    await query('DELETE FROM post_reposts WHERE uid = ? AND postId = ?', [authReq.uid!, req.params.id]);
    await query('UPDATE posts SET repostsCount = GREATEST(0, repostsCount - 1) WHERE id = ?', [req.params.id]);
    const [row] = await query<Array<{ repostsCount: number }>>('SELECT repostsCount FROM posts WHERE id = ?', [
      req.params.id,
    ]);
    if (io)
      io.emit('post:reposted', {
        postId: req.params.id,
        uid: authReq.uid!,
        reposted: false,
        reposts: row.repostsCount,
      });
    if (io) io.emit('post:unrepost', { postId: req.params.id, uid: authReq.uid! });
    res.json({ reposted: false, reposts: row.repostsCount });
  } else {
    await query('INSERT INTO post_reposts (uid, postId, createdAt) VALUES (?,?,?)', [
      authReq.uid!,
      req.params.id,
      Date.now(),
    ]);
    await query('UPDATE posts SET repostsCount = repostsCount + 1 WHERE id = ?', [req.params.id]);
    const [row] = await query<Array<{ repostsCount: number }>>('SELECT repostsCount FROM posts WHERE id = ?', [
      req.params.id,
    ]);
    if (io)
      io.emit('post:reposted', { postId: req.params.id, uid: authReq.uid!, reposted: true, reposts: row.repostsCount });
    const item = await getRepostItem(authReq.uid!, req.params.id, authReq.uid);
    if (io && item) io.emit('post:repost', item);
    res.json({ reposted: true, reposts: row.repostsCount, item });
  }
});

router.post('/:id/comments', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { text } = req.body as { text?: string };
  const content = (text || '').trim();
  if (!content) {
    res.status(400).json({ error: 'Texte requis' });
    return;
  }
  if (content.length > MAX_LENGTH) {
    res.status(400).json({ error: `Maximum ${MAX_LENGTH} caractères` });
    return;
  }
  const post = await getOne<{ id: string }>('SELECT id FROM posts WHERE id = ?', [req.params.id]);
  if (!post) {
    res.status(404).json({ error: 'Post introuvable' });
    return;
  }
  const now = Date.now();
  const result = await query<{ insertId: number }>(
    'INSERT INTO post_comments (postId, uid, text, createdAt) VALUES (?,?,?,?)',
    [req.params.id, authReq.uid!, content, now],
  );
  await query('UPDATE posts SET commentsCount = commentsCount + 1 WHERE id = ?', [req.params.id]);
  const profile = await getProfile(authReq.uid!);
  const comment: PostComment = {
    id: (result as unknown as { insertId?: number }).insertId || 0,
    postId: req.params.id,
    uid: authReq.uid!,
    text: content,
    createdAt: now,
    pseudo: (profile?.pseudo as string) || 'Inconnu',
    avatar: profile?.avatar as string,
  };
  const io: Server = req.app.get('io');
  if (io) io.emit('post:comment', { postId: req.params.id, comment });
  res.json(comment);
});

router.get('/:id/comments', async (req: Request, res: Response) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
  const rows = await query<Array<PostComment & { uid: string }>>(
    'SELECT c.*, p.pseudo, p.avatar FROM post_comments c LEFT JOIN users p ON p.uid = c.uid WHERE c.postId = ? ORDER BY c.createdAt ASC LIMIT ? OFFSET ?',
    [req.params.id, limit, offset],
  );
  const enriched: PostComment[] = [];
  for (const row of rows) {
    enriched.push({
      ...row,
      pseudo: ((row as unknown as Record<string, unknown>).pseudo as string) || 'Inconnu',
      avatar: (row as unknown as Record<string, unknown>).avatar as string,
    });
  }
  res.json(enriched);
});

router.delete('/comments/:commentId', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const comment = await getOne<{ uid: string; postId: string }>('SELECT uid, postId FROM post_comments WHERE id = ?', [
    req.params.commentId,
  ]);
  if (!comment) {
    res.status(404).json({ error: 'Commentaire introuvable' });
    return;
  }
  if (comment.uid !== authReq.uid) {
    res.status(403).json({ error: 'Interdit' });
    return;
  }
  await query('DELETE FROM post_comments WHERE id = ?', [req.params.commentId]);
  await query('UPDATE posts SET commentsCount = GREATEST(0, commentsCount - 1) WHERE id = ?', [comment.postId]);
  res.json({ success: true });
});

export default router;
