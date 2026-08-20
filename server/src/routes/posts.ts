import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Server } from 'socket.io';
import { getOne, query } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';
import { verifyCaptchaIfNewAccount } from '../middleware/captcha.js';
import { enqueueJob } from '../services/queue.js';
import { getProfile, reportPost } from '../services/rtdb.js';
import type { AuthRequest, PostComment, PostData, PostFeedItem, PostPoll, PostReaction } from '../types/index.js';
import { fetchBadgesMap } from '../utils/badges.js';
import { extractHashtags } from '../utils/hashtags.js';
import { insertCommentMentions, insertPostMentions } from '../utils/mentions.js';

const MAX_LENGTH = 280;

function toCommentHandle(wouaffId?: string, pseudo?: string): string | undefined {
  if (wouaffId) return `@${wouaffId}`;
  const p = (pseudo || '').trim();
  if (!p) return undefined;
  return `@${p.toLowerCase().replace(/\s+/g, '')}`;
}

interface PollVotes {
  votes: number[];
  total: number;
  votedIndex: number | null;
}

async function fetchPollVotes(ids: string[], viewerUid?: string): Promise<Map<string, PollVotes>> {
  const map = new Map<string, PollVotes>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await query<Array<{ postId: string; uid: string; optionIndex: number }>>(
    `SELECT postId, uid, optionIndex FROM poll_votes WHERE postId IN (${placeholders})`,
    ids,
  );
  for (const id of ids) map.set(id, { votes: [], total: 0, votedIndex: null });
  for (const r of rows) {
    const entry = map.get(r.postId);
    if (!entry) continue;
    entry.votes[r.optionIndex] = (entry.votes[r.optionIndex] || 0) + 1;
    entry.total += 1;
    if (viewerUid && r.uid === viewerUid) entry.votedIndex = r.optionIndex;
  }
  return map;
}

function parsePoll(row: Record<string, unknown>, votes?: PollVotes): PostPoll | null {
  if (!row.poll) return null;
  let parsed: { question?: string; options?: string[] };
  try {
    parsed = JSON.parse(row.poll as string);
  } catch {
    return null;
  }
  const options = Array.isArray(parsed.options) ? parsed.options : [];
  if (options.length === 0) return null;
  const votesArr =
    votes?.votes && votes.votes.length === options.length ? votes.votes : new Array(options.length).fill(0);
  return {
    question: (parsed.question as string) || 'Sondage',
    options,
    votes: votesArr,
    total: votes?.total ?? 0,
    votedIndex: votes?.votedIndex ?? null,
  };
}

const router: Router = Router();
router.use(verifyToken);

async function insertHashtags(
  postId: string,
  uid: string,
  kind: 'post' | 'repost',
  createdAt: number,
  text: string,
): Promise<void> {
  const tags = extractHashtags(text);
  if (tags.length === 0) return;
  const values: Array<string | number> = [];
  const placeholders = tags.map((tag) => {
    values.push(postId, tag, uid, kind, createdAt);
    return '(?,?,?,?,?)';
  });
  await query(
    `INSERT INTO hashtag_occurrences (postId, tag, uid, kind, createdAt) VALUES ${placeholders.join(',')}`,
    values,
  );
}

async function isVerified(uid: string): Promise<boolean> {
  const staff = await getOne<{ uid: string }>('SELECT uid FROM staff WHERE uid = ?', [uid]);
  return !!staff;
}

