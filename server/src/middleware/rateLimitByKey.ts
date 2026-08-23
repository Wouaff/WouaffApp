import type { NextFunction, Request, Response } from 'express';

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

/* Rate limiter par clé arbitraire (email, IP, etc.) */
export function rateLimitByKey(opts: {
  windowMs: number;
  max: number;
  keyFn: (req: Request) => string;
  message?: string;
}) {
  const { windowMs, max, keyFn, message } = opts;
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyFn(req);
    if (!key) {
      next();
      return;
    }
    const now = Date.now();
    let entry = store.get(key);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.status(429).json({ error: message || 'Trop de requêtes, réessayez plus tard' });
      return;
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 60000);
