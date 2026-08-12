import { ArrowBigDown, ArrowBigUp, Link2, MessageCircle, Pin, Shield, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CommunityPost, CommunityRole } from '../../types';
import PostText from './PostText';

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

interface CommunityPostCardProps {
  post: CommunityPost;
  onOpen: (post: CommunityPost) => void;
  onVote: (post: CommunityPost, value: -1 | 0 | 1) => void;
  onDelete?: (post: CommunityPost) => void;
  onPin?: (post: CommunityPost) => void;
  myRole?: CommunityRole | null;
  showCommunity?: boolean;
}

export default function CommunityPostCard({
  post,
  onOpen,
  onVote,
  onDelete,
  onPin,
  myRole,
  showCommunity,
}: CommunityPostCardProps) {
  const navigate = useNavigate();
  const isMod = myRole === 'admin' || myRole === 'moderator';

  const voteBtn = (value: 1 | -1) =>
    `flex items-center gap-1 text-[13px] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 transition-colors ${
      post.vote === value
        ? value === 1
          ? 'text-brand'
          : 'text-[var(--danger)]'
        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
    }`;

  return (
    <article
      className="flex gap-3 px-4 py-3 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors last:border-b-0"
      onClick={() => onOpen(post)}
    >
      <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onVote(post, post.vote === 1 ? 0 : 1);
          }}
          className={voteBtn(1)}
          aria-label="Upvote"
          title="Upvote"
        >
          <ArrowBigUp size={22} />
        </button>
        <span
          className={`text-[13px] font-extrabold min-w-[32px] text-center ${
            post.score > 0 ? 'text-brand' : post.score < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'
          }`}
        >
          {post.score}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onVote(post, post.vote === -1 ? 0 : -1);
          }}
          className={voteBtn(-1)}
          aria-label="Downvote"
          title="Downvote"
        >
          <ArrowBigDown size={22} />
        </button>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap text-[13px]">
          {showCommunity && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/r/${post.communityName}`);
                }}
                className="font-bold text-[var(--text-primary)] rounded-full border-none bg-transparent cursor-pointer px-0 hover:underline"
              >
                r/{post.communityName}
              </button>
              <span className="text-[var(--text-muted)]">·</span>
            </>
          )}
          {post.isPinned && (
            <>
              <span className="flex items-center gap-0.5 text-[12px] font-bold text-online">
                <Pin size={12} /> Épinglé
              </span>
              <span className="text-[var(--text-muted)]">·</span>
            </>
          )}
          <span className="text-[var(--text-muted)]">
            publié par <span className="font-semibold text-[var(--text-secondary)]">{post.authorPseudo}</span>
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="text-[var(--text-muted)]">{formatTime(post.createdAt)}</span>
          {isMod && (
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-brand ml-auto">
              <Shield size={12} /> Mod
            </span>
          )}
        </div>

        <h3 className="m-0 mt-1 text-[16px] font-bold leading-snug text-[var(--text-primary)] break-words">
          {post.title}
        </h3>

        {post.type === 'image' && post.content && (
          <img
            src={post.content}
            alt={post.title}
            className="mt-2 rounded-xl border border-[var(--border)] max-h-[420px] w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
        {post.type === 'link' && post.content && (
          <a
            href={post.content}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 text-[13px] text-brand no-underline hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Link2 size={15} className="flex-shrink-0" />
            <span className="truncate">{post.content}</span>
          </a>
        )}
        {post.type === 'text' && post.content && (
          <p className="m-0 mt-1.5 text-[14px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap break-words line-clamp-4">
            <PostText text={post.content} />
          </p>
        )}

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(post);
            }}
            className="flex items-center gap-1.5 text-[13px] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 text-[var(--text-muted)] hover:text-brand hover:bg-[var(--brand-glow)] transition-colors"
            aria-label={`${post.commentCount} commentaires`}
          >
            <MessageCircle size={17} />
            <span>{post.commentCount}</span>
          </button>

          {isMod && onPin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPin(post);
              }}
              className="flex items-center gap-1.5 text-[13px] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 text-[var(--text-muted)] hover:text-online hover:bg-online/10 transition-colors"
              title={post.isPinned ? 'Désépingler' : 'Épingler'}
            >
              <Pin size={15} />
              <span>{post.isPinned ? 'Désépingler' : 'Épingler'}</span>
            </button>
          )}
          {isMod && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(post);
              }}
              className="flex items-center gap-1.5 text-[13px] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-red-500/10 transition-colors"
              title="Supprimer"
            >
              <Trash2 size={15} />
              <span>Supprimer</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
