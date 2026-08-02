import { memo, useRef, useState } from 'react';

interface VoiceMessageProps {
  audioData?: string;
  duration?: number;
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
      audio.play().then(() => setPlaying(true));
    } else if (audioRef.current?.paused) {
      audioRef.current.play().then(() => setPlaying(true));
    } else if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setProgress(val);
    if (audioRef.current?.duration) {
      audioRef.current.currentTime = (val / 100) * audioRef.current.duration;
    }
  };

  const dur = duration || 0;
  const dm = Math.floor(dur / 60);
  const ds = dur % 60;

  return (
    <div className="msg-voice">
      <button type="button" className="voice-play-btn" onClick={toggle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-label={playing ? 'Pause' : 'Lecture'}>
          {playing ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /> : <path d="M8 5v14l11-7z" />}
        </svg>
      </button>
      <div className="voice-track">
        <input type="range" className="voice-track-progress" value={progress} max={100} onChange={seek} />
        <span className="voice-track-time">
          {dm}:{ds < 10 ? '0' : ''}
          {ds}
        </span>
      </div>
    </div>
  );
});

export default VoiceMessage;
