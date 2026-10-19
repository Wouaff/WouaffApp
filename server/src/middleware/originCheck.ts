import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/* Défense en profondeur contre le CSRF (en plus de SameSite=Lax) : une requête qui modifie des données
   et qui porte un en-tête Origin doit venir de notre propre site. Sans Origin (clients non navigateur),
   la requête passe : le cookie de session reste de toute façon nécessaire. */
export function originCheck(allowedOrigin: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.get('origin');
    let allowed = SAFE_METHODS.has(req.method) || !origin || origin === allowedOrigin;
    if (!allowed && origin) {
      try {
        allowed = new URL(origin).host === req.get('host');
      } catch {
        allowed = false; // Origin illisible
      }
    }
    if (allowed) next();
    else res.status(403).json({ error: 'Origine non autorisée' });
  };
}
