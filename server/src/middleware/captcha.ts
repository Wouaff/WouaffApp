import type { NextFunction, Request, Response } from 'express';
import { isCaptchaEnabled, verifyCapToken } from '../config/captcha.js';

/* Exige un jeton Cap valide dans `captchaToken` (corps JSON). Sans configuration Cap, ne fait rien. */
export function verifyCaptcha(req: Request, res: Response, next: NextFunction): void {
  if (!isCaptchaEnabled()) {
    next();
    return;
  }
  const body = (req.body || {}) as Record<string, unknown>;
  const token = typeof body.captchaToken === 'string' ? body.captchaToken.trim() : '';
  if (!token || token.length > 512) {
    res.status(400).json({ error: 'CAPTCHA requis' });
    return;
  }
  verifyCapToken(token)
    .then((ok) => {
      if (!ok) {
        res.status(400).json({ error: 'Vérification CAPTCHA échouée, réessaie' });
        return;
      }
      next();
    })
    .catch(next);
}
