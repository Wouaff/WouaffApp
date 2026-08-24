import type { Request, Response } from 'express';
import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';

const router: Router = Router();
router.use(verifyToken);

const API_KEY = process.env.GIPHY_API_KEY || '';
const GIF_LIMIT = 20;

interface GiphyItem {
  id?: string;
  title?: string;
  url?: string;
  images?: {
    original?: { url?: string };
    fixed_height?: { url?: string };
  };
}

interface GifResult {
  id: string;
  url: string;
  preview: string;
  title: string;
}

function normalize(g: GiphyItem): GifResult {
  const original = g.images?.original?.url || '';
  const preview = g.images?.fixed_height?.url || original;
  return {
    id: g.id || original,
    url: original,
    preview,
    title: g.title || '',
  };
}

async function fetchGiphy(
  path: string,
  params: Record<string, string>,
): Promise<{ results: GifResult[]; error?: string }> {
  if (!API_KEY) {
    return { results: [], error: 'GIPHY_API_KEY non configurée sur le serveur' };
  }
  try {
    const url = new URL(`https://api.giphy.com/v1/${path}`);
    url.searchParams.set('api_key', API_KEY);
    url.searchParams.set('limit', String(GIF_LIMIT));
    url.searchParams.set('rating', 'g');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url.toString());
    if (!res.ok) {
      return { results: [], error: `Giphy a répondu avec le statut ${res.status}` };
    }
    const data = (await res.json()) as { data?: GiphyItem[] };
    return { results: (data.data || []).map(normalize) };
  } catch (err) {
    return { results: [], error: (err as { message?: string }).message || 'Erreur Giphy' };
  }
}

/* GET /gifs/trending, GIFs tendance */
router.get('/trending', async (_req: Request, res: Response) => {
  const result = await fetchGiphy('gifs/trending', {});
  res.json(result);
});

/* GET /gifs/search?q=, recherche de GIFs */
router.get('/search', async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim().slice(0, 80);
  if (!q) {
    res.json({ results: [] });
    return;
  }
  const result = await fetchGiphy('gifs/search', { q });
  res.json(result);
});

export default router;
