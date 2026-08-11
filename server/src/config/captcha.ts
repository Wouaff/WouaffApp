export interface CaptchaConfig {
  instance: string;
  siteKey: string;
  secretKey: string;
}

export function getCaptchaConfig(): CaptchaConfig | null {
  const instance = (process.env.CAP_INSTANCE || '').trim().replace(/\/+$/, '');
  const siteKey = (process.env.CAP_SITE_KEY || '').trim();
  const secretKey = (process.env.CAP_SECRET_KEY || '').trim();
  if (!instance || !siteKey || !secretKey) return null;
  return { instance, siteKey, secretKey };
}

export function isCaptchaEnabled(): boolean {
  return getCaptchaConfig() !== null;
}

export async function verifyCapToken(token: string): Promise<boolean> {
  const cfg = getCaptchaConfig();
  if (!cfg) return true;
  const url = `${cfg.instance}/${cfg.siteKey}/siteverify`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: cfg.secretKey, response: token }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
