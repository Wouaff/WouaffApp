import { isIP } from 'node:net';

export interface ResolvedMusic {
  provider: string;
  url: string;
  title: string;
  artist: string;
  thumbnail: string;
}

interface ProviderRule {
  id: string;
  label: string;
  hosts: string[];
  oembed: (url: string) => string;
}

const PROVIDERS: ProviderRule[] = [
  {
    id: 'spotify',
    label: 'Spotify',
    hosts: ['open.spotify.com'],
    oembed: (url) => `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'soundcloud',
    label: 'SoundCloud',
    hosts: ['soundcloud.com', 'www.soundcloud.com'],
    oembed: (url) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'youtube',
    label: 'YouTube',
    hosts: ['youtube.com', 'www.youtube.com', 'youtu.be', 'music.youtube.com', 'm.youtube.com'],
    oembed: (url) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'tidal',
    label: 'Tidal',
    hosts: ['tidal.com', 'www.tidal.com'],
    oembed: (url) => `https://oembed.tidal.com/oembed?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'deezer',
    label: 'Deezer',
    hosts: ['deezer.com', 'www.deezer.com'],
    oembed: (url) => `https://api.deezer.com/oembed?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'apple',
    label: 'Apple Music',
    hosts: ['music.apple.com'],
    oembed: () => '',
  },
];

const PRIVATE_HOST_RE =
  /^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0)(:|$|\/)/i;

function looksPrivate(url: URL): boolean {
  if (/^localhost$/i.test(url.hostname)) return true;
  if (PRIVATE_HOST_RE.test(url.hostname)) return true;
  const ip = isIP(url.hostname);
  if (ip === 4) {
    const parts = url.hostname.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
  }
  if (ip === 6 && /^f[cd][0-9a-f]{2}:/i.test(url.hostname)) return true;
  return false;
}

async function fetchJson<T>(endpoint: string): Promise<T | null> {
  try {
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Wouaff/1.0' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchOgMeta(url: string): Promise<Record<string, string>> {
  const target = new URL(url);
  if (looksPrivate(target)) return {};
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Wouaff/1.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
      redirect: 'follow',
    });
    if (!res.ok) return {};
    const html = await res.text();
    const meta: Record<string, string> = {};
    const re = /<meta[^>]+(?:property|name)=["'](og:[a-z:_]+)["'][^>]+content=["']([^"']*)["']/gi;
    let m = re.exec(html);
    while (m) {
      const key = m[1] as string;
      if (!meta[key]) meta[key] = m[2] ?? '';
      m = re.exec(html);
    }
    return meta;
  } catch {
    return {};
  }
}

function findProvider(url: URL): ProviderRule | null {
  const host = url.hostname.toLowerCase();
  for (const p of PROVIDERS) {
    if (p.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return p;
  }
  return null;
}

function splitArtistTitle(rawTitle: string): { title: string; artist: string } {
  const idx = rawTitle.indexOf(' - ');
  if (idx > 0) {
    const artist = rawTitle.slice(0, idx).trim();
    const title = rawTitle.slice(idx + 3).trim();
    if (artist && title && artist.length < 80) return { artist, title };
  }
  return { title: rawTitle, artist: '' };
}

export async function resolveMusicLink(rawUrl: string): Promise<ResolvedMusic | null> {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (looksPrivate(url)) return null;

  const provider = findProvider(url);
  let title = '';
  let artist = '';
  let thumbnail = '';

  if (provider?.id === 'apple') {
    const og = await fetchOgMeta(url.toString());
    title = og['og:title'] || '';
    thumbnail = og['og:image'] || '';
    artist = og['og:audio:artist'] || '';
  } else if (provider?.oembed) {
    const data = await fetchJson<{
      title?: string;
      author_name?: string;
      provider_name?: string;
      thumbnail_url?: string;
    }>(provider.oembed(url.toString()));
    if (data && (data.title || data.thumbnail_url)) {
      title = data.title || '';
      artist = data.author_name || '';
      thumbnail = data.thumbnail_url || '';
    }
  }

  if (!title && !thumbnail) {
    const og = await fetchOgMeta(url.toString());
    title = og['og:title'] || '';
    thumbnail = og['og:image'] || '';
  }

  if (!title && !thumbnail) return null;

  if (provider?.id === 'youtube') {
    const split = splitArtistTitle(title.replace(/\s*\(Official.*$/i, ''));
    if (!artist && split.artist) {
      artist = split.artist;
      title = split.title;
    }
    title = title.replace(/^\s*\[.*\]\s*/, '').trim();
  } else if (provider?.id === 'soundcloud' && artist && title.toLowerCase().endsWith(` by ${artist.toLowerCase()}`)) {
    title = title.slice(0, title.length - ` by ${artist}`.length).trim();
  } else if (!artist) {
    const split = splitArtistTitle(title);
    if (split.artist) {
      artist = split.artist;
      title = split.title;
    }
  }

  title = title.trim().slice(0, 240);
  artist = artist.trim().slice(0, 200);

  return {
    provider: provider?.id || 'other',
    url: url.toString(),
    title: title || url.hostname,
    artist,
    thumbnail,
  };
}
