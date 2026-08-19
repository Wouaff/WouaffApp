import { ExternalLink, Music2 } from 'lucide-react';

export interface ProfileMusic {
  provider: string;
  url: string;
  title: string;
  artist: string;
  thumbnail: string;
}

export function parseProfileMusic(p: Record<string, unknown>): ProfileMusic | null {
  const url = p.musicUrl as string | undefined;
  if (!url) return null;
  return {
    provider: (p.musicProvider as string) || 'other',
    url,
    title: (p.musicTitle as string) || '',
    artist: (p.musicArtist as string) || '',
    thumbnail: (p.musicThumbnail as string) || '',
  };
}

const PROVIDER_LABELS: Record<string, string> = {
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  youtube: 'YouTube Music',
  tidal: 'Tidal',
  deezer: 'Deezer',
  apple: 'Apple Music',
  other: 'Musique',
};

export default function MusicCard({ music }: { music: ProfileMusic }) {
  const providerLabel = PROVIDER_LABELS[music.provider] || music.provider || 'Musique';
  return (
    <a
      href={music.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 mt-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3 no-underline hover:bg-[var(--bg-hover)]/60 transition-colors"
      aria-label={`Écouter ${music.title || 'la musique'} sur ${providerLabel}`}
    >
      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bg-input)] flex items-center justify-center text-brand">
        {music.thumbnail ? (
          <img src={music.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <Music2 size={20} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-[var(--text-primary)] truncate">{music.title || 'Musique'}</div>
        <div className="text-[12px] text-[var(--text-muted)] truncate">
          {[music.artist, providerLabel].filter(Boolean).join(' · ')}
        </div>
      </div>
      <ExternalLink size={16} className="text-[var(--text-muted)] flex-shrink-0" />
    </a>
  );
}
