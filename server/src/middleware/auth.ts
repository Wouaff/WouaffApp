import type { NextFunction, Request, Response } from 'express';
import { getOne } from '../config/database.js';

export interface AuthUser {
  uid: string;
  pseudo: string;
  email: string;
  displayName: string | null;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  verified: number;
  emailVerified: number;
  totp_enabled: number;
  createdAt: number;
}

export interface AuthRequest extends Request {
  user: AuthUser;
  sessionId: string;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = (req.cookies as Record<string, string> | undefined)?.session_id;
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
    const user = await getOne<AuthUser>(
      `SELECT uid, pseudo, email, displayName, avatar, banner, bio, location, website, verified,
              emailVerified, totp_enabled, createdAt
       FROM users WHERE uid = ?`,
      [session.uid],
    );
    if (!user) {
      res.clearCookie('session_id');
      res.status(401).json({ error: 'Utilisateur introuvable' });
      return;
    }
    (req as AuthRequest).user = user;
    (req as AuthRequest).sessionId = sessionId;
    next();
  } catch (err) {
    next(err);
  }
}

/* Pour les routes déjà authentifiées : évite les `(req as any).user` partout. */
export function currentUser(req: Request): AuthUser {
  return (req as AuthRequest).user;
}
