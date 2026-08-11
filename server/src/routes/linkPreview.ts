import { isIP } from 'node:net';
import { resolve4, resolve6 } from 'node:dns/promises';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';

const router: Router = Router();
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 512 * 1024;

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0];
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
      normalized.startsWith('ff') ||
      normalized.startsWith('::ffff:')
    );
  }
  return true;
}

export async function assertPublicUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL interdite');
  const literal = isIP(url.hostname);
  const addresses = literal
    ? [url.hostname]
    : [
        ...(await resolve4(url.hostname).catch(() => [])),
        ...(await resolve6(url.hostname).catch(() => [])),
      ];
  if (!addresses.length || addresses.some(isPrivateAddress)) throw new Error('URL interdite');
  return url;
}

async function fetchPage(value: string, signal: AbortSignal): Promise<{ response: globalThis.Response; url: URL }> {
  let url = await assertPublicUrl(value);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const response = await fetch(url, {
      signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WouaffBot/1.0; +https://wouaff.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'manual',
    });
    if (response.status < 300 || response.status >= 400) return { response, url };
    const location = response.headers.get('location');
    if (!location || redirects === MAX_REDIRECTS) throw new Error('Redirection interdite');
    url = await assertPublicUrl(new URL(location, url).toString());
  }
  throw new Error('Redirection interdite');
}

async function readLimitedBody(response: globalThis.Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error('Réponse trop grande');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let html = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Réponse trop grande');
    }
    html += decoder.decode(value, { stream: true });
  }
  return html + decoder.decode();
}

function parseMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property="og:${name}"[^>]+content="([^"]*)"`, 'i'),
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="og:${name}"`, 'i'),
    new RegExp(`<meta[^>]+name="twitter:${name}"[^>]+content="([^"]*)"`, 'i'),
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+name="twitter:${name}"`, 'i'),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return null;
}

router.post('/', verifyToken, async (req: Request, res: Response) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Missing url' });
      return;
    }

    const { response, url: finalUrl } = await fetchPage(url, controller.signal);

    if (!response.ok) {
      res.json({ url, error: 'fetch_failed' });
      return;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('text/html')) throw new Error('Type interdit');
    const html = await readLimitedBody(response);
    const title = parseMeta(html, 'title') || parseMeta(html, 'description') || '';
    const description = parseMeta(html, 'description') || '';
    const image = parseMeta(html, 'image') || '';
    const siteName = parseMeta(html, 'site_name') || finalUrl.hostname;

    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const fallbackTitle = titleMatch ? titleMatch[1] : '';

    res.json({
      url,
      title: title || fallbackTitle || siteName,
      description,
      image,
      siteName,
    });
  } catch {
    res.json({ url: req.body.url, error: 'fetch_failed' });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
