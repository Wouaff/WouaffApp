import { Film, Image, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';

interface ComposeBoxProps {
  onTweet?: () => void;
  compact?: boolean;
}

export default function ComposeBox({ onTweet, compact }: ComposeBoxProps) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      alert('Le fichier ne doit pas dépasser 30 Mo');
      return;
    }
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      alert('Type de fichier non supporté');
      return;
    }
    setMediaFile(file);
    setMediaType(isVideo ? 'video' : 'image');
    setMediaPreview(URL.createObjectURL(file));
  };

  const removeMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePost = async () => {
    if ((!text.trim() && !mediaFile) || text.length > 280 || posting) return;
    setPosting(true);
    try {
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;

      if (mediaFile) {
        const formData = new FormData();
        formData.append('file', mediaFile);
        const uploadResult = await api.upload<{ url: string; type: string }>('/upload', formData);
        if (uploadResult.type === 'video') {
          videoUrl = uploadResult.url;
        } else {
          imageUrl = uploadResult.url;
        }
      }

      const res = await fetch('/api/posts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim() || null,
          image: imageUrl,
          video: videoUrl,
        }),
      });
      if (res.ok) {
        setText('');
        removeMedia();
        onTweet?.();
      }
    } catch {
      // silent
    }
    setPosting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handlePost();
    }
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
          onKeyDown={handleKeyDown}
          placeholder={`What's happening, ${user?.displayName || user?.pseudo || ''}?`}
          className="w-full bg-transparent text-[var(--text-primary)] text-lg placeholder-[var(--text-secondary)] outline-none resize-none border-none min-h-[60px]"
          rows={compact ? 2 : 3}
        />

        {mediaPreview && (
          <div className="relative mt-2 mb-2 rounded-2xl overflow-hidden border border-[var(--border-color)]">
            <button
              onClick={removeMedia}
              className="absolute top-2 right-2 z-10 bg-[var(--bg-primary)]/80 rounded-full p-1 hover:bg-[var(--bg-primary)] transition-colors"
            >
              <X className="w-4 h-4 text-[var(--text-primary)]" />
            </button>
            {mediaType === 'video' ? (
              <video src={mediaPreview} className="w-full max-h-[300px] object-cover" controls preload="metadata">
                <track kind="captions" label="Français" srcLang="fr" src="" />
              </video>
            ) : (
              <img src={mediaPreview} alt="" className="w-full max-h-[300px] object-cover" />
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1 -ml-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,video/quicktime"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-full hover:bg-[var(--accent)]/10 text-[var(--accent)] transition-colors"
            >
              <Image className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = 'video/mp4,video/webm,video/ogg,video/quicktime';
                  fileInputRef.current.click();
                  fileInputRef.current.accept =
                    'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,video/quicktime';
                }
              }}
              className="p-2 rounded-full hover:bg-[var(--accent)]/10 text-[var(--accent)] transition-colors"
            >
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
              disabled={(!text.trim() && !mediaFile) || text.length > 280 || posting}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-full px-5 py-2 text-sm transition-colors"
            >
              {posting ? '...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
