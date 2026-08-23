export interface CaptchaConfig {
  secretKey: string;
}

export function getCaptchaConfig(): CaptchaConfig | null {
  const secretKey = (process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secretKey) return null;
  return { secretKey };
}

export function isCaptchaEnabled(): boolean {
  return getCaptchaConfig() !== null;
}

export async function verifyTurnstileToken(token: string, ip?: string): Promise<boolean> {
  const cfg = getCaptchaConfig();
  if (!cfg) return true;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: cfg.secretKey,
        response: token,
        remoteip: ip,
      }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
