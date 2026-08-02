import { Heart, MessageCircle, Play } from 'lucide-react';
import type { VideoData } from '../../types';
import { resolveMediaUrl } from '../../utils/media';

interface Props {
  video: VideoData;
  onLike: (id: string) => void;
  onOpen: () => void;
}

export default function FeedCard({ video, onLike, onOpen }: Props) {
  return (
    <div
      className="feed-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
    >
      <div className="feed-card-thumb">
        {video.thumbnailPath ? (
          <img src={resolveMediaUrl(video.thumbnailPath)} alt="" loading="lazy" />
        ) : (
          <video
            src={resolveMediaUrl(video.videoPath)}
            preload="metadata"
            muted
            playsInline
            className="feed-card-video-preview"
          />
        )}
        <div className="feed-card-thumb-overlay" />
        <div className="feed-card-play-icon">
          <Play size={18} />
        </div>
        <div className="feed-card-top-actions">
          <button
            className={`feed-card-like-btn${video.liked ? ' liked' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onLike(video.id);
            }}
          >
            <Heart size={14} />
            <span>{video.likesCount || 0}</span>
          </button>
        </div>
      </div>
      <div className="feed-card-body">
        <div className="feed-card-author">
          <div className="feed-card-avatar">
            {video.avatar ? <img src={video.avatar} alt="" /> : <span>{(video.pseudo || '?')[0]}</span>}
          </div>
          <span className="feed-card-pseudo">{video.pseudo || 'Inconnu'}</span>
        </div>
        {video.caption && <div className="feed-card-caption">{video.caption}</div>}
        <div className="feed-card-footer">
          <div className="feed-card-stat">
            <MessageCircle size={12} />
            <span>{video.commentsCount || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
