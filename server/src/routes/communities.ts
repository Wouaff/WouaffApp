import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Server } from 'socket.io';
import { getOne, query } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';
import { notifyIndexNow } from '../services/indexnow.js';
import { enqueueJob } from '../services/queue.js';
import type {
  AuthRequest,
  Community,
  CommunityComment,
  CommunityPost,
  CommunityRole,
  CommunitySort,
  CommunityTopWindow,
} from '../types/index.js';
import { resolveMentions } from '../utils/mentions.js';

/* ── Constantes ── */
const NAME_RE = /^[a-z0-9_]{2,50}$/;
const MAX_RULES = 20;
const MAX_RULE_LENGTH = 200;
const MAX_TITLE = 300;
const MAX_CONTENT = 20000;
const MAX_COMMENT = 2000;
const FEED_LIMIT = 50;

export const COMMUNITY_CATEGORIES = [
  'Actu FR',
  'Politique',
  'Tech',
  'Sport',
  'Humour',
  'Culture',
  'Jeux vidéo',
  'Sciences',
  'Musique',
  'Autre',
];

const TOP_WINDOWS_MS: Record<CommunityTopWindow, number> = {
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000,
};

/* ── Helpers ── */

function slugifyName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseRules(rules: unknown): string[] {
  if (!Array.isArray(rules)) return [];
  return rules
    .map((r) => (typeof r === 'string' ? r.trim().slice(0, MAX_RULE_LENGTH) : ''))
    .filter(Boolean)
    .slice(0, MAX_RULES);
}

async function getCommunityRow(name: string): Promise<Record<string, unknown> | null> {
  return getOne<Record<string, unknown>>('SELECT * FROM communities WHERE name = ?', [name]);
}

async function getRole(communityId: string, uid: string): Promise<CommunityRole | null> {
  const row = await getOne<{ role: string }>(
    'SELECT role FROM community_members WHERE communityId = ? AND userId = ?',
    [communityId, uid],
  );
  if (!row) return null;
  return (row.role as CommunityRole) || null;
}

async function hasRole(communityId: string, uid: string, roles: CommunityRole[]): Promise<boolean> {
  const role = await getRole(communityId, uid);
  return !!role && roles.includes(role);
}

async function isBanned(communityId: string, uid: string): Promise<boolean> {
  const row = await getOne<{ expiresAt: number | null }>(
    'SELECT expiresAt FROM community_bans WHERE communityId = ? AND userId = ?',
    [communityId, uid],
  );
  if (!row) return false;
  return !row.expiresAt || row.expiresAt > Date.now();
}

async function toCommunity(row: Record<string, unknown>, uid?: string): Promise<Community> {
  const id = row.id as string;
  const [memberRow, postRow] = await Promise.all([
    query<Array<{ c: number }>>('SELECT COUNT(*) AS c FROM community_members WHERE communityId = ?', [id]),
    query<Array<{ c: number }>>(
      'SELECT COUNT(*) AS c FROM community_posts WHERE communityId = ? AND deletedAt IS NULL',
      [id],
    ),
  ]);
  let isSubscribed = false;
  let myRole: CommunityRole | null = null;
  if (uid) {
    const [sub, member] = await Promise.all([
      getOne<{ communityId: string }>('SELECT communityId FROM subscriptions WHERE userId = ? AND communityId = ?', [
        uid,
        id,
      ]),
      getOne<{ role: string }>('SELECT role FROM community_members WHERE communityId = ? AND userId = ?', [id, uid]),
    ]);
    isSubscribed = !!sub;
    myRole = (member?.role as CommunityRole) || null;
  }
  let rules: string[] = [];
  if (row.rules) {
    try {
      const parsed = JSON.parse(row.rules as string);
      if (Array.isArray(parsed)) rules = parsed.map(String);
    } catch {
      /* règles invalides → liste vide */
    }
  }
  return {
    id,
    name: row.name as string,
    displayName: (row.displayName as string) || null,
    description: (row.description as string) || null,
    category: (row.category as string) || 'Autre',
    rules,
    avatar: (row.avatar as string) || null,
    banner: (row.banner as string) || null,
    creatorId: row.creatorId as string,
    isPrivate: (row.isPrivate as number) === 1,
    createdAt: row.createdAt as number,
    memberCount: memberRow[0]?.c ?? 0,
    postCount: postRow[0]?.c ?? 0,
    isSubscribed,
    myRole,
  };
}

function enrichRules(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw as string);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((r) => (typeof r === 'string' ? r.trim().slice(0, MAX_RULE_LENGTH) : ''))
      .filter(Boolean)
      .slice(0, MAX_RULES);
  } catch {
    return [];
  }
}

