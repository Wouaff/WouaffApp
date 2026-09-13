import { Flag, Heart, MessageCircle, Pencil, Repeat2, Share2 } from 'lucide-react';
import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBadges } from '../../hooks/useBadges';
import { useI18n } from '../../i18n/context';
import { useFormatTimeAgo } from '../../i18n/time';
import type { RepostInfo, SocialPost } from '../../types';
import BadgeIcons from '../Common/BadgeIcons';
import VoiceMessage from '../Common/VoiceMessage';
import EditPostModal from './EditPostModal';
import Poll from './Poll';
import PostEmbeds from './PostEmbeds';
import PostText from './PostText';
import ReactionPicker from './Reactions';
import ReportPostModal from './ReportPostModal';
import SharePostModal from './SharePostModal';

interface PostCardProps {
  post: SocialPost;
  repostInfo?: RepostInfo;
  onReact: (id: string, type: string) => void;
  onRepost: (id: string) => void;
  onVote: (id: string, option: number) => void;
  onOpen: (post: SocialPost) => void;
}

const PostCard = memo(function PostCard({ post, repostInfo, onReact, onRepost, onVote, onOpen }: PostCardProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const formatTime = useFormatTimeAgo();
  const badgeDefs = useBadges();
  const [reportOpen, setReportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reactionOpen, setReactionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
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
      className="feed-post p-4 border-b border-[var(--border)] transition-colors hover:bg-[var(--bg-hover)]/40 cursor-pointer"
      onClick={() => onOpen(post)}
    >
      {repostInfo && (
        <div className="flex items-center gap-1.5 text-sms text-[var(--text-muted)] mb-3 mt-1 pl-1">
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
          <span>{t('a repartagé')}</span>
        </div>
      )}

      <div className="flex gap-3">
        {profileHref ? (
          <Link
            to={profileHref}
            className="flex-shrink-0 block"
            aria-label={t('Voir le profil de {name}', { name: post.pseudo })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-[var(--brand-ink)] font-extrabold text-base overflow-hidden flex-shrink-0">
              {post.avatar ? (
                <img
                  src={post.avatar}
                  alt={t('Avatar de {name}', { name: post.pseudo })}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initial}</span>
              )}
            </div>
          </Link>
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-[var(--brand-ink)] font-extrabold text-base overflow-hidden flex-shrink-0">
            {post.avatar ? (
              <img
                src={post.avatar}
                alt={t('Avatar de {name}', { name: post.pseudo })}
                className="w-full h-full object-cover"
              />
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
                className="font-bold text-[var(--text-primary)] text-md hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {post.pseudo}
              </Link>
            ) : (
              <span className="font-bold text-[var(--text-primary)] text-md">{post.pseudo}</span>
            )}
            {post.handle && post.handle.length > 1 && post.handle !== '@inconnu' && (
              <span className="text-[var(--text-muted)] text-md">@{post.handle.replace(/^@/, '')}</span>
            )}
            <BadgeIcons ids={post.ownedBadges} defs={badgeDefs} size={16} />
            <span className="text-[var(--text-muted)] text-md">·</span>
            <span className="text-[var(--text-muted)] text-md">{formatTime(post.time)}</span>
            {post.edited && <span className="text-[var(--text-muted)] text-xs">· {t('modifié')}</span>}
          </div>

          {post.text && (
            <p className="feed-post-text m-0 mt-1 text-md leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words">
              {renderText(post.text)}
            </p>
          )}

          <PostEmbeds text={post.text} />

          {post.poll && <Poll poll={post.poll} onVote={(option) => onVote(post.id, option)} />}

          {post.image && (
            <img
              src={post.image}
              alt={t('Post de {name}', { name: post.pseudo })}
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

          <div
            className="feed-post-actions post-actions flex items-center justify-between mt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onOpen(post)}
              className="btn btn-ghost btn-pill flex items-center gap-1.5 text-sms px-2 py-1 hover:text-[var(--brand)]"
              aria-label={t('Commenter ({n})', { n: post.comments })}
            >
              <MessageCircle size={17} />
              <span>{post.comments}</span>
            </button>

            <button
              type="button"
              onClick={() => onRepost(post.id)}
              className={`btn btn-pill flex items-center gap-1.5 text-sms px-2 py-1 ${
                post.reposted ? 'text-online' : 'btn-ghost hover:text-online hover:bg-online/10'
              }`}
              aria-label={t('Repartager ({n})', { n: post.reposts })}
            >
              <Repeat2 size={17} />
              <span>{post.reposts}</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setReactionOpen((o) => !o);
                }}
                className={`btn btn-pill flex items-center gap-1.5 text-sms px-2 py-1 ${
                  post.myReaction
                    ? 'text-[var(--like)]'
                    : 'btn-ghost hover:text-[var(--like)] hover:bg-[var(--like)]/10'
                }`}
                aria-label={t('Réagir ({n})', { n: post.likes })}
              >
                {post.myReaction ? (
                  <span className="text-lg leading-none">{post.myReaction}</span>
                ) : (
                  <Heart size={17} />
                )}
                <span>{post.likes}</span>
              </button>
              {reactionOpen && (
                <ReactionPicker
                  onClose={() => setReactionOpen(false)}
                  onSelect={(type) => {
                    onReact(post.id, type);
                    setReactionOpen(false);
                  }}
                />
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShareOpen(true);
              }}
              className="btn btn-ghost btn-pill flex items-center gap-1.5 text-sms px-2 py-1"
              aria-label={t('Partager ce post')}
              title={t('Partager')}
            >
              <Share2 size={17} />
            </button>

            {isOwn && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditOpen(true);
                }}
                className="btn btn-ghost btn-pill flex items-center gap-1.5 text-sms px-2 py-1"
                aria-label={t('Modifier la publication')}
                title={t('Modifier')}
              >
                <Pencil size={16} />
              </button>
            )}

            {!isOwn && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setReportOpen(true);
                }}
                className="btn btn-ghost-danger btn-pill flex items-center gap-1.5 text-sms px-2 py-1"
                aria-label={t('Signaler ce post')}
                title={t('Signaler')}
              >
                <Flag size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
      {editOpen && <EditPostModal post={post} onClose={() => setEditOpen(false)} onSaved={() => setEditOpen(false)} />}
      {reportOpen && <ReportPostModal postId={post.id} onClose={() => setReportOpen(false)} />}
      {shareOpen && <SharePostModal post={post} onClose={() => setShareOpen(false)} />}
    </article>
  );
});

export default PostCard;
