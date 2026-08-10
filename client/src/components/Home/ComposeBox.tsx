import { Image, Smile, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { compressImage } from '../../utils/audio';
import EmojiPicker from '../Chat/EmojiPicker';
import { showToast } from '../Common/Toast';

const MAX_LENGTH = 280;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

interface ComposeBoxProps {
  onPost: (text: string, image?: string) => void;
}

export default function ComposeBox({ onPost }: ComposeBoxProps) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

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
  const canPost = (text.trim().length > 0 || image.length > 0) && remaining >= 0 && !imageLoading;

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
    onPost(text.trim(), image || undefined);
    setText('');
    setImage('');
    setShowEmojiPicker(false);
  };

  const initial = (user?.pseudo || '?')[0]?.toUpperCase() || '?';

  return (
    <div className="flex gap-3 p-4 border-b border-[var(--border)]">
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-base overflow-hidden flex-shrink-0">
        <span>{initial}</span>
      </div>
      <div className="flex-1 min-w-0">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Quoi de neuf ?"
          maxLength={MAX_LENGTH}
          rows={2}
          aria-label="Rédiger un post"
          className="w-full bg-transparent resize-none outline-none text-[19px] leading-snug text-[var(--text-primary)] placeholder-[var(--text-muted)] font-sans border-none py-1"
        />

        {image && (
          <div className="relative mt-2">
            <img
              src={image}
              alt="Aperçu"
              className="max-h-[320px] w-full object-cover rounded-2xl border border-[var(--border)]"
            />
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
      </div>
    </div>
  );
}
