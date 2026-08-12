import { BarChart3, Image, Mic, Smile, Square, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCap } from '../../hooks/useCap';
import { useMentionAutocomplete } from '../../hooks/useMentionAutocomplete';
import type { MentionUser } from '../../types';
import { compressImage } from '../../utils/audio';
import { type MentionToken, replaceMentionAt } from '../../utils/mentions';
import EmojiPicker from '../Common/EmojiPicker';
import { showToast } from '../Common/Toast';
import VoiceMessage from '../Common/VoiceMessage';
import GifPicker from './GifPicker';
import MentionSuggestions from './MentionSuggestions';

const MAX_LENGTH = 280;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_POLL_OPTIONS = 4;
const MIN_POLL_OPTIONS = 2;

interface PollDraft {
  question: string;
  options: string[];
}

interface ComposeBoxProps {
  onPost: (
    text: string,
    image?: string,
    audio?: string,
    audioDuration?: number,
    poll?: { question?: string; options: string[] },
    capToken?: string,
  ) => void;
}

export default function ComposeBox({ onPost }: ComposeBoxProps) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  const [audio, setAudio] = useState('');
  const [audioDuration, setAudioDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [poll, setPoll] = useState<PollDraft | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cap = useCap('post');

  const togglePoll = () => {
    setPoll((p) => (p ? null : { question: '', options: ['', ''] }));
  };

  const setPollOption = (i: number, value: string) => {
    setPoll((p) => {
      if (!p) return p;
      const options = [...p.options];
      options[i] = value;
      return { ...p, options };
    });
  };

  const addPollOption = () => {
    setPoll((p) => {
      if (!p || p.options.length >= MAX_POLL_OPTIONS) return p;
      return { ...p, options: [...p.options, ''] };
    });
  };

  const removePollOption = (i: number) => {
    setPoll((p) => {
      if (!p || p.options.length <= MIN_POLL_OPTIONS) return p;
      return { ...p, options: p.options.filter((_, idx) => idx !== i) };
    });
  };

  const applyMention = useCallback((mentionUser: MentionUser, token: MentionToken) => {
    setText((prev) => replaceMentionAt(prev, token, `${mentionUser.handle} `));
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const pos = token.start + mentionUser.handle.length + 1;
        el.setSelectionRange(pos, pos);
      }
    });
  }, []);

  const mention = useMentionAutocomplete(applyMention);

  useEffect(() => {
    const handler = () => textareaRef.current?.focus();
    window.addEventListener('wouaff:focus-compose', handler);
    return () => window.removeEventListener('wouaff:focus-compose', handler);
  }, []);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showEmojiPicker]);

  const remaining = MAX_LENGTH - text.length;
  const pollValid = !!poll && poll.options.filter((o) => o.trim()).length >= MIN_POLL_OPTIONS;
  const canPost =
    (text.trim().length > 0 || image.length > 0 || audio.length > 0 || pollValid) &&
    remaining >= 0 &&
    !imageLoading &&
    !recording;

  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => {
          t.stop();
        });
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          setAudio(reader.result as string);
          setAudioDuration(recordingTime);
        };
        reader.readAsDataURL(blob);
        setRecording(false);
        setRecordingTime(0);
      };
      recorder.start();
      setRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (e) {
      console.error('Mic access denied', e);
      showToast('Accès au microphone refusé', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.ondataavailable = null;
      rec.onstop = null;
      try {
        rec.stop();
      } catch {
        /* déjà arrêté */
      }
      rec.stream?.getTracks().forEach((t) => {
        t.stop();
      });
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecording(false);
    setRecordingTime(0);
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((v) => v + emoji);
    } else {
      const start = el.selectionStart ?? text.length;
      const end = el.selectionEnd ?? text.length;
      const next = text.slice(0, start) + emoji + text.slice(end);
      setText(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      });
    }
    setShowEmojiPicker(false);
  };

  const pickImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Veuillez sélectionner une image.', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      showToast('Image trop volumineuse (max 10 Mo).', 'error');
      return;
    }
    /* Les GIF ne sont pas compressés pour conserver l'animation */
    if (file.type === 'image/gif') {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target) setImage(e.target.result as string);
      };
      reader.readAsDataURL(file);
      return;
    }
    setImageLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (!e.target) return;
      try {
        const compressed = await compressImage(e.target.result as string);
        setImage(compressed);
      } catch {
        showToast("Impossible de traiter l'image.", 'error');
      } finally {
        setImageLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) pickImage(file);
    e.target.value = '';
  };

  const submit = () => {
    if (!canPost) return;
    if (cap.required && !cap.token) {
      showToast('Veuillez confirmer que vous êtes humain.', 'error');
      return;
    }
    const pollPayload =
      poll && poll.options.filter((o) => o.trim()).length >= MIN_POLL_OPTIONS
        ? {
            question: poll.question.trim(),
            options: poll.options.map((o) => o.trim()).filter(Boolean),
          }
        : undefined;
    onPost(text.trim(), image || undefined, audio || undefined, audioDuration || undefined, pollPayload, cap.token);
    cap.reset();
    setText('');
    setImage('');
    setAudio('');
    setAudioDuration(0);
    setPoll(null);
    setShowEmojiPicker(false);
  };

  const initial = (user?.pseudo || '?')[0]?.toUpperCase() || '?';

  return (
    <div className="flex gap-3 p-4 border-b border-[var(--border)]">
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-base overflow-hidden flex-shrink-0">
        <span>{initial}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              const value = e.target.value;
              setText(value);
              mention.handleChange(value, e.target.selectionStart ?? value.length);
            }}
            onKeyDown={(e) => {
              if (mention.handleKeyDown(e)) return;
            }}
            placeholder="Quoi de neuf ?"
            maxLength={MAX_LENGTH}
            rows={2}
            aria-label="Rédiger un post"
            className="w-full bg-transparent resize-none outline-none text-[19px] leading-snug text-[var(--text-primary)] placeholder-[var(--text-muted)] font-sans border-none py-1"
          />
          <MentionSuggestions
            open={mention.open}
            query={mention.query}
            results={mention.results}
            activeIndex={mention.activeIndex}
            onSelect={mention.selectActive}
          />
        </div>

        {image && (
          <div className="relative mt-2">
            <img
              src={image}
              alt="Aperçu"
              className="max-h-[320px] w-full object-cover rounded-2xl border border-[var(--border)]"
            />
            {(image.startsWith('data:image/gif') || /\.gif($|\?)/i.test(image)) && (
              <span className="absolute top-2 left-2 bg-black/60 text-white text-[11px] font-extrabold rounded px-1.5 py-0.5">
                GIF
              </span>
            )}
            <button
              type="button"
              onClick={() => setImage('')}
              aria-label="Retirer l'image"
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center border-none cursor-pointer hover:bg-black/80 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {recording && (
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="text-[13px] font-bold text-red-500 tabular-nums">
              {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
            </span>
            <span className="text-[13px] text-[var(--text-secondary)] flex-1">Enregistrement vocal...</span>
            <button
              type="button"
              onClick={stopRecording}
              className="bg-red-500 text-white text-[12px] font-bold rounded-full px-3 py-1.5 border-none cursor-pointer flex items-center gap-1.5 hover:opacity-90 transition-opacity flex-shrink-0"
            >
              <Square size={12} />
              Arrêter
            </button>
            <button
              type="button"
              onClick={cancelRecording}
              aria-label="Annuler l'enregistrement"
              className="w-7 h-7 rounded-full flex items-center justify-center border-none bg-transparent text-[var(--text-muted)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors flex-shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {audio && !recording && (
          <div className="mt-2 flex items-center gap-1">
            <VoiceMessage audioData={audio} duration={audioDuration} />
            <button
              type="button"
              onClick={() => {
                setAudio('');
                setAudioDuration(0);
              }}
              aria-label="Retirer l'audio"
              className="w-8 h-8 rounded-full flex items-center justify-center border-none bg-transparent text-[var(--text-muted)] cursor-pointer hover:bg-[var(--bg-hover)] hover:text-red-500 transition-colors flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {poll && (
          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-brand">
                <BarChart3 size={15} />
                Sondage
              </span>
              <button
                type="button"
                onClick={togglePoll}
                aria-label="Retirer le sondage"
                className="w-7 h-7 rounded-full flex items-center justify-center border-0 bg-transparent text-[var(--text-muted)] cursor-pointer hover:bg-[var(--bg-hover)] hover:text-red-500 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
            <input
              type="text"
              value={poll.question}
              onChange={(e) => setPoll((p) => (p ? { ...p, question: e.target.value } : p))}
              placeholder="Question (optionnel)"
              maxLength={140}
              className="w-full mb-3 bg-[var(--bg-input)] border-0 rounded-lg px-3 py-2.5 text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:bg-[var(--bg-hover)] font-sans transition-colors"
            />
            <div className="flex flex-col gap-2">
              {poll.options.map((opt, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: options de sondage ordonnées
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => setPollOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    maxLength={80}
                    className="flex-1 min-w-0 bg-[var(--bg-input)] border-0 rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:bg-[var(--bg-hover)] font-sans transition-colors"
                  />
                  {poll.options.length > MIN_POLL_OPTIONS && (
                    <button
                      type="button"
                      onClick={() => removePollOption(i)}
                      aria-label={`Retirer l'option ${i + 1}`}
                      className="w-8 h-8 rounded-full flex items-center justify-center border-0 bg-transparent text-[var(--text-muted)] cursor-pointer hover:bg-[var(--bg-hover)] hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {poll.options.length < MAX_POLL_OPTIONS && (
              <button
                type="button"
                onClick={addPollOption}
                className="mt-3 text-[13px] font-bold text-brand rounded-full border-0 bg-transparent cursor-pointer px-2 py-1 hover:text-brand-light transition-colors"
              >
                + Ajouter une option
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 text-brand">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Ajouter une image"
              className="w-9 h-9 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-brand hover:bg-[var(--brand-glow)] transition-colors"
            >
              <Image size={19} />
            </button>
            <button
              type="button"
              onClick={startRecording}
              title="Message vocal"
              className="w-9 h-9 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-brand hover:bg-[var(--brand-glow)] transition-colors"
            >
              <Mic size={19} />
            </button>
            <button
              type="button"
              onClick={togglePoll}
              title="Sondage"
              className={`w-9 h-9 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer transition-colors ${
                poll ? 'bg-[var(--brand-glow)] text-brand' : 'text-brand hover:bg-[var(--brand-glow)]'
              }`}
            >
              <BarChart3 size={19} />
            </button>
            <button
              type="button"
              onClick={() => setShowGifPicker(true)}
              title="Ajouter un GIF"
              className="h-9 px-2 rounded-full border-none bg-transparent cursor-pointer text-brand font-extrabold text-[12px] hover:bg-[var(--brand-glow)] transition-colors"
            >
              GIF
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="hidden"
              tabIndex={-1}
            />
            <div className="relative" ref={emojiPickerRef}>
              <button
                type="button"
                onClick={() => setShowEmojiPicker((o) => !o)}
                title="Émojis"
                className="w-9 h-9 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-brand hover:bg-[var(--brand-glow)] transition-colors"
              >
                <Smile size={19} />
              </button>
              {showEmojiPicker && <EmojiPicker onEmojiSelect={insertEmoji} />}
            </div>
            {imageLoading && (
              <span className="ml-1 text-xs text-[var(--text-muted)]" role="status">
                Compression...
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {remaining <= 20 && (
              <span
                className={`text-xs font-bold ${remaining >= 0 ? 'text-[var(--text-secondary)]' : 'text-red-500'}`}
                role="status"
              >
                {remaining}
              </span>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={!canPost}
              className="bg-brand hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity rounded-full px-5 py-2 font-bold text-white text-[15px] border-none cursor-pointer"
            >
              Poster
            </button>
          </div>
        </div>
        {cap.required && <div className="mt-3">{cap.widget}</div>}
      </div>
      {showGifPicker && (
        <GifPicker
          onSelect={(url) => {
            setImage(url);
            setShowGifPicker(false);
          }}
          onClose={() => setShowGifPicker(false)}
        />
      )}
    </div>
  );
}
