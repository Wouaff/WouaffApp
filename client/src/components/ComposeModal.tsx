import { Film, Image, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface ComposeModalProps {
  onClose: () => void;
  onPosted: () => void;
}

export default function ComposeModal({ onClose, onPosted }: ComposeModalProps) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!text.trim() || text.length > 280 || posting) return;
    setPosting(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (res.ok) {
        onPosted();
        onClose();
      }
    } catch {}
    setPosting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-[var(--bg-modal)]" />
      <div
        className="relative bg-[var(--bg-primary)] rounded-2xl w-full max-w-[600px] mx-4 shadow-xl border border-[var(--border-color)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors">
            <X className="w-5 h-5 text-[var(--text-primary)]" />
          </button>
          <button
            onClick={handlePost}
            disabled={!text.trim() || text.length > 280 || posting}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-full px-5 py-1.5 text-sm transition-colors"
          >
            Post
          </button>
        </div>
        <div className="flex gap-3 p-4">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex-shrink-0 flex items-center justify-center text-sm font-bold overflow-hidden">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              (user?.pseudo || '?')[0].toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[var(--text-primary)]">{user?.pseudo}</div>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's happening?"
              className="w-full bg-transparent text-[var(--text-primary)] text-lg placeholder-[var(--text-secondary)] outline-none resize-none border-none mt-2 min-h-[120px]"
              rows={5}
            />
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
          <div className="flex gap-2">
            <button className="p-2 rounded-full hover:bg-[var(--accent)]/10 text-[var(--accent)] transition-colors">
              <Image className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-full hover:bg-[var(--accent)]/10 text-[var(--accent)] transition-colors">
              <Film className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-sm ${text.length > 280 ? 'text-[var(--danger)]' : text.length > 260 ? 'text-yellow-500' : 'text-[var(--text-secondary)]'}`}
            >
              {text.length} / 280
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
