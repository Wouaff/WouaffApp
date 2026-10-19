import { Router } from 'express';
import { capRequest, isCaptchaEnabled } from '../config/captcha.js';
import { patchRouter } from '../middleware/asyncHandler.js';
import { rateLimit } from '../middleware/rateLimit.js';

/* Relais vers le serveur Cap : l'interface appelle /api/captcha/challenge puis /api/captcha/redeem. */
const router = patchRouter(Router());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 120, message: 'Trop de tentatives, réessaie plus tard' });

router.get('/config', (_req, res) => {
  res.json({ enabled: isCaptchaEnabled() });
});

for (const step of ['challenge', 'redeem'] as const) {
  router.post(`/${step}`, limiter, async (req, res) => {
    if (!isCaptchaEnabled()) return res.status(404).json({ error: 'Captcha désactivé' });
    const r = await capRequest(step, req.body);
    if (!r) return res.status(503).json({ error: 'Captcha momentanément indisponible' });
    res.status(r.status).json(r.data);
  });
}

export default router;
