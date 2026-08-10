import type { Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import type { Server } from 'socket.io';
import { getOne, query } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';
import { uploadToQuickUploads } from '../services/quickUploads.js';
import { getProfile } from '../services/rtdb.js';
import type { AuthRequest, VideoComment, VideoData } from '../types/index.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const router: Router = Router();
router.use(verifyToken);

router.post('/', upload.fields([{ name: 'video', maxCount: 1 }]), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const videoFile = (req.files as unknown as { video?: Express.Multer.File[] })?.video?.[0];
  if (!videoFile) {
    res.status(400).json({ error: 'Vidéo requise' });
    return;
  }
  const { caption, lat, lng, locationName } = req.body as Record<string, string>;
  try {
    const ext = videoFile.originalname.split('.').pop() || 'mp4';
    const videoUrl = await uploadToQuickUploads(videoFile.buffer, `video.${ext}`, videoFile.mimetype);
    const id = videoUrl.split('?v=').pop() || videoUrl.split('/').pop() || Date.now().toString();
    const location =
      lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng), name: locationName || undefined } : null;
    const now = Date.now();
    await query(
      `INSERT INTO videos (id, uid, videoPath, caption, duration, location, likesCount, commentsCount, createdAt)
       VALUES (?,?,?,?,?,?,0,0,?)`,
      [id, authReq.uid!, videoUrl, caption || null, 0, location ? JSON.stringify(location) : null, now],
    );
    const io: Server = req.app.get('io');
    if (io) {
      io.emit('video:new', { id, uid: authReq.uid!, videoPath: videoUrl, caption, location, createdAt: now });
    }
    res.json({ id, videoPath: videoUrl, caption, location, createdAt: now });
  } catch (err) {
    res.status(400).json({ error: (err as { message?: string }).message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
  const offset = (page - 1) * limit;
  const rows = await query<Array<VideoData & { uid: string }>>(
    'SELECT v.*, p.pseudo, p.avatar FROM videos v LEFT JOIN users p ON p.uid = v.uid ORDER BY v.createdAt DESC LIMIT ? OFFSET ?',
    [limit, offset],
  );
  const videoIds = rows.map((r) => r.id);
  const likesMap: Record<string, boolean> = {};
  if (authReq.uid && videoIds.length > 0) {
    const likeRows = await query<Array<{ videoId: string }>>(
      `SELECT videoId FROM video_likes WHERE uid = ? AND videoId IN (${videoIds.map(() => '?').join(',')})`,
      [authReq.uid, ...videoIds],
    );
    for (const lr of likeRows) likesMap[lr.videoId] = true;
  }
  const enriched: Array<VideoData & { pseudo?: string; avatar?: string; liked?: boolean }> = [];
  for (const row of rows) {
    let location = row.location;
    if (typeof location === 'string') {
      try {
        location = JSON.parse(location);
      } catch {
        location = null;
      }
    }
    enriched.push({
      ...row,
      location: location as unknown as VideoData['location'],
      pseudo: ((row as unknown as Record<string, unknown>).pseudo as string) || 'Inconnu',
      avatar: (row as unknown as Record<string, unknown>).avatar as string,
      liked: !!likesMap[row.id],
    });
  }
  res.json(enriched);
});

router.get('/:id', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getOne<VideoData & { uid: string }>('SELECT * FROM videos WHERE id=?', [req.params.id]);
  if (!row) {
    res.status(404).json({ error: 'Vidéo introuvable' });
    return;
  }
  const profile = await getProfile(row.uid);
  let liked = false;
  if (authReq.uid) {
    const likeRow = await getOne<{ uid: string }>('SELECT uid FROM video_likes WHERE uid=? AND videoId=?', [
      authReq.uid,
      row.id,
    ]);
    liked = !!likeRow;
  }
  let location = row.location;
  if (typeof location === 'string') {
    try {
      location = JSON.parse(location);
    } catch {
      location = null;
    }
  }
  res.json({
    ...row,
    location: location as unknown as VideoData['location'],
    pseudo: (profile?.pseudo as string) || 'Inconnu',
    avatar: profile?.avatar as string,
    liked,
  });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const row = await getOne<{ uid: string }>('SELECT uid FROM videos WHERE id=?', [req.params.id]);
  if (!row) {
    res.status(404).json({ error: 'Vidéo introuvable' });
    return;
  }
  if (row.uid !== authReq.uid) {
    res.status(403).json({ error: 'Interdit' });
    return;
  }
  await query('DELETE FROM videos WHERE id=?', [req.params.id]);
  await query('DELETE FROM video_likes WHERE videoId=?', [req.params.id]);
  await query('DELETE FROM video_comments WHERE videoId=?', [req.params.id]);
  res.json({ success: true });
});