async function enrichCommunities(rows: Array<Record<string, unknown>>, uid?: string): Promise<Community[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id as string);

  const ph = ids.map(() => '?').join(',');

  const needMemberCount = rows.some((r) => r.memberCount === undefined);
  const needPostCount = rows.some((r) => r.postCount === undefined);

  const [memberCounts, postCounts, subscriptions, roles] = await Promise.all([
    needMemberCount
      ? query<Array<{ communityId: string; c: number }>>(
          `SELECT communityId, COUNT(*) AS c FROM community_members WHERE communityId IN (${ph}) GROUP BY communityId`,
          ids,
        )
      : Promise.resolve([]),
    needPostCount
      ? query<Array<{ communityId: string; c: number }>>(
          `SELECT communityId, COUNT(*) AS c FROM community_posts WHERE communityId IN (${ph}) AND deletedAt IS NULL GROUP BY communityId`,
          ids,
        )
      : Promise.resolve([]),
    uid
      ? query<Array<{ communityId: string }>>(
          `SELECT communityId FROM subscriptions WHERE userId = ? AND communityId IN (${ph})`,
          [uid, ...ids],
        )
      : Promise.resolve([]),
    uid
      ? query<Array<{ communityId: string; role: string }>>(
          `SELECT communityId, role FROM community_members WHERE userId = ? AND communityId IN (${ph})`,
          [uid, ...ids],
        )
      : Promise.resolve([]),
  ]);

  const memberCountMap = new Map(memberCounts.map((r) => [r.communityId, r.c]));
  const postCountMap = new Map(postCounts.map((r) => [r.communityId, r.c]));
  const subSet = new Set(subscriptions.map((s) => s.communityId));
  const roleMap = new Map(roles.map((r) => [r.communityId, r.role]));

  return rows.map((row) => {
    const id = row.id as string;
    return {
      id,
      name: row.name as string,
      displayName: (row.displayName as string) || null,
      description: (row.description as string) || null,
      category: (row.category as string) || 'Autre',
      rules: enrichRules(row.rules),
      avatar: (row.avatar as string) || null,
      banner: (row.banner as string) || null,
      creatorId: row.creatorId as string,
      isPrivate: (row.isPrivate as number) === 1,
      createdAt: row.createdAt as number,
      memberCount: row.memberCount !== undefined ? (row.memberCount as number) : (memberCountMap.get(id) ?? 0),
      postCount: row.postCount !== undefined ? (row.postCount as number) : (postCountMap.get(id) ?? 0),
      isSubscribed: subSet.has(id),
      myRole: (roleMap.get(id) as CommunityRole) || null,
    };
  });
}

const COMMUNITY_POST_SELECT = `SELECT p.id, p.communityId, p.authorId, p.title, p.content, p.type,
        p.upvotes, p.downvotes, p.commentCount, p.isPinned, p.createdAt,
        (p.upvotes - p.downvotes) AS score,
        c.name AS communityName, c.displayName AS communityDisplayName, c.avatar AS communityAvatar,
        u.pseudo AS authorPseudo, u.avatar AS authorAvatar,
        COALESCE(v.voteValue, 0) AS myVote
 FROM community_posts p
 JOIN communities c ON c.id = p.communityId
 LEFT JOIN users u ON u.uid = p.authorId
 LEFT JOIN community_votes v ON v.postId = p.id AND v.userId = ?`;

function toPost(row: Record<string, unknown>): CommunityPost {
  return {
    id: row.id as string,
    communityId: row.communityId as string,
    communityName: row.communityName as string,
    communityDisplayName: (row.communityDisplayName as string) || null,
    communityAvatar: (row.communityAvatar as string) || null,
    authorId: row.authorId as string,
    authorPseudo: (row.authorPseudo as string) || 'Utilisateur',
    authorAvatar: (row.authorAvatar as string) || null,
    title: row.title as string,
    content: (row.content as string) || null,
    type: (row.type as CommunityPost['type']) || 'text',
    upvotes: row.upvotes as number,
    downvotes: row.downvotes as number,
    score: row.score as number,
    commentCount: row.commentCount as number,
    isPinned: (row.isPinned as number) === 1,
    createdAt: row.createdAt as number,
    vote: row.myVote as number as -1 | 0 | 1,
  };
}

function orderBy(sort: CommunitySort): string {
  switch (sort) {
    case 'top':
      return 'ORDER BY (p.upvotes - p.downvotes) DESC, p.createdAt DESC';
    case 'hot':
      return 'ORDER BY (LOG10(GREATEST(1, ABS(p.upvotes - p.downvotes))) + SIGN(p.upvotes - p.downvotes) * (p.createdAt / 1000) / 45000) DESC, p.createdAt DESC';
    default:
      return 'ORDER BY p.isPinned DESC, p.createdAt DESC';
  }
}

async function getPostByQuery(
  where: string,
  params: Array<string | number>,
  viewerUid?: string,
): Promise<CommunityPost | null> {
  const row = await getOne<Record<string, unknown>>(
    `${COMMUNITY_POST_SELECT} WHERE ${where} AND p.deletedAt IS NULL`,
    viewerUid ? [viewerUid, ...params] : [null, ...params],
  );
  return row ? toPost(row) : null;
}

async function notifyMentions(
  post: CommunityPost,
  text: string,
  commentId: number | null,
  actorUid: string,
): Promise<void> {
  const uids = await resolveMentions(text);
  const seen = new Set<string>();
  for (const targetUid of uids) {
    if (!targetUid || targetUid === actorUid || seen.has(targetUid)) continue;
    seen.add(targetUid);
    await query(
      'INSERT IGNORE INTO community_mentions (communityId, postId, userId, commentId, createdAt) VALUES (?,?,?,?,?)',
      [post.communityId, post.id, targetUid, commentId ?? 0, Date.now()],
    );
    enqueueJob('notification', {
      uid: targetUid,
      actorUid,
      type: 'community_mention',
      postId: post.id,
      commentId: commentId ?? undefined,
    }).catch(() => {});
  }
}

