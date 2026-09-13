const DATA_URL_RE = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)((?:;[a-z0-9-]+=[^;,]*)*);base64,/i;
const BLOCKED_MIME_RE = /^(text\/html|application\/(x-)?(java|ecma)script|application\/xhtml\+xml|image\/svg\+xml)$/i;
const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;
const MAX_SOCIAL_LINKS = 10;
const MAX_SOCIAL_URL_LENGTH = 2048;

export function isSafeMediaSource(value: unknown, maxLength = 9 * 1024 * 1024): boolean {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > maxLength) return false;
  if (value.startsWith('blob:')) return true;
  if (HTTP_URL_RE.test(value)) return true;
  const match = DATA_URL_RE.exec(value);
  if (!match) return false;
  return !BLOCKED_MIME_RE.test(match[1] as string);
}

export function sanitizeSocialLinks(raw: unknown): { ok: boolean; value: string | null } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return { ok: true, value: null };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, value: null };
    }
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_SOCIAL_LINKS) return { ok: false, value: null };
  const out: Array<{ platform: string; url: string }> = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') return { ok: false, value: null };
    const platform = String((item as { platform?: unknown }).platform ?? '')
      .trim()
      .slice(0, 40);
    const url = String((item as { url?: unknown }).url ?? '').trim();
    if (!url) continue;
    if (!/^https?:\/\//i.test(url) || url.length > MAX_SOCIAL_URL_LENGTH) return { ok: false, value: null };
    out.push({ platform, url });
  }
  return { ok: true, value: JSON.stringify(out) };
}
