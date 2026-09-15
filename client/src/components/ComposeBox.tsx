import { Film, Image } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface ComposeBoxProps {
  onTweet?: () => void;
  compact?: boolean;
}

export default function ComposeBox({ onTweet, compact }: ComposeBoxProps) {
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
        setText('');
        onTweet?.();
      }
    } catch {}
    setPosting(false);
  };

  return (
    <div className={`flex gap-3 ${compact ? 'p-3' : 'p-4'} border-b border-[var(--border-color)]`}>
      <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex-shrink-0 flex items-center justify-center text-sm font-bold overflow-hidden">
        {user?.avatar ? (
          <img src={user.avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          (user?.pseudo || '?')[0].toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`What's happening, ${user?.displayName || user?.pseudo || ''}?`}
          className="w-full bg-transparent text-[var(--text-primary)] text-lg placeholder-[var(--text-secondary)] outline-none resize-none border-none min-h-[60px]"
          rows={compact ? 2 : 3}
        />
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1 -ml-2">
            <button className="p-2 rounded-full hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
              <Image className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-full hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
              <Film className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-sm ${text.length > 280 ? 'text-[var(--danger)]' : text.length > 260 ? 'text-yellow-500' : 'text-[var(--text-secondary)]'}`}
            >
              {text.length} / 280
            </span>
            <button
              onClick={handlePost}
              disabled={!text.trim() || text.length > 280 || posting}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-full px-5 py-2 text-sm transition-colors"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
