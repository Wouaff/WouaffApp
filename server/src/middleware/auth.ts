import type { NextFunction, Request, Response } from 'express';
import { getOne } from '../config/database.js';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    pseudo: string | null;
    email: string;
    displayName: string | null;
    avatar: string | null;
    banner: string | null;
    bio: string | null;
    location: string | null;
    website: string | null;
    verified: number;
    createdAt: number;
  };
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionId = (req.cookies as any)?.session_id;
  if (!sessionId) {
    res.status(401).json({ error: 'Non authentifié' });
    return;
  }
  const session = await getOne<{ uid: string; expires_at: number }>(
    'SELECT uid, expires_at FROM sessions WHERE id = ?',
    [sessionId],
  );
  if (!session) {
    res.clearCookie('session_id');
    res.status(401).json({ error: 'Session invalide' });
    return;
  }
  if (session.expires_at < Date.now()) {
    res.clearCookie('session_id');
    res.status(401).json({ error: 'Session expirée' });
    return;
  }
  const user = await getOne<any>(
    'SELECT uid, pseudo, email, displayName, avatar, banner, bio, location, website, verified, createdAt FROM users WHERE uid = ?',
    [session.uid],
  );
  if (!user) {
    res.clearCookie('session_id');
    res.status(401).json({ error: 'Utilisateur introuvable' });
    return;
  }
  (req as AuthRequest).user = user;
  next();
}
