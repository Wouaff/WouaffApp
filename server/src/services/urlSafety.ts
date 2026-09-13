import { resolve4, resolve6 } from 'node:dns/promises';
import { isIP } from 'node:net';

export const MAX_REDIRECTS = 3;
export const MAX_RESPONSE_BYTES = 512 * 1024;

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0];
  if (normalized.startsWith('::ffff:')) {
    return isPrivateAddress(normalized.slice(7));
  }
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (isIP(normalized) === 6) {
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith('ff')
    );
  }
  return true;
}

export async function assertPublicUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL interdite');
  const hostname = url.hostname.replace(/^\[/, '').replace(/\]$/, '');
  const literal = isIP(hostname);
  const addresses = literal
    ? [hostname]
    : [...(await resolve4(hostname).catch(() => [])), ...(await resolve6(hostname).catch(() => []))];
  if (!addresses.length || addresses.some(isPrivateAddress)) throw new Error('URL interdite');
  return url;
}

export async function fetchPublic(
  value: string,
  opts: { signal?: AbortSignal; headers?: Record<string, string>; maxRedirects?: number } = {},
): Promise<{ response: globalThis.Response; url: URL }> {
  const maxRedirects = opts.maxRedirects ?? MAX_REDIRECTS;
  let url = await assertPublicUrl(value);
  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    const response = await fetch(url, {
      signal: opts.signal,
      headers: opts.headers,
      redirect: 'manual',
    });
    if (response.status < 300 || response.status >= 400) return { response, url };
    const location = response.headers.get('location');
    if (!location || redirects === maxRedirects) throw new Error('Redirection interdite');
    url = await assertPublicUrl(new URL(location, url).toString());
  }
  throw new Error('Redirection interdite');
}

export async function readLimitedBody(response: globalThis.Response, maxBytes = MAX_RESPONSE_BYTES): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) throw new Error('Réponse trop grande');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let html = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error('Réponse trop grande');
    }
    html += decoder.decode(value, { stream: true });
  }
  return html + decoder.decode();
}