async function toPostData(
  row: Record<string, unknown>,
  myReactions?: Map<string, string>,
  repostedMap?: Set<string>,
  pollVotes?: Map<string, PollVotes>,
  badgesMap?: Map<string, string[]>,
  reactionsMap?: Map<string, PostReaction[]>,
): Promise<PostData> {
  return {
    id: row.id as string,
    uid: row.uid as string,
    pseudo: (row.pseudo as string) || 'Utilisateur',
    handle: (row.wouaffId as string) ? `@${row.wouaffId}` : '@inconnu',
    avatar: row.avatar as string,
    time: row.createdAt as number,
    text: row.text as string,
    image: (row.image as string) || undefined,
    audio: (row.audio as string) || undefined,
    audioDuration: (row.audioDuration as number) || 0,
    poll: parsePoll(row, pollVotes?.get(row.id as string)),
    likes: row.likesCount as number,
    reposts: row.repostsCount as number,
    comments: row.commentsCount as number,
    myReaction: myReactions?.get(row.id as string) ?? null,
    reactions: reactionsMap?.get(row.id as string) ?? [],
    reposted: repostedMap ? repostedMap.has(row.id as string) : false,
    verified: !!row.staffUid,
    ownedBadges: badgesMap?.get(row.uid as string) ?? [],
  };
}

async function fetchMyReactions(uid: string, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await query<Array<{ postId: string; type: string }>>(
    `SELECT postId, type FROM post_likes WHERE uid = ? AND postId IN (${placeholders})`,
    [uid, ...ids],
  );
  for (const r of rows) map.set(r.postId, r.type);
  return map;
}

