import { parseCookie } from 'cookie';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { isCaptchaEnabled } from '../config/captcha.js';
import { getOne } from '../config/database.js';
import { NEW_ACCOUNT_MS } from '../middleware/captcha.js';

const router: Router = Router();

async function getOptionalUid(req: Request): Promise<string | null> {
  let sessionId = (req.cookies as { session_id?: string } | undefined)?.session_id as string | undefined;
  if (!sessionId && req.headers.cookie) {
    try {
      sessionId = parseCookie(req.headers.cookie).session_id;
    } catch {
      sessionId = undefined;
    }
  }
  if (!sessionId) return null;
  const session = await getOne<{ uid: string }>('SELECT uid FROM sessions WHERE sessionId = ?', [sessionId]);
  return session?.uid || null;
}

/* GET /captcha/required?scope=register|forgot|post|comment — le CAPTCHA est-il requis ? */
router.get('/required', async (req: Request, res: Response) => {
  const scope = (req.query.scope as string) || '';
  if (!isCaptchaEnabled()) {
    res.json({ required: false });
    return;
  }
  if (scope === 'register' || scope === 'forgot') {
    res.json({ required: true });
    return;
  }
  if (scope === 'post' || scope === 'comment') {
    const uid = await getOptionalUid(req);
    if (uid) {
      const row = await getOne<{ createdAt: number }>('SELECT createdAt FROM users WHERE uid = ?', [uid]);
      if (row && Date.now() - (row.createdAt || 0) <= NEW_ACCOUNT_MS) {
        res.json({ required: true });
        return;
      }
    }
    res.json({ required: false });
    return;
  }
  res.json({ required: false });
});

export default router;
