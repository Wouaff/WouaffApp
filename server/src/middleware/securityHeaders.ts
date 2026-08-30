import type { NextFunction, Request, Response } from 'express';

const isProd = process.env.NODE_ENV === 'production';

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://wouaff.statuspage.io https://8d9r257f8g5b.statuspage.io https://images.dmca.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://wouaff.statuspage.io https://8d9r257f8g5b.statuspage.io https://images.dmca.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(self), camera=(self)');
  res.setHeader('Content-Security-Policy', CSP);
  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

/* Redirige HTTP vers HTTPS uniquement en production (jamais en développement local). */
export function redirectHttps(req: Request, res: Response, next: NextFunction): void {
  if (!isProd || req.secure) {
    next();
    return;
  }

  const host = req.headers.host || '';
  const hostname = host.split(':')[0].toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    next();
    return;
  }

  res.redirect(301, `https://${host}${req.originalUrl}`);
}
