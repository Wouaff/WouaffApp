import { BadgeCheck, Heart, MessageCircle, Repeat2, Share2 } from 'lucide-react';
import { useState } from 'react';
import type { SocialPost } from '../../types';

interface PostCardProps {
  post: SocialPost;
  onLike: (id: string) => void;
  onRepost: (id: string) => void;
  onComment: (id: string, text: string) => void;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'hier';
  return `il y a ${d} j`;
}

export default function PostCard({ post, onLike, onRepost, onComment }: PostCardProps) {
  const initial = (post.pseudo || '?')[0]?.toUpperCase() || '?';
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');

  const submitComment = () => {
    const value = replyText.trim();
    if (!value) return;
    onComment(post.id, value);
    setReplyText('');
    setReplying(false);
  };

  return (
    <article className="flex gap-3 p-4 border-b border-[var(--border)] transition-colors hover:bg-[var(--bg-hover)]/40">
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-base overflow-hidden flex-shrink-0">
        {post.avatar ? <img src={post.avatar} alt="" className="w-full h-full object-cover" /> : <span>{initial}</span>}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-bold text-[var(--text-primary)] text-[15px]">{post.pseudo}</span>
          {post.verified && <BadgeCheck size={17} className="text-brand flex-shrink-0" aria-label="Compte vérifié" />}
          <span className="text-[var(--text-muted)] text-[15px]">·</span>
          <span className="text-[var(--text-muted)] text-[15px]">{formatTime(post.time)}</span>
        </div>

        <p className="m-0 mt-1 text-[15px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words">
          {post.text}
        </p>

        <div className="flex items-center justify-between mt-3 max-w-[425px]">
          <button
            type="button"
            onClick={() => setReplying((r) => !r)}
            className={`flex items-center gap-1.5 text-[13px] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 transition-colors ${
              replying ? 'text-brand' : 'text-[var(--text-muted)] hover:text-brand hover:bg-[var(--brand-glow)]'
            }`}
            aria-label={`Commenter (${post.comments})`}
          >
            <MessageCircle size={17} />
            <span>{post.comments}</span>
          </button>

          <button
            type="button"
            onClick={() => onRepost(post.id)}
            className={`flex items-center gap-1.5 text-[13px] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 transition-colors ${
              post.reposted ? 'text-online' : 'text-[var(--text-muted)] hover:text-online hover:bg-online/10'
            }`}
            aria-label={`Repartager (${post.reposts})`}
          >
            <Repeat2 size={17} />
            <span>{post.reposts}</span>
          </button>

          <button
            type="button"
            onClick={() => onLike(post.id)}
            className={`flex items-center gap-1.5 text-[13px] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 transition-colors ${
              post.liked ? 'text-red-500' : 'text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10'
            }`}
            aria-label={`J'aime (${post.likes})`}
          >
            <Heart size={17} fill={post.liked ? 'currentColor' : 'none'} />
            <span>{post.likes}</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 hover:text-brand hover:bg-[var(--brand-glow)] transition-colors"
            aria-label="Partager"
            title="Partager (bientôt)"
          >
            <Share2 size={17} />
          </button>
        </div>

        {replying && (
          <div className="flex items-center gap-2 mt-3">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitComment();
              }}
              placeholder="Répondre..."
              maxLength={280}
              aria-label={`Répondre à ${post.pseudo}`}
              className="flex-1 min-w-0 bg-[var(--bg-input)] border border-[var(--border)] rounded-full px-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--brand)] font-sans transition-colors"
            />
            <button
              type="button"
              onClick={submitComment}
              disabled={!replyText.trim()}
              className="bg-brand hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-white font-bold text-sm rounded-full px-4 py-2 border-none cursor-pointer"
            >
              Répondre
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
