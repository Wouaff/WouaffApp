import type { Request, Response } from 'express';
import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { fetchPublic, readLimitedBody } from '../services/urlSafety.js';

const router: Router = Router();

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

    const { response, url: finalUrl } = await fetchPublic(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WouaffBot/1.0; +https://wouaff.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

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
