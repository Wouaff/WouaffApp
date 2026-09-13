export interface CaptchaConfig {
  secretKey: string;
  expectedHostname: string;
  expectedAction: string;
}

export function getCaptchaConfig(): CaptchaConfig | null {
  const secretKey = (process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secretKey) return null;
  return {
    secretKey,
    expectedHostname: (process.env.TURNSTILE_HOSTNAME || '').trim(),
    expectedAction: (process.env.TURNSTILE_ACTION || '').trim(),
  };
}

export function isCaptchaEnabled(): boolean {
  return getCaptchaConfig() !== null;
}

export function isCaptchaDisabledByEnv(): boolean {
  const value = (process.env.CAPTCHA_DISABLED || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export function isCaptchaRequired(): boolean {
  if (isCaptchaEnabled()) return true;
  if (isCaptchaDisabledByEnv()) return false;
  return process.env.NODE_ENV === 'production';
}

export async function verifyTurnstileToken(token: string, ip?: string): Promise<boolean> {
  const cfg = getCaptchaConfig();
  if (!cfg) return !isCaptchaRequired();
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
    const data = (await res.json()) as { success?: boolean; hostname?: string; action?: string };
    if (data.success !== true) return false;
    if (cfg.expectedHostname && data.hostname !== cfg.expectedHostname) return false;
    if (cfg.expectedAction && data.action !== cfg.expectedAction) return false;
    return true;
  } catch {
    return false;
  }
}
