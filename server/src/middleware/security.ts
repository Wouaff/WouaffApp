import type { NextFunction, Request, Response } from 'express';

/* En-têtes de sécurité de base (sans dépendance). La CSP n'est posée qu'en production :
   en dev, Vite injecte des scripts inline pour le HMR. */
export function securityHeaders(isProd: boolean) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.removeHeader('X-Powered-By');
    if (isProd) {
      if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
      res.setHeader(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          /* 'wasm-unsafe-eval' et blob: : le captcha Cap calcule sa preuve de travail dans un Worker WebAssembly. */
          "script-src 'self' 'wasm-unsafe-eval'",
          "worker-src 'self' blob:",
          "style-src 'self' 'unsafe-inline'",
          /* Pas de https: ici : aucune image/vidéo externe (pixel espion, traçage) ne doit se charger. */
          "img-src 'self' data: blob:",
          "media-src 'self' blob:",
          "connect-src 'self'",
          "frame-src 'none'",
          "object-src 'none'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
        ].join('; '),
      );
    }
    next();
  };
}
