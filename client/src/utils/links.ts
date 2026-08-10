export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
  error?: string;
}

const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}>'"])/gi;

export function parseUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches || [];
}

export function textToParts(text: string): Array<{ type: 'text'; value: string } | { type: 'url'; value: string }> {
  const parts: Array<{ type: 'text'; value: string } | { type: 'url'; value: string }> = [];
  let lastIndex = 0;
  const re = new RegExp(URL_REGEX.source, 'gi');
  let match: RegExpExecArray | null = re.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'url', value: match[0] });
    lastIndex = match.index + match[0].length;
    match = re.exec(text);
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', value: text }];
}

const previewCache = new Map<string, LinkPreview>();

export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  const cached = previewCache.get(url);
  if (cached) return cached;

  try {
    const res = await fetch('/api/link-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const data: LinkPreview = await res.json();
    if (data.error) return null;
    previewCache.set(url, data);
    return data;
  } catch {
    return null;
  }
}

export function isSocialUrl(url: string): boolean {
  const social = [
    'youtube.com',
    'youtu.be',
    'twitter.com',
    'x.com',
    'instagram.com',
    'tiktok.com',
    'facebook.com',
    'twitch.tv',
    'discord.com',
    'reddit.com',
    'linkedin.com',
    'spotify.com',
    'soundcloud.com',
  ];
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return social.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}

export interface SocialEmbed {
  src: string;
  height: number;
}

/* Détecte un lien social et renvoie l'iframe d'embed correspondante (lecteur / player) */
export function getSocialEmbed(url: string): SocialEmbed | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v');
      if (id) return { src: `https://www.youtube.com/embed/${id}?rel=0`, height: 280 };
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      if (id) return { src: `https://www.youtube.com/embed/${id}?rel=0`, height: 280 };
    }
    if (host === 'open.spotify.com') {
      const m = u.pathname.match(/^\/(track|album|playlist|artist|episode)\/([A-Za-z0-9]+)/);
      if (m) return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: 152 };
    }
    if (host === 'soundcloud.com') {
      return {
        src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23f97b3b&auto_play=false&hide_related=false&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`,
        height: 152,
      };
    }
    if (host === 'tiktok.com') {
      const m = u.pathname.match(/\/video\/(\d+)/);
      if (m) return { src: `https://www.tiktok.com/embed/v2/${m[1]}`, height: 520 };
    }
    if (host === 'instagram.com') {
      const m = u.pathname.match(/^\/(p|reel|tv)\/([^/]+)/);
      if (m) return { src: `https://www.instagram.com/${m[1]}/${m[2]}/embed/`, height: 480 };
    }
    if (host === 'twitter.com' || host === 'x.com') {
      const m = u.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
      if (m) return { src: `https://platform.twitter.com/embed/Tweet.html?id=${m[2]}`, height: 320 };
    }
  } catch {
    return null;
  }
  return null;
}