const router: Router = Router();
router.use(verifyToken);

/* ═══════════ Découvrir / onboarding (routes avant /:name) ═══════════ */

/* GET /communities — découvrir : communautés populaires groupées par catégorie */
router.get('/', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const limit = Math.min(FEED_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || 30));
  const rows = await query<Array<Record<string, unknown>>>(
    `SELECT c.*, COUNT(DISTINCT m.userId) AS memberCount,
            (SELECT COUNT(*) FROM community_posts p WHERE p.communityId = c.id AND p.deletedAt IS NULL) AS postCount
     FROM communities c
     LEFT JOIN community_members m ON m.communityId = c.id
     WHERE c.isPrivate = 0
     GROUP BY c.id
     ORDER BY memberCount DESC, c.createdAt DESC`,
  );
  const groups: Array<{ category: string; items: Community[] }> = [];
  const byCategory = new Map<string, Community[]>();
  const enriched = await enrichCommunities(rows, authReq.uid);
  for (const community of enriched) {
    const cat = community.category || 'Autre';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(community);
  }
  for (const category of COMMUNITY_CATEGORIES) {
    const items = (byCategory.get(category) || []).slice(0, limit);
    if (items.length > 0) groups.push({ category, items });
  }
  for (const [category, items] of byCategory) {
    if (!COMMUNITY_CATEGORIES.includes(category)) {
      groups.push({ category, items: items.slice(0, limit) });
    }
  }
  res.json({ categories: COMMUNITY_CATEGORIES, groups });
});

/* GET /communities/mine — mes abonnements */
router.get('/mine', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const rows = await query<Array<Record<string, unknown>>>(
    `SELECT c.* FROM subscriptions s
     JOIN communities c ON c.id = s.communityId
     WHERE s.userId = ?
     ORDER BY s.createdAt DESC`,
    [authReq.uid!],
  );
  const items = await enrichCommunities(rows, authReq.uid);
  res.json(items);
});

/* GET /communities/search?q= — recherche par nom */
router.get('/search', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const q = ((req.query.q as string) || '').trim().toLowerCase();
  const limit = Math.min(FEED_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  if (!q) {
    res.json([]);
    return;
  }
  const rows = await query<Array<Record<string, unknown>>>(
    `SELECT c.* FROM communities c
     WHERE c.isPrivate = 0 AND (c.name LIKE ? OR c.displayName LIKE ? OR c.description LIKE ?)
     ORDER BY c.createdAt DESC
     LIMIT ?`,
    [`%${q}%`, `%${q}%`, `%${q}%`, limit],
  );
  const items = await enrichCommunities(rows, authReq.uid);
  res.json(items);
});

/* GET /communities/discover?category= — liste plate populaire (feed onboarding) */
router.get('/discover', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const category = (req.query.category as string) || '';
  const limit = Math.min(FEED_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || 30));
  const params: Array<string | number> = [];
  let where = 'c.isPrivate = 0';
  if (category) {
    where += ' AND c.category = ?';
    params.push(category);
  }
  const rows = await query<Array<Record<string, unknown>>>(
    `SELECT c.*, COUNT(DISTINCT m.userId) AS memberCount,
            (SELECT COUNT(*) FROM community_posts p WHERE p.communityId = c.id AND p.deletedAt IS NULL) AS postCount
     FROM communities c
     LEFT JOIN community_members m ON m.communityId = c.id
     WHERE ${where}
     GROUP BY c.id
     ORDER BY memberCount DESC, c.createdAt DESC
     LIMIT ?`,
    [...params, limit],
  );
  const items = await enrichCommunities(rows, authReq.uid);
  res.json(items);
});

/* GET /communities/feed — feed principal = agrégation chronologique des posts des communautés abonnées */
router.get('/feed', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const sort = (req.query.sort as CommunitySort) || 'new';
  const window = (req.query.window as CommunityTopWindow) || 'week';
  const limit = Math.min(FEED_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
  const params: Array<string | number> = [authReq.uid!, authReq.uid!];
  let where = `p.deletedAt IS NULL AND c.isPrivate = 0
               AND p.communityId IN (SELECT communityId FROM subscriptions WHERE userId = ?)`;
  if (sort === 'top') {
    where += ' AND p.createdAt >= ?';
    params.push(Date.now() - (TOP_WINDOWS_MS[window] ?? TOP_WINDOWS_MS.week));
  }
  params.push(limit, offset);
  const rows = await query<Array<Record<string, unknown>>>(
    `${COMMUNITY_POST_SELECT}
     WHERE ${where}
     ${orderBy(sort)}
     LIMIT ? OFFSET ?`,
    params,
  );
  const items = rows.map(toPost);
  res.json({ items, hasMore: items.length === limit });
});