router.post('/:id/like', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const existing = await getOne<{ uid: string }>('SELECT uid FROM video_likes WHERE uid=? AND videoId=?', [
    authReq.uid!,
    req.params.id,
  ]);
  if (existing) {
    await query('DELETE FROM video_likes WHERE uid=? AND videoId=?', [authReq.uid!, req.params.id]);
    await query('UPDATE videos SET likesCount = GREATEST(0, likesCount - 1) WHERE id=?', [req.params.id]);
    const io: Server = req.app.get('io');
    if (io) io.emit('video:liked', { videoId: req.params.id, uid: authReq.uid!, liked: false });
    res.json({ liked: false });
  } else {
    await query('INSERT INTO video_likes (uid, videoId, createdAt) VALUES (?,?,?)', [
      authReq.uid!,
      req.params.id,
      Date.now(),
    ]);
    await query('UPDATE videos SET likesCount = likesCount + 1 WHERE id=?', [req.params.id]);
    const io: Server = req.app.get('io');
    if (io) io.emit('video:liked', { videoId: req.params.id, uid: authReq.uid!, liked: true });
    res.json({ liked: true });
  }
});

router.get('/:id/liked', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const existing = await getOne<{ uid: string }>('SELECT uid FROM video_likes WHERE uid=? AND videoId=?', [
    authReq.uid!,
    req.params.id,
  ]);
  res.json({ liked: !!existing });
});

router.post('/:id/comments', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { text } = req.body as { text: string };
  if (!text?.trim()) {
    res.status(400).json({ error: 'Texte requis' });
    return;
  }
  const video = await getOne<{ id: string }>('SELECT id FROM videos WHERE id=?', [req.params.id]);
  if (!video) {
    res.status(404).json({ error: 'Vidéo introuvable' });
    return;
  }
  const now = Date.now();
  const result = await query<{ insertId: number }>(
    'INSERT INTO video_comments (videoId, uid, text, createdAt) VALUES (?,?,?,?)',
    [req.params.id, authReq.uid!, text.trim(), now],
  );
  await query('UPDATE videos SET commentsCount = commentsCount + 1 WHERE id=?', [req.params.id]);
  const profile = await getProfile(authReq.uid!);
  const comment: VideoComment = {
    id: (result as unknown as { insertId?: number }).insertId || 0,
    videoId: req.params.id,
    uid: authReq.uid!,
    text: text.trim(),
    createdAt: now,
    pseudo: (profile?.pseudo as string) || 'Inconnu',
    avatar: profile?.avatar as string,
  };
  const io: Server = req.app.get('io');
  if (io) io.emit('video:comment', { videoId: req.params.id, comment });
  res.json(comment);
});

router.get('/:id/comments', async (req: Request, res: Response) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
  const rows = await query<Array<VideoComment & { uid: string }>>(
    'SELECT c.*, p.pseudo, p.avatar FROM video_comments c LEFT JOIN users p ON p.uid = c.uid WHERE c.videoId = ? ORDER BY c.createdAt ASC LIMIT ? OFFSET ?',
    [req.params.id, limit, offset],
  );
  const enriched: VideoComment[] = [];
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
  const comment = await getOne<{ uid: string; videoId: string }>('SELECT uid, videoId FROM video_comments WHERE id=?', [
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
  await query('DELETE FROM video_comments WHERE id=?', [req.params.commentId]);
  await query('UPDATE videos SET commentsCount = GREATEST(0, commentsCount - 1) WHERE id=?', [comment.videoId]);
  res.json({ success: true });
});

export default router;
