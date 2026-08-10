import { Image, Smile } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

const MAX_LENGTH = 280;

interface ComposeBoxProps {
  onPost: (text: string) => void;
}

export default function ComposeBox({ onPost }: ComposeBoxProps) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handler = () => textareaRef.current?.focus();
    window.addEventListener('wouaff:focus-compose', handler);
    return () => window.removeEventListener('wouaff:focus-compose', handler);
  }, []);

  const remaining = MAX_LENGTH - text.length;
  const canPost = text.trim().length > 0 && remaining >= 0;

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onPost(value);
    setText('');
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
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 text-brand">
            <button
              type="button"
              title="Image (bientôt)"
              className="w-9 h-9 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-brand hover:bg-[var(--brand-glow)] transition-colors"
            >
              <Image size={19} />
            </button>
            <button
              type="button"
              title="Émojis (bientôt)"
              className="w-9 h-9 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-brand hover:bg-[var(--brand-glow)] transition-colors"
            >
              <Smile size={19} />
            </button>
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