/* POST /communities/onboard — à l'inscription : abonner à ≥ 3 communautés */
router.post('/onboard', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { names } = req.body as { names?: string[] };
  const list = Array.isArray(names) ? names.map((n) => String(n).trim().toLowerCase()).filter(Boolean) : [];
  if (list.length < 3) {
    res.status(400).json({ error: 'Choisissez au minimum 3 communautés' });
    return;
  }
  const unique = [...new Set(list)];
  const placeholders = unique.map(() => '?').join(',');
  const rows = await query<Array<{ id: string }>>(`SELECT id FROM communities WHERE name IN (${placeholders})`, unique);
  const ids = rows.map((r) => r.id);
  if (ids.length < 3) {
    res.status(400).json({ error: 'Certaines communautés sont introuvables' });
    return;
  }
  const now = Date.now();
  for (const id of ids) {
    await query('INSERT IGNORE INTO subscriptions (userId, communityId, createdAt) VALUES (?,?,?)', [
      authReq.uid!,
      id,
      now,
    ]);
    await query('INSERT IGNORE INTO community_members (communityId, userId, role, joinedAt) VALUES (?,?,?,?)', [
      id,
      authReq.uid!,
      'member',
      now,
    ]);
  }
  res.json({ subscribed: ids.length });
});

/* GET /communities/post/:id — post isolé (navigation depuis une notification) */
router.get('/post/:id', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const post = await getPostByQuery('p.id = ?', [req.params.id], authReq.uid);
  if (!post) {
    res.status(404).json({ error: 'Post introuvable' });
    return;
  }
  res.json(post);
});

/* ═══════════ Création d'une communauté ═══════════ */

