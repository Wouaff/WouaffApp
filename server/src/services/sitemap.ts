import { query } from '../config/database.js';
import { SITE_URL } from './seo.js';

interface UrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const POSTS_LIMIT = 40000;
const COMMUNITY_POSTS_LIMIT = 4000;
const PROFILES_LIMIT = 5000;
const COMMUNITIES_LIMIT = 500;
const HASHTAGS_LIMIT = 500;

let cache: { xml: string; expiresAt: number } | null = null;

function isoDate(ms: number | null | undefined): string | undefined {
  if (!ms || ms <= 0) return undefined;
  return new Date(ms).toISOString().slice(0, 10);
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toXml(entries: UrlEntry[]): string {
  const urls = entries
    .map((u) => {
      const meta = [
        u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : '',
        u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : '',
        u.priority ? `<priority>${u.priority}</priority>` : '',
      ]
        .filter(Boolean)
        .join('');
      return `  <url>\n    <loc>${esc(u.loc)}</loc>${meta ? `\n${meta.replace(/\n/g, '\n    ')}` : ''}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

async function loadEntries(): Promise<UrlEntry[]> {
  const entries: UrlEntry[] = [
    { loc: `${SITE_URL}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE_URL}/download`, changefreq: 'monthly', priority: '0.5' },
  ];

  const [posts, communityPosts, profiles, communities, hashtags] = await Promise.all([
    query<Array<{ id: string; createdAt: number }>>('SELECT id, createdAt FROM posts ORDER BY createdAt DESC LIMIT ?', [
      POSTS_LIMIT,
    ]),
    query<Array<{ id: string; name: string; createdAt: number }>>(
      `SELECT cp.id, c.name, cp.createdAt
       FROM community_posts cp
       JOIN communities c ON c.id = cp.communityId
       WHERE cp.deletedAt IS NULL AND c.isPrivate = 0
       ORDER BY cp.createdAt DESC
       LIMIT ?`,
      [COMMUNITY_POSTS_LIMIT],
    ),
    query<Array<{ wouaffId: string }>>(
      'SELECT wouaffId FROM users WHERE wouaffId IS NOT NULL AND wouaffId != "" ORDER BY createdAt DESC LIMIT ?',
      [PROFILES_LIMIT],
    ),
    query<Array<{ name: string }>>('SELECT name FROM communities WHERE isPrivate = 0 ORDER BY createdAt DESC LIMIT ?', [
      COMMUNITIES_LIMIT,
    ]),
    query<Array<{ tag: string }>>(
      'SELECT tag FROM hashtag_occurrences GROUP BY tag HAVING COUNT(*) >= 2 ORDER BY MAX(createdAt) DESC LIMIT ?',
      [HASHTAGS_LIMIT],
    ),
  ]);

  for (const post of posts) {
    entries.push({
      loc: `${SITE_URL}/post/${encodeURIComponent(post.id)}`,
      lastmod: isoDate(post.createdAt),
      changefreq: 'weekly',
      priority: '0.8',
    });
  }

  for (const cp of communityPosts) {
    entries.push({
      loc: `${SITE_URL}/c/${encodeURIComponent(cp.name)}/p/${encodeURIComponent(cp.id)}`,
      lastmod: isoDate(cp.createdAt),
      changefreq: 'weekly',
      priority: '0.8',
    });
  }

  for (const profile of profiles) {
    const handle = (profile.wouaffId || '').replace(/^@/, '');
    if (!handle) continue;
    entries.push({
      loc: `${SITE_URL}/@${encodeURIComponent(handle)}`,
      changefreq: 'weekly',
      priority: '0.6',
    });
  }

  for (const community of communities) {
    entries.push({
      loc: `${SITE_URL}/c/${encodeURIComponent(community.name)}`,
      changefreq: 'weekly',
      priority: '0.7',
    });
  }

  for (const hashtag of hashtags) {
    entries.push({
      loc: `${SITE_URL}/hashtag/${encodeURIComponent(hashtag.tag)}`,
      changefreq: 'weekly',
      priority: '0.5',
    });
  }

  return entries;
}

export async function buildSitemap(): Promise<string> {
  if (cache && cache.expiresAt > Date.now()) return cache.xml;
  const xml = toXml(await loadEntries());
  cache = { xml, expiresAt: Date.now() + CACHE_TTL_MS };
  return xml;
}

export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}
