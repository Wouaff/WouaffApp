import type { CookieOptions, NextFunction, Request, Response } from 'express';
import { getOne, query } from '../config/database.js';
import { isMailEnabled } from '../services/mailer.js';
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
  role: string;
  status: string;
  suspended_until: number | null;
  status_reason: string | null;
}

/* Cookie de session. En production (HTTPS), le préfixe __Host- l'attache au domaine exact : un sous-domaine
   compromis ne peut ni le lire ni le remplacer. Il impose Secure + Path=/ et interdit l'attribut Domain.
   En local (http), on garde le nom simple : certains navigateurs refusent __Host- hors HTTPS. */
const COOKIE_PLAIN = 'session_id';
const COOKIE_HOST = '__Host-session_id';

function useSecureCookie(req: Request): boolean {
  return process.env.NODE_ENV === 'production' && !req.hostname.includes('localhost');
}

function cookieOptions(req: Request): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: useSecureCookie(req), path: '/' };
}

export function setSessionCookie(req: Request, res: Response, value: string, maxAgeMs: number): void {
  /* Un ancien cookie « session_id » ne doit pas survivre à la nouvelle connexion. */
  if (useSecureCookie(req)) res.clearCookie(COOKIE_PLAIN, cookieOptions(req));
  res.cookie(useSecureCookie(req) ? COOKIE_HOST : COOKIE_PLAIN, value, { ...cookieOptions(req), maxAge: maxAgeMs });
}

export function clearSessionCookies(req: Request, res: Response): void {
  res.clearCookie(COOKIE_PLAIN, cookieOptions(req));
  if (useSecureCookie(req)) res.clearCookie(COOKIE_HOST, cookieOptions(req));
}

/* Valeur brute du cookie de session (le nom préfixé prime ; l'ancien nom reste accepté pour les sessions en cours). */
export function readSessionCookie(req: Request): string | null {
  const cookies = (req.cookies as Record<string, unknown> | undefined) ?? {};
  const value = cookies[COOKIE_HOST] ?? cookies[COOKIE_PLAIN];
  return typeof value === 'string' && value ? value : null;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export interface AuthRequest extends Request {
  user: AuthUser;
  /* Hash de l'identifiant de session (celui stocké en base), pas la valeur brute du cookie. */
  sessionId: string;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawSession = readSessionCookie(req);
    if (!rawSession) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }
    const sessionId = hashSessionId(rawSession);
    /* Une seule requête pour la session et l'utilisateur (avant : deux allers-retours par appel d'API). */
    const row = await getOne<AuthUser & { expires_at: number }>(
      `SELECT s.expires_at, u.uid, u.pseudo, u.email, u.displayName, u.avatar, u.banner, u.bio,
              u.location, u.website, u.verified, u.emailVerified, u.totp_enabled, u.createdAt,
              u.role, u.status, u.suspended_until, u.status_reason
       FROM sessions s JOIN users u ON u.uid = s.uid
       WHERE s.id = ?`,
      [sessionId],
    );
    if (!row) {
      clearSessionCookies(req, res);
      res.status(401).json({ error: 'Session invalide' });
      return;
    }
    if (row.expires_at < Date.now()) {
      clearSessionCookies(req, res);
      res.status(401).json({ error: 'Session expirée' });
      return;
    }
    const { expires_at: _expiresAt, ...user } = row;
    if (user.status === 'banned') {
      clearSessionCookies(req, res);
      res.status(403).json({ error: 'Ce compte a été banni', code: 'ACCOUNT_BANNED' });
      return;
    }
    if (user.status === 'suspended') {
      const until = user.suspended_until == null ? null : Number(user.suspended_until);
      if (until !== null && until <= Date.now()) {
        /* Suspension terminée : le compte redevient actif. */
        await query(
          "UPDATE users SET status = 'active', suspended_until = NULL, status_reason = NULL WHERE uid = ? AND status = 'suspended'",
          [user.uid],
        );
        user.status = 'active';
        user.suspended_until = null;
        user.status_reason = null;
      } else if (!SAFE_METHODS.has(req.method) && !req.originalUrl.startsWith('/api/auth/')) {
        /* Suspendu : lecture seule (la déconnexion, l'export et la suppression du compte restent possibles). */
        res.status(403).json({
          error: `Ton compte est suspendu${until ? ` jusqu'au ${formatDate(until)}` : ''}${user.status_reason ? ` (${user.status_reason})` : ''}`,
          code: 'ACCOUNT_SUSPENDED',
        });
        return;
      }
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

/* Réservé aux modérateurs et administrateurs (à placer après authMiddleware). */
export function requireRole(minimum: 'moderator' | 'admin') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = currentUser(req).role;
    const ok = role === 'admin' || (minimum === 'moderator' && role === 'moderator');
    if (!ok) {
      res.status(403).json({ error: 'Accès réservé à la modération' });
      return;
    }
    next();
  };
}

/* Quand l'envoi d'e-mails est configuré, publier exige une adresse confirmée (limite les comptes jetables). */
export function requireVerifiedEmail(req: Request, res: Response, next: NextFunction): void {
  if (isMailEnabled() && !currentUser(req).emailVerified) {
    res.status(403).json({
      error: 'Confirme ton adresse e-mail pour publier : un lien t’a été envoyé à l’inscription.',
      code: 'EMAIL_NOT_VERIFIED',
    });
    return;
  }
  next();
}
