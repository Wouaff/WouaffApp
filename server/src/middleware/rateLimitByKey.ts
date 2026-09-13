import type { NextFunction, Request, Response } from 'express';

interface Entry {
  count: number;
  resetAt: number;
}

const MAX_ENTRIES = 20000;

/* Rate limiter par clé arbitraire (email, IP, etc.), un store par limiteur */
export function rateLimitByKey(opts: {
  windowMs: number;
  max: number;
  keyFn: (req: Request) => string;
  message?: string;
}) {
  const { windowMs, max, keyFn, message } = opts;
  const store = new Map<string, Entry>();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 60000).unref();

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
    }
    entry.count++;
    if (store.size >= MAX_ENTRIES && !store.has(key)) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    store.set(key, entry);
    if (entry.count > max) {
      res.status(429).json({ error: message || 'Trop de requêtes, réessayez plus tard' });
      return;
    }
    next();
  };
}
