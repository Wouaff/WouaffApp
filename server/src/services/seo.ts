import { getOne } from '../config/database.js';

export interface SeoData {
  title: string;
  description: string;
  image: string | null;
  url: string;
  type: string;
}

const SITE_URL = process.env.APP_URL?.replace(/\/$/, '') || 'https://wouaff.app';
const SITE_NAME = 'Wouaff';

/* Seules les URLs absolues (ou relatives au domaine) sont acceptées par les crawlers.
   Les data: URI (images stockées en base) ne fonctionnent pas pour og:image. */
function absoluteImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${SITE_URL}${url}`;
  return null;
}

function strip(s: string, max = 160): string {
  const v = s.replace(/\s+/g, ' ').trim();
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function defaultSeo(url: string): SeoData {
  return {
    title: "Wouaff — t'as capté 🐺",
    description:
      'Wouaff, le réseau social français et souverain. Chat privé sécurisé (E2EE), posts, vidéos et communautés.',
    image: `${SITE_URL}/assets/logo/logo.png`,
    url,
    type: 'website',
  };
}

export async function postSeo(id: string, url: string): Promise<SeoData | null> {
  const row = await getOne<Record<string, unknown>>(
    `SELECT p.text, p.image, p.audio, u.pseudo, u.wouaffId, u.avatar
     FROM posts p LEFT JOIN users u ON u.uid = p.uid WHERE p.id = ?`,
    [id],
  );
  if (!row) return null;
  const pseudo = (row.pseudo as string) || 'Utilisateur';
  const handle = (row.wouaffId as string) ? `@${row.wouaffId}` : '@inconnu';
  const text = strip((row.text as string) || '');
  return {
    title: `${pseudo} · ${handle} — Wouaff`,
    description: text || `Voir le post de ${pseudo} sur Wouaff.`,
    image: absoluteImage((row.image as string) || null) ?? `${SITE_URL}/assets/logo/logo.png`,
    url,
    type: 'article',
  };
}

export async function profileSeo(handle: string, url: string): Promise<SeoData | null> {
  const profile = await getOne<Record<string, unknown>>(
    'SELECT pseudo, bio, avatar, wouaffId FROM users WHERE wouaffId = ?',
    [`@${handle}`],
  );
  if (!profile) return null;
  const pseudo = (profile.pseudo as string) || 'Utilisateur';
  const bio = strip((profile.bio as string) || '');
  return {
    title: `${pseudo} (@${handle}) — Wouaff`,
    description: bio || `Découvrez le profil de ${pseudo} sur Wouaff.`,
    image: absoluteImage((profile.avatar as string) || null) ?? `${SITE_URL}/assets/logo/logo.png`,
    url,
    type: 'profile',
  };
}

export async function buildSeo(pathname: string, fullUrl: string): Promise<SeoData> {
  const postMatch = pathname.match(/^\/post\/(.+)/);
  if (postMatch) {
    const seo = await postSeo(decodeURIComponent(postMatch[1]), fullUrl).catch(() => null);
    if (seo) return seo;
  }
  const profileMatch = pathname.match(/^\/@(.+)/);
  if (profileMatch) {
    const seo = await profileSeo(decodeURIComponent(profileMatch[1]), fullUrl).catch(() => null);
    if (seo) return seo;
  }
  return defaultSeo(fullUrl);
}

/* Balises meta injectées côté serveur (embeds Discord, WhatsApp, Facebook, Twitter) */
export function seoMetaTags(seo: SeoData): string {
  const image = seo.image || `${SITE_URL}/assets/logo/logo.png`;
  return `
    <meta name="title" content="${esc(seo.title)}" />
    <meta name="description" content="${esc(seo.description)}" />
    <meta property="og:type" content="${esc(seo.type)}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${esc(seo.title)}" />
    <meta property="og:description" content="${esc(seo.description)}" />
    <meta property="og:url" content="${esc(seo.url)}" />
    <meta property="og:image" content="${esc(image)}" />
    <meta property="og:locale" content="fr_FR" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(seo.title)}" />
    <meta name="twitter:description" content="${esc(seo.description)}" />
    <meta name="twitter:image" content="${esc(image)}" />
    <link rel="canonical" href="${esc(seo.url)}" />`;
}

export { SITE_URL };
