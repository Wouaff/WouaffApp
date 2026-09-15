import { Heart, MessageCircle, MoreHorizontal, Repeat2, Share } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import VerifiedBadge from './VerifiedBadge';

interface PostUser {
  uid: string;
  pseudo: string;
  displayName: string | null;
  avatar: string | null;
  verified: boolean;
}

export interface Post {
  id: number;
  text: string | null;
  image: string | null;
  createdAt: string;
  likesCount: number;
  repostsCount: number;
  commentsCount: number;
  userLiked: boolean;
  userReposted: boolean;
  repostOf: number | null;
  user: PostUser;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PostCard({ post, onDelete }: { post: Post; onDelete?: (id: number) => void }) {
  const [liked, setLiked] = useState(post.userLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [reposted, setReposted] = useState(post.userReposted);
  const [repostsCount, setRepostsCount] = useState(post.repostsCount);

  const handleLike = async () => {
    try {
      await api.post(`/posts/${post.id}/like`);
      setLiked(!liked);
      setLikesCount(liked ? likesCount - 1 : likesCount + 1);
    } catch {}
  };

  const handleRepost = async () => {
    try {
      await api.post(`/posts/${post.id}/repost`);
      setReposted(!reposted);
      setRepostsCount(reposted ? repostsCount - 1 : repostsCount + 1);
    } catch {}
  };

  const _handleDelete = async () => {
    if (!confirm('Delete this post?')) return;
    try {
      await api.del(`/posts/${post.id}`);
      onDelete?.(post.id);
    } catch {}
  };

  return (
    <article className="flex gap-3 px-4 py-3 border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/50 transition-colors cursor-pointer">
      <Link to={`/${post.user.pseudo}`} className="flex-shrink-0 mt-1">
        <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-sm font-bold overflow-hidden">
          {post.user.avatar ? (
            <img src={post.user.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            (post.user.pseudo || '?')[0].toUpperCase()
          )}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Link to={`/${post.user.pseudo}`} className="font-bold text-[var(--text-primary)] hover:underline truncate">
              {post.user.displayName || post.user.pseudo}
            </Link>
            {post.user.verified && <VerifiedBadge className="w-4 h-4" />}
            <Link to={`/${post.user.pseudo}`} className="text-[var(--text-secondary)] hover:underline truncate text-sm">
              @{post.user.pseudo}
            </Link>
            <span className="text-[var(--text-secondary)] flex-shrink-0 text-sm">·</span>
            <span className="text-[var(--text-secondary)] flex-shrink-0 text-sm">{timeAgo(post.createdAt)}</span>
          </div>
          <button className="p-1.5 rounded-full hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] transition-colors flex-shrink-0">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {post.repostOf && (
          <div className="flex items-center gap-1 text-sm text-[var(--text-secondary)] mb-1">
            <Repeat2 className="w-4 h-4" />
            <span>Reposted</span>
          </div>
        )}

        {post.text && (
          <p className="text-[var(--text-primary)] text-[15px] leading-relaxed mt-0.5 whitespace-pre-wrap break-words">
            {post.text}
          </p>
        )}

        {post.image && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-[var(--border-color)]">
            <img src={post.image} alt="" className="w-full max-h-[500px] object-cover" />
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-1 border-t border-[var(--border-color)]">
          <button className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors group">
            <div className="p-2 rounded-full group-hover:bg-[var(--accent)]/10 transition-colors">
              <MessageCircle className="w-5 h-5" />
            </div>
            <span className="text-sm">{post.commentsCount || ''}</span>
          </button>

          <button
            onClick={handleRepost}
            className={`flex items-center gap-1.5 transition-colors group ${reposted ? 'text-[var(--repost-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--repost-color)]'}`}
          >
            <div className="p-2 rounded-full group-hover:bg-[var(--repost-color)]/10 transition-colors">
              <Repeat2 className="w-5 h-5" />
            </div>
            <span className="text-sm">{repostsCount || ''}</span>
          </button>

          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 transition-colors group ${liked ? 'text-[var(--like-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--like-color)]'}`}
          >
            <div className="p-2 rounded-full group-hover:bg-[var(--like-color)]/10 transition-colors">
              <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
            </div>
            <span className="text-sm">{likesCount || ''}</span>
          </button>

          <button className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors group">
            <div className="p-2 rounded-full group-hover:bg-[var(--accent)]/10 transition-colors">
              <Share className="w-5 h-5" />
            </div>
          </button>
        </div>
      </div>
    </article>
  );
}
