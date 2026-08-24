import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Server } from 'socket.io';
import { verifyToken } from '../middleware/auth.js';
import {
  cleanupExpiredStories,
  createStory,
  deleteStory,
  getContactUids,
  getStories,
  markStoryViewed,
} from '../services/rtdb.js';
import type { AuthRequest } from '../types/index.js';

const router: Router = Router();
router.use(verifyToken);

/* GET /stories, stories des contacts */
router.get('/', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const contactUids = await getContactUids(authReq.uid!);
  const result: Record<string, unknown> = {};
  const now = Date.now();
  const storyResults = await Promise.all(
    contactUids.map(async (uid) => {
      if (uid === authReq.uid) return null;
      const stories = await getStories(uid);
      const active: Record<string, unknown> = {};
      for (const sid in stories) {
        const s = stories[sid] as Record<string, unknown>;
        if ((s.expiresAt as number) > now) active[sid] = s;
      }
      return Object.keys(active).length ? { uid, stories: active } : null;
    }),
  );
  for (const entry of storyResults) {
    if (entry) result[entry.uid] = entry.stories;
  }
  res.json(result);
});

/* GET /stories/mine, mes stories */
router.get('/mine', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const stories = await getStories(authReq.uid!);
  const now = Date.now();
  const active: Record<string, unknown> = {};
  for (const sid in stories) {
    const s = stories[sid] as Record<string, unknown>;
    if ((s.expiresAt as number) > now) active[sid] = s;
  }
  res.json(active);
});

/* POST /stories, publier une story */
router.post('/', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { media, type, audioData, audioName, audioStartTime, audioExtractDuration, description } = req.body as {
    media: string;
    type: string;
    audioData?: string;
    audioName?: string;
    audioStartTime?: number;
    audioExtractDuration?: number;
    description?: string;
  };
  if (!media) {
    res.status(400).json({ error: 'Media requis' });
    return;
  }
  const now = Date.now();
  const storyData: Record<string, unknown> = {
    media,
    type: type || 'image',
    timestamp: now,
    expiresAt: now + 12 * 60 * 60 * 1000,
    viewedBy: {},
  };
  if (audioData) storyData.audioData = audioData;
  if (audioName) storyData.audioName = audioName;
  if (typeof audioStartTime === 'number') storyData.audioStartTime = audioStartTime;
  if (typeof audioExtractDuration === 'number') storyData.audioExtractDuration = audioExtractDuration;
  if (description) storyData.description = description;
  const storyId = await createStory(authReq.uid!, storyData);
  await cleanupExpiredStories(authReq.uid!);
  const io: Server = req.app.get('io');
  if (io) {
    const contactUids = await getContactUids(authReq.uid!);
    for (const cu of contactUids) {
      if (cu !== authReq.uid)
        io.to(`user:${cu}`).emit('story:added', {
          uid: authReq.uid!,
          storyId,
          media,
          type: type || 'image',
          timestamp: now,
        });
    }
  }
  res.json({ storyId, ...storyData });
});

/* POST /stories/:storyId/view, marquer comme vu */
router.post('/:storyId/view', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { uid } = req.body as { uid: string };
  if (!uid) {
    res.status(400).json({ error: 'UID du propriétaire requis' });
    return;
  }
  await markStoryViewed(uid, req.params.storyId, authReq.uid!);
  const io: Server = req.app.get('io');
  if (io) {
    io.to(`user:${uid}`).emit('story:viewed', { storyId: req.params.storyId, viewedBy: authReq.uid! });
  }
  res.json({ success: true });
});

/* DELETE /stories/:storyId, supprimer une story */
router.delete('/:storyId', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  await deleteStory(authReq.uid!, req.params.storyId);
  const io: Server = req.app.get('io');
  if (io) {
    const contactUids = await getContactUids(authReq.uid!);
    for (const cu of contactUids) {
      if (cu !== authReq.uid)
        io.to(`user:${cu}`).emit('story:removed', { uid: authReq.uid!, storyId: req.params.storyId });
    }
  }
  res.json({ success: true });
});

export default router;
