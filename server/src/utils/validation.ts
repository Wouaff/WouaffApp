/* Pseudos qui entreraient en collision avec une route du front ou de l'API. */
export const RESERVED_PSEUDOS = new Set([
  'api',
  'auth',
  'explore',
  'notifications',
  'settings',
  'post',
  'tag',
  'search',
  'uploads',
  'assets',
  'me',
  'admin',
  'administrator',
  'support',
  'wouaff',
  'login',
  'logout',
  'register',
  'reset-password',
  'verify-email',
  'forgot-password',
  'home',
  'legal',
  'followers',
  'following',
  'root',
  'null',
  'undefined',
]);

export const PSEUDO_RE = /^[a-zA-Z0-9_]{3,30}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Une URL de média n'est acceptée que si elle pointe vers un fichier uploadé chez nous. */
export function isSafeUploadPath(value: unknown): value is string {
  return typeof value === 'string' && /^\/uploads\/[A-Za-z0-9._-]+$/.test(value) && !value.includes('..');
}

/* Seules les URL http(s) sont autorisées (bloque javascript:, data:, etc.). */
export function normalizeWebsite(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 255) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/* Échappe % _ et ! pour un LIKE ... ESCAPE '!'. */
export function escapeLike(value: string): string {
  return value.replace(/[!%_]/g, (c) => `!${c}`);
}

export function toInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}
