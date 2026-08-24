import type { Request, Response } from 'express';
import { Router } from 'express';
import { query } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';
import {
  getOnboardingCommunitySuggestions,
  getOnboardingStatus,
  getOnboardingUserSuggestions,
  markOnboardingCompleted,
} from '../services/rtdb.js';
import type { AuthRequest } from '../types/index.js';

const MIN_SELECTION = 8;
const MAX_SELECTION = 10;
const SUGGEST_LIMIT = 12;

const router: Router = Router();
router.use(verifyToken);

/* GET /onboarding/status, l'onboarding est-il terminé / nécessaire ? */
router.get('/status', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json(await getOnboardingStatus(authReq.uid!));
});

/* GET /onboarding/suggestions, comptes & communautés à proposer */
router.get('/suggestions', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const [users, communityRows] = await Promise.all([
    getOnboardingUserSuggestions(authReq.uid!, SUGGEST_LIMIT),
    getOnboardingCommunitySuggestions(SUGGEST_LIMIT),
  ]);
  const communities = communityRows.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    displayName: (c.displayName as string) || null,
    avatar: (c.avatar as string) || null,
    category: (c.category as string) || 'Autre',
    memberCount: c.memberCount as number,
  }));
  res.json({ users, communities, minimum: Math.min(MIN_SELECTION, users.length + communities.length) });
});

/* POST /onboarding/complete, suivre les comptes + s'abonner aux communautés */
router.post('/complete', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { followUids, communityNames } = req.body as { followUids?: string[]; communityNames?: string[] };
  const followList = Array.isArray(followUids) ? followUids.map((u) => String(u)).filter(Boolean) : [];
  const communityList = Array.isArray(communityNames)
    ? communityNames.map((n) => String(n).trim().toLowerCase()).filter(Boolean)
    : [];
  const uniqueFollows = [...new Set(followList)];
  const uniqueCommunities = [...new Set(communityList)];

  const available = await getOnboardingUserSuggestions(authReq.uid!, SUGGEST_LIMIT);
  const availableUids = new Set(available.map((u) => u.uid));
  const validFollows = uniqueFollows.filter((u) => availableUids.has(u) && u !== authReq.uid);

  const availableCommunities = await getOnboardingCommunitySuggestions(SUGGEST_LIMIT);
  const availableNames = new Set(availableCommunities.map((c) => c.name as string));
  const validCommunities = uniqueCommunities.filter((n) => availableNames.has(n));

  const total = validFollows.length + validCommunities.length;
  const required = Math.min(MIN_SELECTION, availableUids.size + availableNames.size);
  if (total < required) {
    res.status(400).json({ error: `Choisis au moins ${required} comptes ou communautés pour ton fil` });
    return;
  }
  if (total > MAX_SELECTION) {
    res.status(400).json({ error: `Maximum ${MAX_SELECTION} comptes pour l'onboarding` });
    return;
  }
  if (validCommunities.length > 0) {
    const placeholders = validCommunities.map(() => '?').join(',');
    const rows = await query<Array<{ id: string }>>(`SELECT id FROM communities WHERE name IN (${placeholders})`, [
      ...validCommunities,
    ]);
    const ids = rows.map((r) => r.id);
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
  }
  for (const followedUid of validFollows) {
    await query('INSERT IGNORE INTO follows (followerUid, followedUid, createdAt) VALUES (?,?,?)', [
      authReq.uid!,
      followedUid,
      Date.now(),
    ]);
  }
  await markOnboardingCompleted(authReq.uid!);
  res.json({ success: true, followed: validFollows.length, subscribed: validCommunities.length });
});

export default router;
