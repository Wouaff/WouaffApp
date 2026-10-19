import type { NextFunction, Request, RequestHandler, Response } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  /* Clé de regroupement ; par défaut l'IP. */
  key?: (req: Request) => string;
}

/* Limiteur en mémoire (un seul process). Derrière un proxy, définir TRUST_PROXY. */
export function rateLimit({ windowMs, max, message, key }: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }, windowMs);
  timer.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const id = key ? key(req) : req.ip || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(id);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(id, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: message || 'Trop de requêtes, réessaie dans un instant' });
      return;
    }
    next();
  };
}
