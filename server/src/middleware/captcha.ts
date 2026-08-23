import type { NextFunction, Request, Response } from 'express';
import { isCaptchaEnabled, verifyTurnstileToken } from '../config/captcha.js';
import { getOne } from '../config/database.js';
import type { AuthRequest } from '../types/index.js';

export const NEW_ACCOUNT_MS = 7 * 24 * 60 * 60 * 1000;

function extractToken(req: Request): string {
  const body = (req.body || {}) as Record<string, unknown>;
  const raw =
    typeof body.capToken === 'string'
      ? body.capToken
      : typeof body.cap_token === 'string'
        ? body.cap_token
        : typeof body.turnstileToken === 'string'
          ? body.turnstileToken
          : '';
  return raw.trim();
}

function getClientIp(req: Request): string {
  return (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
}

async function checkCaptcha(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!isCaptchaEnabled()) return next();
  const token = extractToken(req);
  if (!token) {
    res.status(400).json({ error: 'CAPTCHA requis' });
    return;
  }
  const ok = await verifyTurnstileToken(token, getClientIp(req));
  if (!ok) {
    res.status(400).json({ error: 'Vérification CAPTCHA échouée' });
    return;
  }
  next();
}

export function verifyCaptcha(req: Request, res: Response, next: NextFunction): void {
  void checkCaptcha(req, res, next).catch(() => {
    res.status(503).json({ error: 'Service de vérification indisponible' });
  });
}

/* Captcha obligatoire pour l'inscription — rejette même si le provider n'est pas configuré */
export function verifyCaptchaStrict(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      if (!isCaptchaEnabled()) {
        res.status(400).json({ error: 'Service de vérification indisponible' });
        return;
      }
      const token = extractToken(req);
      if (!token) {
        res.status(400).json({ error: 'CAPTCHA requis' });
        return;
      }
      const ok = await verifyTurnstileToken(token, getClientIp(req));
      if (!ok) {
        res.status(400).json({ error: 'Vérification CAPTCHA échouée' });
        return;
      }
      next();
    } catch {
      res.status(503).json({ error: 'Service de vérification indisponible' });
    }
  })();
}

export function verifyCaptchaIfNewAccount(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      if (!isCaptchaEnabled()) return next();
      const authReq = req as AuthRequest;
      if (authReq.uid) {
        const row = await getOne<{ createdAt: number }>('SELECT createdAt FROM users WHERE uid = ?', [authReq.uid]);
        if (row && Date.now() - (row.createdAt || 0) > NEW_ACCOUNT_MS) return next();
      }
      return await checkCaptcha(req, res, next);
    } catch {
      res.status(503).json({ error: 'Service de vérification indisponible' });
    }
  })();
}
