import { BadgeCheck, Flag, Heart, MessageCircle, Repeat2, Share2 } from 'lucide-react';
import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { RepostInfo, SocialPost } from '../../types';
import VoiceMessage from '../Chat/VoiceMessage';
import Poll from './Poll';
import PostEmbeds from './PostEmbeds';
import PostText from './PostText';
import ReportPostModal from './ReportPostModal';
import SharePostModal from './SharePostModal';

interface PostCardProps {
  post: SocialPost;
  repostInfo?: RepostInfo;
  onLike: (id: string) => void;
  onRepost: (id: string) => void;
  onVote: (id: string, option: number) => void;
  onOpen: (post: SocialPost) => void;
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

const PostCard = memo(function PostCard({ post, repostInfo, onLike, onRepost, onVote, onOpen }: PostCardProps) {
  const { user } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const isOwn = !!user && post.uid === user.uid;
  const initial = (post.pseudo || '?')[0]?.toUpperCase() || '?';

  const profileHref =
    post.handle && post.handle.length > 1 && post.handle !== '@inconnu' ? `/@${post.handle.replace(/^@/, '')}` : null;

  const reposterHref =
    repostInfo && repostInfo.handle.length > 1 && repostInfo.handle !== '@inconnu'
      ? `/@${repostInfo.handle.replace(/^@/, '')}`
      : null;

  const renderText = (text: string) => <PostText text={text} />;

  return (
    <article
      className="p-4 border-b border-[var(--border)] transition-colors hover:bg-[var(--bg-hover)]/40 cursor-pointer"
      onClick={() => onOpen(post)}
    >
      {repostInfo && (
        <div className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] mb-2 pl-1">
          <Repeat2 size={15} className="flex-shrink-0" />
          {reposterHref ? (
            <Link
              to={reposterHref}
              className="font-bold text-[var(--text-muted)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {repostInfo.pseudo}
            </Link>
          ) : (
            <span className="font-bold">{repostInfo.pseudo}</span>
          )}
          <span>a repartagé</span>
        </div>
      )}

      <div className="flex gap-3">
        {profileHref ? (
          <Link
            to={profileHref}
            className="flex-shrink-0 block"
            aria-label={`Voir le profil de ${post.pseudo}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-base overflow-hidden flex-shrink-0">
              {post.avatar ? (
                <img src={post.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{initial}</span>
              )}
            </div>
          </Link>
        ) : (
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-base overflow-hidden flex-shrink-0">
            {post.avatar ? (
              <img src={post.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{initial}</span>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            {profileHref ? (
              <Link
                to={profileHref}
                className="font-bold text-[var(--text-primary)] text-[15px] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {post.pseudo}
              </Link>
            ) : (
              <span className="font-bold text-[var(--text-primary)] text-[15px]">{post.pseudo}</span>
            )}
            {post.verified && <BadgeCheck size={17} className="text-brand flex-shrink-0" aria-label="Compte vérifié" />}
            <span className="text-[var(--text-muted)] text-[15px]">·</span>
            <span className="text-[var(--text-muted)] text-[15px]">{formatTime(post.time)}</span>
          </div>

          {post.text && (
            <p className="m-0 mt-1 text-[15px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words">
              {renderText(post.text)}
            </p>
          )}

          <PostEmbeds text={post.text} />

          {post.poll && <Poll poll={post.poll} onVote={(option) => onVote(post.id, option)} />}

          {post.image && (
            <img
              src={post.image}
              alt=""
              className="mt-2 rounded-2xl border border-[var(--border)] max-h-[480px] w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          )}

          {post.audio && (
            <div className="mt-2 max-w-[425px]">
              <VoiceMessage audioData={post.audio} duration={post.audioDuration} />
            </div>
          )}

          <div className="flex items-center justify-between mt-3 max-w-[425px]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onOpen(post)}
              className="flex items-center gap-1.5 text-[13px] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 transition-colors text-[var(--text-muted)] hover:text-brand hover:bg-[var(--brand-glow)]"
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
              onClick={(e) => {
                e.stopPropagation();
                setShareOpen(true);
              }}
              className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 hover:text-brand hover:bg-[var(--brand-glow)] transition-colors"
              aria-label="Partager ce post"
              title="Partager"
            >
              <Share2 size={17} />
            </button>

            {!isOwn && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setReportOpen(true);
                }}
                className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] rounded-full border-none bg-transparent cursor-pointer px-2 py-1 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                aria-label="Signaler ce post"
                title="Signaler"
              >
                <Flag size={17} />
              </button>
            )}
          </div>
        </div>
      </div>
      {reportOpen && <ReportPostModal postId={post.id} onClose={() => setReportOpen(false)} />}
      {shareOpen && <SharePostModal post={post} onClose={() => setShareOpen(false)} />}
    </article>
  );
});

export default PostCard;
