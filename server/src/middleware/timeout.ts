import type { NextFunction, Request, Response } from 'express';

/* Request timeout middleware, returns 503 if a request takes too long */
export function requestTimeout(ms: number) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({ error: 'Requête trop longue' });
      }
    }, ms);
    res.on('finish', () => clearTimeout(timer));
    next();
  };
}
