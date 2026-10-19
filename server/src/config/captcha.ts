/* Cloudflare Turnstile — actif uniquement si TURNSTILE_SECRET_KEY est défini. */
export function isCaptchaEnabled(): boolean {
  return (process.env.TURNSTILE_SECRET_KEY || '').trim().length > 0;
}

export async function verifyTurnstileToken(token: string, ip?: string): Promise<boolean> {
  const secret = (process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) return true;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean; hostname?: string };
    if (data.success !== true) return false;
    const expectedHost = (process.env.TURNSTILE_HOSTNAME || '').trim();
    return !expectedHost || data.hostname === expectedHost;
  } catch {
    return false;
  }
}
