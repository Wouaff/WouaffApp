import type { NextFunction, Request, Response } from 'express';
import { getOne } from '../config/database.js';
import { hashSessionId } from '../utils/crypto.js';

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
  /* Hash de l'identifiant de session (celui stocké en base), pas la valeur brute du cookie. */
  sessionId: string;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawSession = (req.cookies as Record<string, string> | undefined)?.session_id;
    if (typeof rawSession !== 'string' || !rawSession) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }
    const sessionId = hashSessionId(rawSession);
    /* Une seule requête pour la session et l'utilisateur (avant : deux allers-retours par appel d'API). */
    const row = await getOne<AuthUser & { expires_at: number }>(
      `SELECT s.expires_at, u.uid, u.pseudo, u.email, u.displayName, u.avatar, u.banner, u.bio,
              u.location, u.website, u.verified, u.emailVerified, u.totp_enabled, u.createdAt
       FROM sessions s JOIN users u ON u.uid = s.uid
       WHERE s.id = ?`,
      [sessionId],
    );
    if (!row) {
      res.clearCookie('session_id');
      res.status(401).json({ error: 'Session invalide' });
      return;
    }
    if (row.expires_at < Date.now()) {
      res.clearCookie('session_id');
      res.status(401).json({ error: 'Session expirée' });
      return;
    }
    const { expires_at: _expiresAt, ...user } = row;
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
