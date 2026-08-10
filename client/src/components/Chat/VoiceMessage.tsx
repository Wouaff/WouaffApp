import { memo, useRef, useState } from 'react';

interface VoiceMessageProps {
  audioData?: string;
  duration?: number;
}

/* Barres de waveform déterministes (pseudo-aléatoire stable entre les rendus) */
const BARS: number[] = (() => {
  let seed = 7;
  const bars: number[] = [];
  for (let i = 0; i < 36; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    bars.push(0.25 + (seed / 233280) * 0.75);
  }
  return bars;
})();

function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const VoiceMessage = memo(function VoiceMessage({ audioData, duration }: VoiceMessageProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioRef.current && audioData) {
      const audio = new Audio(audioData);
      audioRef.current = audio;
      audio.onended = () => {
        setPlaying(false);
        setProgress(0);
      };
      audio.ontimeupdate = () => {
        if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
      };
      audio.play().then(() => setPlaying(true)).catch(() => {});
    } else if (audioRef.current?.paused) {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
    } else if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio?.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio * 100);
  };

  const filled = (i: number) => progress >= ((i + 1) / BARS.length) * 100;
  const currentSec = audioRef.current?.currentTime ?? 0;
  const displaySec = playing || progress > 0 ? currentSec : duration || 0;

  return (
    <div
      className="flex items-center gap-3 rounded-full bg-[var(--bg-input)] border border-[var(--border)] px-2.5 py-2 min-w-[190px] max-w-[320px]"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={toggle}
        className={`w-10 h-10 rounded-full border-none flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${
          playing ? 'bg-red-500 hover:bg-red-600' : 'bg-brand hover:opacity-90'
        }`}
        aria-label={playing ? 'Pause' : 'Lecture'}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-white">
          {playing ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /> : <path d="M8 5v14l11-7z" />}
        </svg>
      </button>

      <div className="flex flex-col flex-1 min-w-0 gap-1">
        <div
          className="flex items-center gap-[3px] h-8 cursor-pointer"
          onClick={seek}
          role="slider"
          aria-label="Progression audio"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {BARS.map((h, i) => (
            <span
              key={i}
              className={`w-[3px] rounded-full transition-colors ${
                filled(i) ? 'bg-brand' : 'bg-[var(--text-muted)]/35'
              }`}
              style={{ height: `${h * 32}px` }}
            />
          ))}
        </div>
        <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{fmt(displaySec)}</span>
      </div>
    </div>
  );
});

export default VoiceMessage;