async function fetchReactionCounts(ids: string[]): Promise<Map<string, PostReaction[]>> {
  const map = new Map<string, PostReaction[]>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await query<Array<{ postId: string; type: string; cnt: number }>>(
    `SELECT postId, type, COUNT(*) AS cnt FROM post_likes WHERE postId IN (${placeholders}) GROUP BY postId, type`,
    ids,
  );
  for (const r of rows) {
    const list = map.get(r.postId) ?? [];
    list.push({ type: r.type, count: r.cnt });
    map.set(r.postId, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => b.count - a.count);
  }
  return map;
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
            p.id, p.uid, p.text, p.image, p.audio, p.audioDuration, p.poll, p.likesCount, p.repostsCount, p.commentsCount, p.createdAt,
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
  const myReactions = viewerUid ? await fetchMyReactions(viewerUid, [postId]) : undefined;
  const repostedMap = viewerUid ? await fetchRepostedMap(viewerUid, [postId]) : undefined;
  const pollVotes = await fetchPollVotes([postId], viewerUid);
  const badgesMap = await fetchBadgesMap([row.uid as string]);
  const reactionsMap = await fetchReactionCounts([postId]);
  return {
    type: 'repost',
    key: `repost:${repostedByUid}:${postId}`,
    post: await toPostData(row, myReactions, repostedMap, pollVotes, badgesMap, reactionsMap),
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

router.post('/', verifyCaptchaIfNewAccount, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { text, image, audio, audioDuration, poll } = req.body as {
    text?: string;
    image?: string;
    audio?: string;
    audioDuration?: number;
    poll?: { question?: string; options?: string[] };
  };
  const content = (text || '').trim();
  const img = typeof image === 'string' ? image.trim() : '';
  const aud = typeof audio === 'string' ? audio.trim() : '';
  let pollJson: string | null = null;
  let pollOptions: string[] = [];
  let pollQuestion = '';
  if (poll && Array.isArray(poll.options)) {
    pollOptions = poll.options.map((o) => (typeof o === 'string' ? o.trim().slice(0, 80) : '')).filter(Boolean);
    if (pollOptions.length < 2 || pollOptions.length > 4) {
      res.status(400).json({ error: 'Un sondage doit avoir entre 2 et 4 options' });
      return;
    }
    pollQuestion = typeof poll.question === 'string' ? poll.question.trim().slice(0, 140) : '';
    pollJson = JSON.stringify({ question: pollQuestion, options: pollOptions });
  }
  if (!content && !img && !aud && !pollJson) {
    res.status(400).json({ error: 'Texte, image, audio ou sondage requis' });
    return;
  }
  if (content.length > MAX_LENGTH) {
    res.status(400).json({ error: `Maximum ${MAX_LENGTH} caractères` });
    return;
  }
  if (img && !img.startsWith('data:image/') && !/^https?:\/\//i.test(img)) {
    res.status(400).json({ error: 'Image invalide' });
    return;
  }
  if (aud && !aud.startsWith('data:audio/')) {
    res.status(400).json({ error: 'Audio invalide' });
    return;
  }
  const dur =
    typeof audioDuration === 'number' && Number.isFinite(audioDuration)
      ? Math.min(600, Math.max(0, Math.round(audioDuration)))
      : 0;
  const id = randomUUID();
  const now = Date.now();
  try {
    await query(
      'INSERT INTO posts (id, uid, text, image, audio, audioDuration, poll, likesCount, repostsCount, commentsCount, createdAt) VALUES (?,?,?,?,?,?,?,0,0,0,?)',
      [id, authReq.uid!, content, img || null, aud || null, dur, pollJson, now],
    );
    if (content) await insertHashtags(id, authReq.uid!, 'post', now, content);
    if (content) await insertPostMentions(id, content);
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
      image: img || undefined,
      audio: aud || undefined,
      audioDuration: dur || undefined,
      poll: pollJson
        ? {
            question: pollQuestion || 'Sondage',
            options: pollOptions,
            votes: new Array(pollOptions.length).fill(0),
            total: 0,
            votedIndex: null,
          }
        : undefined,
      likes: 0,
      reposts: 0,
      comments: 0,
      myReaction: null,
      reactions: [],
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
  const tagFilter = (req.query.tag as string) || '';
  const feed = (req.query.feed as string) === 'following' ? 'following' : 'forYou';
  const window = Math.max(limit, limit * 3);

  const postParams: Array<string | number> = [];
  const postWheres: string[] = [];
  if (uidFilter) {
    postWheres.push('p.uid = ?');
    postParams.push(uidFilter);
  }
  if (tagFilter) {
    postWheres.push('p.id IN (SELECT postId FROM hashtag_occurrences WHERE tag = ?)');
    postParams.push(tagFilter.toLowerCase());
  }
  if (feed === 'following' && !uidFilter) {
    postWheres.push('p.uid IN (SELECT followedUid FROM follows WHERE followerUid = ?)');
    postParams.push(authReq.uid!);
  }
  const postWhere = postWheres.length > 0 ? `WHERE ${postWheres.join(' AND ')}` : '';
  postParams.push(window, offset);
  const postRows = await query<Array<Record<string, unknown>>>(
    `SELECT p.id, p.uid, p.text, p.image, p.audio, p.audioDuration, p.likesCount, p.repostsCount, p.commentsCount, p.createdAt,
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
  const repostWheres: string[] = [];
  if (uidFilter) {
    repostWheres.push('r.uid = ?');
    repostParams.push(uidFilter);
  }
  if (tagFilter) {
    repostWheres.push('p.id IN (SELECT postId FROM hashtag_occurrences WHERE tag = ?)');
    repostParams.push(tagFilter.toLowerCase());
  }
  if (feed === 'following' && !uidFilter) {
    repostWheres.push('r.uid IN (SELECT followedUid FROM follows WHERE followerUid = ?)');
    repostParams.push(authReq.uid!);
  }
  const repostWhere = repostWheres.length > 0 ? `WHERE ${repostWheres.join(' AND ')}` : '';
  repostParams.push(window, offset);
  const repostRows = await query<Array<Record<string, unknown>>>(
    `SELECT r.uid AS repostedByUid, r.createdAt AS repostedAt,
            p.id, p.uid, p.text, p.image, p.audio, p.audioDuration, p.poll, p.likesCount, p.repostsCount, p.commentsCount, p.createdAt,
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
  const myReactions = authReq.uid ? await fetchMyReactions(authReq.uid, ids) : undefined;
  const repostedMap = authReq.uid ? await fetchRepostedMap(authReq.uid, ids) : undefined;
  const pollVotes = await fetchPollVotes(ids, authReq.uid);
  const badgesMap = await fetchBadgesMap([...postRows, ...repostRows].map((r) => r.uid as string));
  const reactionsMap = await fetchReactionCounts(ids);

  const items: PostFeedItem[] = [];
  for (const row of postRows) {
    items.push({
      type: 'post',
      key: `post:${row.id}`,
      post: await toPostData(row, myReactions, repostedMap, pollVotes, badgesMap, reactionsMap),
    });
  }
  for (const row of repostRows) {
    items.push({
      type: 'repost',
      key: `repost:${row.repostedByUid}:${row.id}`,
      post: await toPostData(row, myReactions, repostedMap, pollVotes, badgesMap, reactionsMap),
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
  /* Les deux flux sont triés du plus récent au plus ancien */
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
    `SELECT p.id, p.uid, p.text, p.image, p.audio, p.audioDuration, p.likesCount, p.repostsCount, p.commentsCount, p.createdAt,
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
  const myReactions = authReq.uid ? await fetchMyReactions(authReq.uid, [req.params.id]) : undefined;
  const repostedMap = authReq.uid ? await fetchRepostedMap(authReq.uid, [req.params.id]) : undefined;
  const pollVotes = await fetchPollVotes([req.params.id], authReq.uid);
  const badgesMap = await fetchBadgesMap([row.uid as string]);
  const reactionsMap = await fetchReactionCounts([req.params.id]);
  res.json(await toPostData(row, myReactions, repostedMap, pollVotes, badgesMap, reactionsMap));
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
  await query('DELETE FROM hashtag_occurrences WHERE postId = ?', [req.params.id]);
  await query('DELETE FROM post_mentions WHERE postId = ?', [req.params.id]);
  const comments = await query<Array<{ id: number }>>('SELECT id FROM post_comments WHERE postId = ?', [req.params.id]);
  if (comments.length > 0) {
    const ids = comments.map((c) => c.id);
    const placeholders = ids.map(() => '?').join(',');
    await query(`DELETE FROM comment_mentions WHERE commentId IN (${placeholders})`, ids);
  }
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
    await query('INSERT INTO post_likes (uid, postId, type, createdAt) VALUES (?,?,?,?)', [
      authReq.uid!,
      req.params.id,
      '❤️',
      Date.now(),
    ]);
    await query('UPDATE posts SET likesCount = likesCount + 1 WHERE id = ?', [req.params.id]);
    const [row] = await query<Array<{ likesCount: number }>>('SELECT likesCount FROM posts WHERE id = ?', [
      req.params.id,
    ]);
    const io: Server = req.app.get('io');
    if (io) io.emit('post:liked', { postId: req.params.id, uid: authReq.uid!, liked: true, likes: row.likesCount });
    const [author] = await query<Array<{ uid: string }>>('SELECT uid FROM posts WHERE id = ?', [req.params.id]);
    if (io && author && author.uid !== authReq.uid) {
      enqueueJob('notification', {
        uid: author.uid,
        actorUid: authReq.uid!,
        type: 'like',
        postId: req.params.id,
      }).catch(() => {});
    }
    res.json({ liked: true, likes: row.likesCount });
  }
});

const REACTIONS = new Set(['❤️', '👍', '🔥', '🤣', '😮', '😢', '🙏']);

router.post('/:id/reaction', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { type } = req.body as { type?: string };
  if (!type || !REACTIONS.has(type)) {
    res.status(400).json({ error: 'Réaction invalide' });
    return;
  }
  const post = await getOne<{ uid: string }>('SELECT uid FROM posts WHERE id = ?', [req.params.id]);
  if (!post) {
    res.status(404).json({ error: 'Post introuvable' });
    return;
  }
  const existing = await getOne<{ uid: string; type: string }>(
    'SELECT uid, type FROM post_likes WHERE uid = ? AND postId = ?',
    [authReq.uid!, req.params.id],
  );
  const io: Server = req.app.get('io');
  let reaction: string | null = type;
  if (existing && existing.type === type) {
    await query('DELETE FROM post_likes WHERE uid = ? AND postId = ?', [authReq.uid!, req.params.id]);
    await query('UPDATE posts SET likesCount = GREATEST(0, likesCount - 1) WHERE id = ?', [req.params.id]);
    reaction = null;
  } else if (existing) {
    await query('UPDATE post_likes SET type = ? WHERE uid = ? AND postId = ?', [type, authReq.uid!, req.params.id]);
  } else {
    await query('INSERT INTO post_likes (uid, postId, type, createdAt) VALUES (?,?,?,?)', [
      authReq.uid!,
      req.params.id,
      type,
      Date.now(),
    ]);
    await query('UPDATE posts SET likesCount = likesCount + 1 WHERE id = ?', [req.params.id]);
    if (post.uid !== authReq.uid) {
      enqueueJob('notification', {
        uid: post.uid,
        actorUid: authReq.uid!,
        type: 'like',
        postId: req.params.id,
      }).catch(() => {});
    }
  }
  const [row] = await query<Array<{ likesCount: number }>>('SELECT likesCount FROM posts WHERE id = ?', [
    req.params.id,
  ]);
  const reactions = (await fetchReactionCounts([req.params.id])).get(req.params.id) ?? [];
  if (io) {
    io.emit('post:reacted', {
      postId: req.params.id,
      uid: authReq.uid!,
      type,
      reaction,
      reactions,
      total: row.likesCount,
    });
  }
  res.json({ reaction, reactions, total: row.likesCount });
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
    await query('DELETE FROM hashtag_occurrences WHERE postId = ? AND kind = ? AND uid = ?', [
      req.params.id,
      'repost',
      authReq.uid!,
    ]);
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
    const original = await getOne<{ text: string | null }>('SELECT text FROM posts WHERE id = ?', [req.params.id]);
    if (original?.text) {
      await insertHashtags(req.params.id, authReq.uid!, 'repost', Date.now(), original.text);
    }
    await query('UPDATE posts SET repostsCount = repostsCount + 1 WHERE id = ?', [req.params.id]);
    const [row] = await query<Array<{ repostsCount: number }>>('SELECT repostsCount FROM posts WHERE id = ?', [
      req.params.id,
    ]);
    if (io)
      io.emit('post:reposted', { postId: req.params.id, uid: authReq.uid!, reposted: true, reposts: row.repostsCount });
    const item = await getRepostItem(authReq.uid!, req.params.id, authReq.uid);
    if (io && item) io.emit('post:repost', item);
    const [author] = await query<Array<{ uid: string }>>('SELECT uid FROM posts WHERE id = ?', [req.params.id]);
    if (io && author && author.uid !== authReq.uid) {
      enqueueJob('notification', {
        uid: author.uid,
        actorUid: authReq.uid!,
        type: 'repost',
        postId: req.params.id,
      }).catch(() => {});
    }
    res.json({ reposted: true, reposts: row.repostsCount, item });
  }
});

router.post('/:id/report', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const post = await getOne<{ uid: string }>('SELECT uid FROM posts WHERE id = ?', [req.params.id]);
  if (!post) {
    res.status(404).json({ error: 'Post introuvable' });
    return;
  }
  if (post.uid === authReq.uid) {
    res.status(400).json({ error: 'Impossible de signaler votre propre post' });
    return;
  }
  const { reason } = req.body as { reason?: string };
  await reportPost(req.params.id, authReq.uid!, typeof reason === 'string' ? reason.slice(0, 300) : undefined);
  res.json({ success: true });
});

router.post('/:id/comments', verifyCaptchaIfNewAccount, async (req: Request, res: Response) => {
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
  const post = await getOne<{ id: string; uid: string }>('SELECT id, uid FROM posts WHERE id = ?', [req.params.id]);
  if (!post) {
    res.status(404).json({ error: 'Post introuvable' });
    return;
  }
  const now = Date.now();
  const result = await query<{ insertId: number }>(
    'INSERT INTO post_comments (postId, uid, text, createdAt) VALUES (?,?,?,?)',
    [req.params.id, authReq.uid!, content, now],
  );
  const commentId = (result as unknown as { insertId?: number }).insertId || 0;
  await query('UPDATE posts SET commentsCount = commentsCount + 1 WHERE id = ?', [req.params.id]);
  if (commentId) await insertCommentMentions(commentId, content);
  const profile = await getProfile(authReq.uid!);
  const [badgeRows, staff] = await Promise.all([
    query<Array<{ badgeId: string }>>('SELECT badgeId FROM user_badges WHERE uid = ? ORDER BY sortOrder ASC', [
      authReq.uid!,
    ]),
    getOne<{ uid: string }>('SELECT uid FROM staff WHERE uid = ?', [authReq.uid!]),
  ]);
  const comment: PostComment = {
    id: commentId,
    postId: req.params.id,
    uid: authReq.uid!,
    text: content,
    createdAt: now,
    pseudo: (profile?.pseudo as string) || 'Inconnu',
    handle: toCommentHandle(profile?.wouaffId as string, profile?.pseudo as string),
    avatar: profile?.avatar as string,
    ownedBadges: badgeRows.map((b) => b.badgeId),
    verified: !!staff,
    likes: 0,
    liked: false,
  };
  const io: Server = req.app.get('io');
  if (io) io.emit('post:comment', { postId: req.params.id, comment });
  if (io && post.uid !== authReq.uid) {
    enqueueJob('notification', {
      uid: post.uid,
      actorUid: authReq.uid!,
      type: 'comment',
      postId: req.params.id,
      commentId,
    }).catch(() => {});
  }
  res.json(comment);
});

/* POST /posts/:id/vote — voter à un sondage (un vote par utilisateur, modifiable) */
router.post('/:id/vote', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { option } = req.body as { option?: number };
  const post = await getOne<{ poll: string | null }>('SELECT poll FROM posts WHERE id = ?', [req.params.id]);
  if (!post) {
    res.status(404).json({ error: 'Post introuvable' });
    return;
  }
  if (!post.poll) {
    res.status(400).json({ error: "Ce post n'a pas de sondage" });
    return;
  }
  let parsed: { question?: string; options?: string[] };
  try {
    parsed = JSON.parse(post.poll);
  } catch {
    res.status(400).json({ error: 'Sondage invalide' });
    return;
  }
  const options = parsed.options || [];
  if (typeof option !== 'number' || option < 0 || option >= options.length || !Number.isFinite(option)) {
    res.status(400).json({ error: 'Option invalide' });
    return;
  }
  await query(
    'INSERT INTO poll_votes (postId, uid, optionIndex, createdAt) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE optionIndex=VALUES(optionIndex), createdAt=VALUES(createdAt)',
    [req.params.id, authReq.uid!, option, Date.now()],
  );
  const pollVotes = await fetchPollVotes([req.params.id], authReq.uid);
  const v = pollVotes.get(req.params.id)!;
  const pollData: PostPoll = {
    question: parsed.question || 'Sondage',
    options,
    votes: v.votes,
    total: v.total,
    votedIndex: v.votedIndex,
  };
  const io: Server = req.app.get('io');
  if (io) io.emit('post:poll', { postId: req.params.id, poll: pollData });
  res.json({ poll: pollData });
});

router.get('/:id/comments', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
  const rows = await query<Array<PostComment & { uid: string }>>(
    'SELECT c.*, p.pseudo, p.avatar, p.wouaffId FROM post_comments c LEFT JOIN users p ON p.uid = c.uid WHERE c.postId = ? ORDER BY c.createdAt ASC LIMIT ? OFFSET ?',
    [req.params.id, limit, offset],
  );
  const enriched: PostComment[] = [];
  const authorUids = [...new Set(rows.map((r) => (r as unknown as Record<string, unknown>).uid as string))];
  const commentIds = rows.map((r) => (r as unknown as Record<string, unknown>).id as number);

  const placeholders = (arr: unknown[]) => arr.map(() => '?').join(',');

  const [allBadges, allStaff, likedSet] = await Promise.all([
    authorUids.length > 0
      ? query<Array<{ uid: string; badgeId: string }>>(
          `SELECT uid, badgeId FROM user_badges WHERE uid IN (${placeholders(authorUids)}) ORDER BY uid, sortOrder ASC`,
          authorUids,
        )
      : Promise.resolve([]),
    authorUids.length > 0
      ? query<Array<{ uid: string }>>(`SELECT uid FROM staff WHERE uid IN (${placeholders(authorUids)})`, authorUids)
      : Promise.resolve([]),
    authReq.uid && commentIds.length > 0
      ? query<Array<{ commentId: number }>>(
          `SELECT commentId FROM comment_likes WHERE commentId IN (${placeholders(commentIds)}) AND uid = ?`,
          [...commentIds, authReq.uid],
        )
      : Promise.resolve([]),
  ]);

  const badgesByUid = new Map<string, string[]>();
  for (const b of allBadges) {
    const arr = badgesByUid.get(b.uid);
    if (arr) arr.push(b.badgeId);
    else badgesByUid.set(b.uid, [b.badgeId]);
  }
  const staffSet = new Set(allStaff.map((s) => s.uid));
  const likedCommentIds = new Set(likedSet.map((l) => l.commentId));

  for (const row of rows) {
    const rowRecord = row as unknown as Record<string, unknown>;
    const authorUid = rowRecord.uid as string;
    enriched.push({
      ...row,
      pseudo: (rowRecord.pseudo as string) || 'Inconnu',
      avatar: rowRecord.avatar as string,
      handle: toCommentHandle(rowRecord.wouaffId as string, rowRecord.pseudo as string),
      ownedBadges: badgesByUid.get(authorUid) || [],
      verified: staffSet.has(authorUid),
      likes: (rowRecord.likesCount as number) || 0,
      liked: likedCommentIds.has(rowRecord.id as number),
    });
  }
  res.json(enriched);
});

router.post('/comments/:commentId/like', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const commentId = parseInt(req.params.commentId, 10);
  if (!commentId) {
    res.status(400).json({ error: 'Commentaire invalide' });
    return;
  }
  const comment = await getOne<{ uid: string; postId: string }>('SELECT uid, postId FROM post_comments WHERE id = ?', [
    commentId,
  ]);
  if (!comment) {
    res.status(404).json({ error: 'Commentaire introuvable' });
    return;
  }
  const io: Server = req.app.get('io');
  const existing = await getOne<{ uid: string }>('SELECT uid FROM comment_likes WHERE commentId = ? AND uid = ?', [
    commentId,
    authReq.uid!,
  ]);
  if (existing) {
    await query('DELETE FROM comment_likes WHERE commentId = ? AND uid = ?', [commentId, authReq.uid!]);
    await query('UPDATE post_comments SET likesCount = GREATEST(0, likesCount - 1) WHERE id = ?', [commentId]);
    const [row] = await query<Array<{ likesCount: number }>>('SELECT likesCount FROM post_comments WHERE id = ?', [
      commentId,
    ]);
    if (io) {
      io.emit('comment:liked', {
        commentId,
        postId: comment.postId,
        uid: authReq.uid!,
        liked: false,
        likes: row.likesCount,
      });
    }
    res.json({ liked: false, likes: row.likesCount });
  } else {
    await query('INSERT INTO comment_likes (commentId, uid, createdAt) VALUES (?,?,?)', [
      commentId,
      authReq.uid!,
      Date.now(),
    ]);
    await query('UPDATE post_comments SET likesCount = likesCount + 1 WHERE id = ?', [commentId]);
    const [row] = await query<Array<{ likesCount: number }>>('SELECT likesCount FROM post_comments WHERE id = ?', [
      commentId,
    ]);
    if (io) {
      io.emit('comment:liked', {
        commentId,
        postId: comment.postId,
        uid: authReq.uid!,
        liked: true,
        likes: row.likesCount,
      });
    }
    res.json({ liked: true, likes: row.likesCount });
  }
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
  await query('DELETE FROM comment_mentions WHERE commentId = ?', [req.params.commentId]);
  await query('UPDATE posts SET commentsCount = GREATEST(0, commentsCount - 1) WHERE id = ?', [comment.postId]);
  res.json({ success: true });
});

export default router;
