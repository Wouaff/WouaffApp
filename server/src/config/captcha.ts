/* Captcha Cap (https://capjs.js.org), auto-hébergé : voir `cap/docker-compose.yml`.
   Actif uniquement si CAP_URL, CAP_SITE_KEY et CAP_SECRET sont tous définis. Le navigateur ne parle jamais
   directement à Cap : le serveur relaie le défi (routes/captcha.ts) et vérifie le jeton ici. */
interface CapConfig {
  url: string;
  siteKey: string;
  secret: string;
}

export function capConfig(): CapConfig | null {
  const url = (process.env.CAP_URL || '').trim().replace(/\/+$/, '');
  const siteKey = (process.env.CAP_SITE_KEY || '').trim();
  const secret = (process.env.CAP_SECRET || '').trim();
  if (!url || !siteKey || !secret) return null;
  return { url, siteKey, secret };
}

export function isCaptchaEnabled(): boolean {
  return capConfig() !== null;
}

/* Appel au serveur Cap avec délai maximal ; renvoie la réponse JSON ou null si Cap est injoignable. */
export async function capRequest(
  path: string,
  body: unknown,
): Promise<{ status: number; data: Record<string, unknown> } | null> {
  const cfg = capConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/${encodeURIComponent(cfg.siteKey)}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, data };
  } catch {
    return null;
  }
}

/* Un jeton Cap n'est valable qu'une fois : la vérification le consomme. */
export async function verifyCapToken(token: string): Promise<boolean> {
  const cfg = capConfig();
  if (!cfg) return true;
  const r = await capRequest('siteverify', { secret: cfg.secret, response: token });
  return r !== null && r.status === 200 && r.data.success === true;
}
