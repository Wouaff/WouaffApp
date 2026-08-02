import { useEffect, useRef, useState } from 'react';
import EmojiPicker from './EmojiPicker';

const EPHEMERAL_OPTIONS = [
  { label: '5s', value: 5 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
  { label: '1h', value: 3600 },
  { label: '24h', value: 86400 },
];

interface MessageInputProps {
  inputValue: string;
  recording: boolean;
  recordingTime: number;
  showEmojiPicker: boolean;
  ephemeralDuration: number | null;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onFileSelect: (file: File) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onToggleEmojiPicker: () => void;
  onEmojiSelect: (emoji: string) => void;
  onCloseEmojiPicker: () => void;
  onEphemeralChange: (duration: number | null) => void;
  placeholder: string;
}

export default function MessageInput({
  inputValue,
  recording,
  recordingTime,
  showEmojiPicker,
  ephemeralDuration,
  onInputChange,
  onSend,
  onFileSelect,
  onStartRecording,
  onStopRecording,
  onToggleEmojiPicker,
  onEmojiSelect,
  onCloseEmojiPicker,
  onEphemeralChange,
  placeholder,
}: MessageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [showEphemeralPicker, setShowEphemeralPicker] = useState(false);
  const ephemeralPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        onCloseEmojiPicker();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showEmojiPicker, onCloseEmojiPicker]);

  useEffect(() => {
    if (!showEphemeralPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (ephemeralPickerRef.current && !ephemeralPickerRef.current.contains(e.target as Node)) {
        setShowEphemeralPicker(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showEphemeralPicker]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) onFileSelect(file);
        return;
      }
    }
  };

  return (
    <div className="msg-input-area">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            onFileSelect(f);
            e.target.value = '';
          }
        }}
      />
      <button
        type="button"
        className="input-action-btn"
        onClick={() => fileInputRef.current?.click()}
        title="Joindre un fichier"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-label="Joindre un fichier">
          <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
        </svg>
      </button>
      {recording ? (
        <button type="button" className="recording-indicator" onClick={onStopRecording}>
          <span className="recording-dot" />
          <span className="recording-time">
            {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Arrêter l'enregistrement">
            <path d="M6 6h12v12H6z" />
          </svg>
        </button>
      ) : (
        <button type="button" className="input-action-btn" onClick={onStartRecording} title="Message vocal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-label="Message vocal">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        </button>
      )}
      <div className="emoji-wrapper" ref={emojiPickerRef}>
        <button type="button" className="input-action-btn" onClick={onToggleEmojiPicker} title="Emoji">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-label="Emoji">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
          </svg>
        </button>
        {showEmojiPicker && <EmojiPicker onEmojiSelect={onEmojiSelect} />}
      </div>
      <div className="ephemeral-wrapper" ref={ephemeralPickerRef}>
        <button
          type="button"
          className={`input-action-btn${ephemeralDuration ? ' active' : ''}`}
          onClick={() => setShowEphemeralPicker((o) => !o)}
          title="Message éphémère"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-.5-13v4l-3.5 2.08.5.83 4-2.42V7h-1z" />
          </svg>
        </button>
        {showEphemeralPicker && (
          <div className="ephemeral-picker">
            {EPHEMERAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`ephemeral-option${ephemeralDuration === opt.value ? ' active' : ''}`}
                onClick={() => {
                  onEphemeralChange(ephemeralDuration === opt.value ? null : opt.value);
                  setShowEphemeralPicker(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {ephemeralDuration && (
          <button
            type="button"
            className="ephemeral-active-indicator"
            onClick={() => {
              onEphemeralChange(null);
              setShowEphemeralPicker(false);
            }}
          >
            🕐 {EPHEMERAL_OPTIONS.find((o) => o.value === ephemeralDuration)?.label}
          </button>
        )}
      </div>
      <label htmlFor="msgInput" className="sr-only">
        Message
      </label>
      <input
        id="msgInput"
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSend();
        }}
        onPaste={handlePaste}
        placeholder={placeholder}
      />
      <button type="button" className="send-btn" onClick={onSend}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-label="Envoyer">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </div>
  );
}
