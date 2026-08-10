import type { Request, Response } from 'express';
import { Router } from 'express';
import { query } from '../config/database.js';

const WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

const TECH_KEYWORDS = [
  'tech',
  'dev',
  'ia',
  'ai',
  'data',
  'code',
  'saas',
  'startup',
  'web',
  'num',
  'cyber',
  'securite',
  'app',
];

function formatCount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`;
  }
  return n.toLocaleString('fr-FR');
}

function categoryFor(tag: string): string {
  const normalized = tag.toLowerCase();
  const isTech = TECH_KEYWORDS.some((k) => normalized.includes(k));
  return isTech ? 'Technologie · Tendances en France' : 'Tendances en France';
}

const router: Router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(_req.query.limit as string, 10) || DEFAULT_LIMIT));
    const now = Date.now();
    const since = now - WINDOW_MS;
    const rows = await query<Array<{ tag: string; uses: number; score: number; lastUsed: number }>>(
      `SELECT tag,
              COUNT(*) AS uses,
              SUM(1.0 / (1.0 + (? - createdAt) / 3600000.0)) AS score,
              MAX(createdAt) AS lastUsed
       FROM hashtag_occurrences
       WHERE createdAt > ?
       GROUP BY tag
       ORDER BY score DESC, lastUsed DESC
       LIMIT ?`,
      [now, since, limit],
    );
    res.json(
      rows.map((r) => ({
        tag: r.tag,
        category: categoryFor(r.tag),
        posts: formatCount(r.uses),
        uses: r.uses,
      })),
    );
  } catch (err) {
    res.status(500).json({ error: (err as { message?: string }).message });
  }
});

export default router;