/* POST /communities — créer une communauté en ~30 secondes */
router.post('/', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { name, displayName, description, category, rules, avatar, banner, isPrivate } = req.body as {
    name?: string;
    displayName?: string;
    description?: string;
    category?: string;
    rules?: string[];
    avatar?: string;
    banner?: string;
    isPrivate?: boolean;
  };
  const slug = slugifyName(name || '');
  if (!NAME_RE.test(slug)) {
    res.status(400).json({ error: 'Nom invalide (2 à 50 caractères : lettres minuscules, chiffres, _)' });
    return;
  }
  const cleanRules = parseRules(rules);
  const now = Date.now();
  const id = randomUUID();
  try {
    await query(
      `INSERT INTO communities (id, name, displayName, description, category, rules, avatar, banner, creatorId, isPrivate, createdAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        slug,
        (displayName || slug).trim().slice(0, 100) || null,
        (description || '').trim().slice(0, 500) || null,
        COMMUNITY_CATEGORIES.includes(category || '') ? category : 'Autre',
        cleanRules.length > 0 ? JSON.stringify(cleanRules) : null,
        (avatar || '').trim() || null,
        (banner || '').trim() || null,
        authReq.uid!,
        isPrivate ? 1 : 0,
        now,
      ],
    );
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: `La communauté c/${slug} existe déjà` });
      return;
    }
    throw err;
  }
  await query('INSERT INTO community_members (communityId, userId, role, joinedAt) VALUES (?,?,?,?)', [
    id,
    authReq.uid!,
    'admin',
    now,
  ]);
  await query('INSERT IGNORE INTO subscriptions (userId, communityId, createdAt) VALUES (?,?,?)', [
    authReq.uid!,
    id,
    now,
  ]);
  const community = await toCommunity(
    { id, name: slug, creatorId: authReq.uid, createdAt: now } as Record<string, unknown>,
    authReq.uid,
  );
  const io: Server = req.app.get('io');
  if (io) io.emit('community:created', community);
  notifyIndexNow(`/c/${slug}`);
  res.json(community);
});

/* ═══════════ Détail / paramétrage d'une communauté ═══════════ */

/* GET /communities/:name — détail d'une communauté */
router.get('/:name', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  res.json(await toCommunity(row, authReq.uid));
});

/* PUT /communities/:name — modifier (admin uniquement) */
router.put('/:name', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const id = row.id as string;
  if (!(await hasRole(id, authReq.uid!, ['admin']))) {
    res.status(403).json({ error: 'Réservé à l’administrateur de la communauté' });
    return;
  }
  const { displayName, description, category, rules, avatar, banner, isPrivate } = req.body as {
    displayName?: string;
    description?: string;
    category?: string;
    rules?: string[];
    avatar?: string;
    banner?: string;
    isPrivate?: boolean;
  };
  const cleanRules = parseRules(rules);
  await query(
    `UPDATE communities SET
       displayName = ?, description = ?, category = ?, rules = ?, avatar = ?, banner = ?, isPrivate = ?
     WHERE id = ?`,
    [
      typeof displayName === 'string' ? displayName.trim().slice(0, 100) : row.displayName,
      typeof description === 'string' ? description.trim().slice(0, 500) : row.description,
      COMMUNITY_CATEGORIES.includes(category || '') ? category : row.category,
      cleanRules.length > 0 ? JSON.stringify(cleanRules) : row.rules,
      typeof avatar === 'string' ? avatar.trim() || null : row.avatar,
      typeof banner === 'string' ? banner.trim() || null : row.banner,
      typeof isPrivate === 'boolean' ? (isPrivate ? 1 : 0) : row.isPrivate,
      id,
    ],
  );
  const io: Server = req.app.get('io');
  if (io) io.to(`community:${id}`).emit('community:updated', { communityId: id });
  const updated = await getCommunityRow(req.params.name.toLowerCase());
  notifyIndexNow(`/c/${req.params.name}`);
  res.json(await toCommunity(updated!, authReq.uid));
});

/* ═══════════ Abonnement ═══════════ */

/* POST /communities/:name/subscribe — s'abonner */
router.post('/:name/subscribe', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const id = row.id as string;
  if (await isBanned(id, authReq.uid!)) {
    res.status(403).json({ error: 'Vous êtes banni de cette communauté' });
    return;
  }
  const now = Date.now();
  await query('INSERT IGNORE INTO subscriptions (userId, communityId, createdAt) VALUES (?,?,?)', [
    authReq.uid!,
    id,
    now,
  ]);
  await query('INSERT IGNORE INTO community_members (communityId, userId, role, joinedAt) VALUES (?,?,?,?)', [
    id,
    authReq.uid!,
    'member',
    now,
  ]);
  const io: Server = req.app.get('io');
  if (io) io.emit('community:subscribed', { communityId: id, userId: authReq.uid });
  res.json({ subscribed: true });
});

/* POST /communities/:name/unsubscribe — se désabonner (l'admin/modo conserve son rôle) */
router.post('/:name/unsubscribe', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const id = row.id as string;
  await query('DELETE FROM subscriptions WHERE userId = ? AND communityId = ?', [authReq.uid!, id]);
  const role = await getRole(id, authReq.uid!);
  if (role === 'member') {
    await query('DELETE FROM community_members WHERE communityId = ? AND userId = ?', [id, authReq.uid!]);
  }
  const io: Server = req.app.get('io');
  if (io) io.emit('community:subscribed', { communityId: id, userId: authReq.uid, subscribed: false });
  res.json({ subscribed: false });
});

/* ═══════════ Membres & rôles ═══════════ */

/* POST /communities/:name/members/:uid/role — nommer/rétrograder un modérateur (admin) */
router.post('/:name/members/:uid/role', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const id = row.id as string;
  if (!(await hasRole(id, authReq.uid!, ['admin']))) {
    res.status(403).json({ error: 'Réservé à l’administrateur de la communauté' });
    return;
  }
  const { role } = req.body as { role?: string };
  const targetUid = req.params.uid;
  if (targetUid === authReq.uid) {
    res.status(400).json({ error: 'Impossible de modifier votre propre rôle' });
    return;
  }
  const targetRole = await getRole(id, targetUid);
  if (targetRole === 'admin') {
    res.status(403).json({ error: 'Impossible de modifier le rôle d’un administrateur' });
    return;
  }
  if (role === 'moderator') {
    await query(
      'INSERT INTO community_members (communityId, userId, role, joinedAt) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE role=VALUES(role)',
      [id, targetUid, 'moderator', Date.now()],
    );
    await query('INSERT IGNORE INTO subscriptions (userId, communityId, createdAt) VALUES (?,?,?)', [
      targetUid,
      id,
      Date.now(),
    ]);
  } else if (role === 'member') {
    await query('UPDATE community_members SET role = ? WHERE communityId = ? AND userId = ?', [
      'member',
      id,
      targetUid,
    ]);
  } else {
    res.status(400).json({ error: 'Rôle invalide' });
    return;
  }
  res.json({ success: true, role });
});

/* DELETE /communities/:name/members/:uid — quitter (soi) ou exclure (modérateur) */
router.delete('/:name/members/:uid', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const id = row.id as string;
  const targetUid = req.params.uid === 'me' ? authReq.uid! : req.params.uid;
  if (targetUid === authReq.uid) {
    const role = await getRole(id, authReq.uid!);
    if (role === 'admin') {
      res.status(400).json({ error: 'Transférez le rôle d’admin avant de quitter' });
      return;
    }
    await query('DELETE FROM community_members WHERE communityId = ? AND userId = ?', [id, authReq.uid!]);
    await query('DELETE FROM subscriptions WHERE userId = ? AND communityId = ?', [authReq.uid!, id]);
    res.json({ success: true, left: true });
    return;
  }
  if (!(await hasRole(id, authReq.uid!, ['admin', 'moderator']))) {
    res.status(403).json({ error: 'Action réservée aux modérateurs' });
    return;
  }
  const targetRole = await getRole(id, targetUid);
  if (targetRole === 'admin') {
    res.status(403).json({ error: 'Impossible d’exclure un administrateur' });
    return;
  }
  await query('DELETE FROM community_members WHERE communityId = ? AND userId = ?', [id, targetUid]);
  await query('DELETE FROM subscriptions WHERE userId = ? AND communityId = ?', [targetUid, id]);
  res.json({ success: true, kicked: true });
});

/* ═══════════ Bannissements temporaires ═══════════ */

/* POST /communities/:name/bans — bannir temporairement (modérateur) */
router.post('/:name/bans', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const id = row.id as string;
  if (!(await hasRole(id, authReq.uid!, ['admin', 'moderator']))) {
    res.status(403).json({ error: 'Action réservée aux modérateurs' });
    return;
  }
  const { uid, reason, durationHours } = req.body as { uid?: string; reason?: string; durationHours?: number };
  if (!uid || uid === authReq.uid) {
    res.status(400).json({ error: 'Utilisateur invalide' });
    return;
  }
  const targetRole = await getRole(id, uid);
  if (targetRole === 'admin') {
    res.status(403).json({ error: 'Impossible de bannir un administrateur' });
    return;
  }
  const hours = typeof durationHours === 'number' && durationHours > 0 ? Math.min(8760, durationHours) : null;
  await query(
    `INSERT INTO community_bans (communityId, userId, reason, bannedBy, createdAt, expiresAt) VALUES (?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE reason=VALUES(reason), bannedBy=VALUES(bannedBy), createdAt=VALUES(createdAt), expiresAt=VALUES(expiresAt)`,
    [
      id,
      uid,
      (reason || '').trim().slice(0, 300) || null,
      authReq.uid!,
      Date.now(),
      hours ? Date.now() + hours * 3600_000 : null,
    ],
  );
  await query('DELETE FROM subscriptions WHERE userId = ? AND communityId = ?', [uid, id]);
  res.json({ success: true, durationHours: hours });
});

/* DELETE /communities/:name/bans/:uid — lever un bannissement (modérateur) */
router.delete('/:name/bans/:uid', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const id = row.id as string;
  if (!(await hasRole(id, authReq.uid!, ['admin', 'moderator']))) {
    res.status(403).json({ error: 'Action réservée aux modérateurs' });
    return;
  }
  await query('DELETE FROM community_bans WHERE communityId = ? AND userId = ?', [id, req.params.uid]);
  res.json({ success: true });
});

/* ═══════════ Feed d'une communauté ═══════════ */

/* GET /communities/:name/feed — vue /c/nom avec tri Nouveau / Top (jour, semaine, mois) / Chaud */
router.get('/:name/feed', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const id = row.id as string;
  const sort = (req.query.sort as CommunitySort) || 'new';
  const window = (req.query.window as CommunityTopWindow) || 'week';
  const limit = Math.min(FEED_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
  const params: Array<string | number> = [authReq.uid!, id];
  let where = 'p.deletedAt IS NULL AND p.communityId = ?';
  if (sort === 'top') {
    where += ' AND p.createdAt >= ?';
    params.push(Date.now() - (TOP_WINDOWS_MS[window] ?? TOP_WINDOWS_MS.week));
  }
  params.push(limit, offset);
  const rows = await query<Array<Record<string, unknown>>>(
    `${COMMUNITY_POST_SELECT}
     WHERE ${where}
     ${orderBy(sort)}
     LIMIT ? OFFSET ?`,
    params,
  );
  const items = rows.map(toPost);
  res.json({ items, hasMore: items.length === limit });
});

/* ═══════════ Posts ═══════════ */

/* POST /communities/:name/posts — publier un post dans la communauté */
router.post('/:name/posts', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const id = row.id as string;
  if (await isBanned(id, authReq.uid!)) {
    res.status(403).json({ error: 'Vous êtes banni de cette communauté' });
    return;
  }
  const isPrivate = (row.isPrivate as number) === 1;
  if (isPrivate && !(await getRole(id, authReq.uid!))) {
    res.status(403).json({ error: 'Cette communauté est privée : rejoignez-la pour publier' });
    return;
  }
  const { title, content, type } = req.body as {
    title?: string;
    content?: string;
    type?: string;
  };
  const cleanTitle = (title || '').trim();
  if (!cleanTitle) {
    res.status(400).json({ error: 'Titre requis' });
    return;
  }
  if (cleanTitle.length > MAX_TITLE) {
    res.status(400).json({ error: `Titre limité à ${MAX_TITLE} caractères` });
    return;
  }
  const postType = (['text', 'link', 'image'] as const).includes(type as 'text' | 'link' | 'image')
    ? (type as 'text' | 'link' | 'image')
    : 'text';
  const cleanContent = (content || '').trim();
  if (postType === 'link' && !/^https?:\/\//i.test(cleanContent)) {
    res.status(400).json({ error: 'Un post lien doit contenir une URL valide' });
    return;
  }
  if (postType === 'image' && !/^(data:image\/|https?:\/\/)/i.test(cleanContent)) {
    res.status(400).json({ error: 'Image invalide' });
    return;
  }
  if (cleanContent.length > MAX_CONTENT) {
    res.status(400).json({ error: `Contenu limité à ${MAX_CONTENT} caractères` });
    return;
  }
  const postId = randomUUID();
  const now = Date.now();
  await query(
    'INSERT INTO community_posts (id, communityId, authorId, title, content, type, upvotes, downvotes, commentCount, isPinned, createdAt) VALUES (?,?,?,?,?,?,0,0,0,0,?)',
    [postId, id, authReq.uid!, cleanTitle, cleanContent || null, postType, now],
  );
  const post = await getPostByQuery('p.id = ?', [postId], authReq.uid);
  if (post && cleanContent) await notifyMentions(post, cleanContent, null, authReq.uid!);
  const io: Server = req.app.get('io');
  if (io) io.to(`community:${id}`).emit('community:post', post);
  res.json(post);
});

/* GET /communities/:name/posts/:postId — détail d'un post */
router.get('/:name/posts/:postId', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const post = await getPostByQuery('p.id = ?', [req.params.postId], authReq.uid);
  if (!post || post.communityId !== (row.id as string)) {
    res.status(404).json({ error: 'Post introuvable' });
    return;
  }
  res.json(post);
});

/* POST /communities/:name/posts/:postId/vote — upvote / downvote (score = up - down) */
router.post('/:name/posts/:postId/vote', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const postId = req.params.postId;
  const post = await getOne<{ communityId: string }>(
    'SELECT communityId FROM community_posts WHERE id = ? AND deletedAt IS NULL',
    [postId],
  );
  if (!post || post.communityId !== (row.id as string)) {
    res.status(404).json({ error: 'Post introuvable' });
    return;
  }
  const value = req.body?.value;
  const voteValue = value === 1 ? 1 : value === -1 ? -1 : 0;
  const existing = await getOne<{ voteValue: number }>(
    'SELECT voteValue FROM community_votes WHERE postId = ? AND userId = ?',
    [postId, authReq.uid!],
  );
  const userId = authReq.uid!;
  const communityId = row.id as string;
  if (!existing && voteValue === 0) {
    res.json({ vote: 0 });
    return;
  }
  if (!existing) {
    await query('INSERT INTO community_votes (communityId, postId, userId, voteValue, createdAt) VALUES (?,?,?,?,?)', [
      communityId,
      postId,
      userId,
      voteValue,
      Date.now(),
    ]);
    await query(
      voteValue === 1
        ? 'UPDATE community_posts SET upvotes = upvotes + 1 WHERE id = ?'
        : 'UPDATE community_posts SET downvotes = downvotes + 1 WHERE id = ?',
      [postId],
    );
  } else if (existing.voteValue === voteValue) {
    await query('DELETE FROM community_votes WHERE postId = ? AND userId = ?', [postId, userId]);
    await query(
      existing.voteValue === 1
        ? 'UPDATE community_posts SET upvotes = GREATEST(0, upvotes - 1) WHERE id = ?'
        : 'UPDATE community_posts SET downvotes = GREATEST(0, downvotes - 1) WHERE id = ?',
      [postId],
    );
  } else {
    await query('UPDATE community_votes SET voteValue = ? WHERE postId = ? AND userId = ?', [
      voteValue,
      postId,
      userId,
    ]);
    if (existing.voteValue === 1) {
      await query(
        'UPDATE community_posts SET upvotes = GREATEST(0, upvotes - 1), downvotes = downvotes + 1 WHERE id = ?',
        [postId],
      );
    } else {
      await query(
        'UPDATE community_posts SET downvotes = GREATEST(0, downvotes - 1), upvotes = upvotes + 1 WHERE id = ?',
        [postId],
      );
    }
  }
  const [updated] = await query<Array<{ upvotes: number; downvotes: number }>>(
    'SELECT upvotes, downvotes FROM community_posts WHERE id = ?',
    [postId],
  );
  const io: Server = req.app.get('io');
  if (io)
    io.to(`community:${communityId}`).emit('community:vote', {
      postId,
      vote: voteValue,
      upvotes: updated?.upvotes ?? 0,
      downvotes: updated?.downvotes ?? 0,
      score: (updated?.upvotes ?? 0) - (updated?.downvotes ?? 0),
    });
  res.json({ vote: voteValue, upvotes: updated?.upvotes ?? 0, downvotes: updated?.downvotes ?? 0 });
});

/* POST /communities/:name/posts/:postId/pin — épingler / désépingler (modérateur) */
router.post('/:name/posts/:postId/pin', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const id = row.id as string;
  if (!(await hasRole(id, authReq.uid!, ['admin', 'moderator']))) {
    res.status(403).json({ error: 'Action réservée aux modérateurs' });
    return;
  }
  const { pinned } = req.body as { pinned?: boolean };
  const result = await query<{ affectedRows?: number }>(
    'UPDATE community_posts SET isPinned = ? WHERE id = ? AND communityId = ? AND deletedAt IS NULL',
    [pinned ? 1 : 0, req.params.postId, id],
  );
  if ((result as unknown as { affectedRows?: number }).affectedRows === 0) {
    res.status(404).json({ error: 'Post introuvable' });
    return;
  }
  res.json({ success: true, pinned: !!pinned });
});

/* DELETE /communities/:name/posts/:postId — supprimer un post (auteur ou modérateur) */
router.delete('/:name/posts/:postId', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const id = row.id as string;
  const post = await getOne<{ authorId: string }>(
    'SELECT authorId FROM community_posts WHERE id = ? AND communityId = ? AND deletedAt IS NULL',
    [req.params.postId, id],
  );
  if (!post) {
    res.status(404).json({ error: 'Post introuvable' });
    return;
  }
  const isMod = await hasRole(id, authReq.uid!, ['admin', 'moderator']);
  if (post.authorId !== authReq.uid && !isMod) {
    res.status(403).json({ error: 'Interdit' });
    return;
  }
  const now = Date.now();
  await query('UPDATE community_posts SET deletedAt = ? WHERE id = ?', [now, req.params.postId]);
  await query('UPDATE community_comments SET deletedAt = ? WHERE postId = ? AND deletedAt IS NULL', [
    now,
    req.params.postId,
  ]);
  const io: Server = req.app.get('io');
  if (io) io.to(`community:${id}`).emit('community:post:deleted', { postId: req.params.postId });
  res.json({ success: true });
});

/* ═══════════ Commentaires ═══════════ */

/* GET /communities/:name/posts/:postId/comments — liste des commentaires */
router.get('/:name/posts/:postId/comments', async (req: Request, res: Response) => {
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const id = row.id as string;
  const post = await getOne<{ id: string }>(
    'SELECT id FROM community_posts WHERE id = ? AND communityId = ? AND deletedAt IS NULL',
    [req.params.postId, id],
  );
  if (!post) {
    res.status(404).json({ error: 'Post introuvable' });
    return;
  }
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
  const rows = await query<Array<Record<string, unknown>>>(
    `SELECT c.id, c.postId, c.authorId, c.parentId, c.content, c.upvotes, c.createdAt, c.deletedAt,
            u.pseudo AS authorPseudo, u.avatar AS authorAvatar
     FROM community_comments c
     LEFT JOIN users u ON u.uid = c.authorId
     WHERE c.postId = ? AND c.communityId = ?
     ORDER BY c.createdAt ASC
     LIMIT ? OFFSET ?`,
    [req.params.postId, id, limit, offset],
  );
  const comments: CommunityComment[] = rows.map((r) => ({
    id: r.id as number,
    postId: r.postId as string,
    authorId: r.authorId as string,
    authorPseudo: (r.authorPseudo as string) || 'Utilisateur',
    authorAvatar: (r.authorAvatar as string) || null,
    content: (r.content as string) || '',
    upvotes: r.upvotes as number,
    createdAt: r.createdAt as number,
    deleted: r.deletedAt != null,
  }));
  res.json({ items: comments, hasMore: comments.length === limit });
});

/* POST /communities/:name/posts/:postId/comments — répondre à un post */
router.post('/:name/posts/:postId/comments', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const id = row.id as string;
  if (await isBanned(id, authReq.uid!)) {
    res.status(403).json({ error: 'Vous êtes banni de cette communauté' });
    return;
  }
  const post = await getOne<{ id: string; authorId: string }>(
    'SELECT id, authorId FROM community_posts WHERE id = ? AND communityId = ? AND deletedAt IS NULL',
    [req.params.postId, id],
  );
  if (!post) {
    res.status(404).json({ error: 'Post introuvable' });
    return;
  }
  const { content } = req.body as { content?: string };
  const cleanContent = (content || '').trim();
  if (!cleanContent) {
    res.status(400).json({ error: 'Contenu requis' });
    return;
  }
  if (cleanContent.length > MAX_COMMENT) {
    res.status(400).json({ error: `Commentaire limité à ${MAX_COMMENT} caractères` });
    return;
  }
  const now = Date.now();
  const result = await query<{ insertId: number }>(
    'INSERT INTO community_comments (communityId, postId, authorId, parentId, content, upvotes, createdAt) VALUES (?,?,?,?,?,0,?)',
    [id, req.params.postId, authReq.uid!, null, cleanContent, now],
  );
  const commentId = (result as unknown as { insertId?: number }).insertId || 0;
  await query('UPDATE community_posts SET commentCount = commentCount + 1 WHERE id = ?', [req.params.postId]);
  const comment: CommunityComment = {
    id: commentId,
    postId: req.params.postId,
    authorId: authReq.uid!,
    authorPseudo: 'Vous',
    authorAvatar: null,
    content: cleanContent,
    upvotes: 0,
    createdAt: now,
    deleted: false,
  };
  const postItem = await getPostByQuery('p.id = ?', [req.params.postId], authReq.uid);
  const io: Server = req.app.get('io');
  if (io) io.to(`community:${id}`).emit('community:comment', { postId: req.params.postId, comment });
  if (postItem) {
    await notifyMentions(postItem, cleanContent, commentId, authReq.uid!);
  }
  if (post.authorId !== authReq.uid) {
    enqueueJob('notification', {
      uid: post.authorId,
      actorUid: authReq.uid!,
      type: 'community_reply',
      postId: req.params.postId,
      commentId,
    }).catch(() => {});
  }
  res.json(comment);
});

/* DELETE /communities/:name/posts/:postId/comments/:commentId — supprimer un commentaire */
router.delete('/:name/posts/:postId/comments/:commentId', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getCommunityRow(req.params.name.toLowerCase());
  if (!row) {
    res.status(404).json({ error: 'Communauté introuvable' });
    return;
  }
  const id = row.id as string;
  const comment = await getOne<{ authorId: string }>(
    'SELECT authorId FROM community_comments WHERE id = ? AND postId = ? AND communityId = ? AND deletedAt IS NULL',
    [req.params.commentId, req.params.postId, id],
  );
  if (!comment) {
    res.status(404).json({ error: 'Commentaire introuvable' });
    return;
  }
  const isMod = await hasRole(id, authReq.uid!, ['admin', 'moderator']);
  if (comment.authorId !== authReq.uid && !isMod) {
    res.status(403).json({ error: 'Interdit' });
    return;
  }
  const now = Date.now();
  await query('UPDATE community_comments SET deletedAt = ? WHERE id = ?', [now, req.params.commentId]);
  await query('UPDATE community_posts SET commentCount = GREATEST(0, commentCount - 1) WHERE id = ?', [
    req.params.postId,
  ]);
  const io: Server = req.app.get('io');
  if (io)
    io.to(`community:${id}`).emit('community:comment:deleted', {
      postId: req.params.postId,
      commentId: parseInt(req.params.commentId, 10),
    });
  res.json({ success: true });
});

export default router;
