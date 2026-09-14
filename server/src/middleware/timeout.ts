import type { NextFunction, Request, Response } from 'express';

/* Request timeout middleware, returns 503 if a request takes too long */
export function requestTimeout(ms: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const controller = new AbortController();
    (req as Request & { signal?: AbortSignal }).signal = controller.signal;

    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      controller.abort();
      if (res.headersSent) {
        res.end();
        return;
      }
      res.status(503).json({ error: 'Requête trop longue' });
    }, ms);

    res.on('finish', cleanup);
    res.on('close', () => {
      controller.abort();
      cleanup();
    });

    next();
  };
}
