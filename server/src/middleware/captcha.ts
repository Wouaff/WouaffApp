import type { NextFunction, Request, Response } from 'express';
import { isCaptchaEnabled, verifyTurnstileToken } from '../config/captcha.js';

export function verifyCaptcha(req: Request, res: Response, next: NextFunction): void {
  if (!isCaptchaEnabled()) {
    next();
    return;
  }
  const body = (req.body || {}) as Record<string, unknown>;
  const token = typeof body.captchaToken === 'string' ? body.captchaToken.trim() : '';
  if (!token) {
    res.status(400).json({ error: 'CAPTCHA requis' });
    return;
  }
  verifyTurnstileToken(token, req.ip)
    .then((ok) => {
      if (!ok) {
        res.status(400).json({ error: 'Vérification CAPTCHA échouée' });
        return;
      }
      next();
    })
    .catch(next);
}
