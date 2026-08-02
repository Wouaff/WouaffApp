import { Heart, MapPin, MessageCircle, Play, Send, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { VideoComment, VideoData } from '../../types';
import { resolveMediaUrl } from '../../utils/media';

interface Props {
  video: VideoData;
  isVisible: boolean;
  onLike: (id: string) => void;
}

export default function FeedVideo({ video, isVisible, onLike }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const [playing, setPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [liked, setLiked] = useState(video.liked || false);
  const [likeCount, setLikeCount] = useState(video.likesCount);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isVisible) {
      el.play()
        .then(() => setPlaying(true))
        .catch(() => {});
    } else {
      el.pause();
      setPlaying(false);
    }
  }, [isVisible]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play()
        .then(() => setPlaying(true))
        .catch(() => {});
    } else {
      el.pause();
      setPlaying(false);
    }
  }, []);

  const handleLike = async () => {
    try {
      const res = await fetch(`/api/videos/${video.id}/like`, { method: 'POST' });
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount((prev) => Math.max(0, data.liked ? prev + 1 : prev - 1));
      onLike(video.id);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleComments = async () => {
    if (!showComments) {
      try {
        const res = await fetch(`/api/videos/${video.id}/comments`);
        const data = await res.json();
        setComments(data);
      } catch (e) {
        console.error(e);
      }
    }
    setShowComments(!showComments);
  };

  const sendComment = async () => {
    if (!commentText.trim()) return;
    try {
      const res = await fetch(`/api/videos/${video.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText.trim() }),
      });
      const comment = await res.json();
      setComments((prev) => [...prev, comment]);
      setCommentText('');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="feed-video-wrapper">
      <video
        ref={videoRef}
        src={resolveMediaUrl(video.videoPath)}
        poster={resolveMediaUrl(video.thumbnailPath)}
        loop
        muted
        playsInline
        className="feed-video-player"
        onClick={togglePlay}
      />
      {!playing && (
        <div className="feed-video-play-overlay" onClick={togglePlay}>
          <Play size={48} />
        </div>
      )}

      <div className="feed-video-info">
        <div className="feed-video-author" onClick={() => navigate(`/@${video.pseudo}`)}>
          {video.avatar ? (
            <img src={video.avatar} alt="" className="feed-video-avatar" />
          ) : (
            <div className="feed-video-avatar feed-video-avatar-placeholder">{(video.pseudo || '?')[0]}</div>
          )}
          <span className="feed-video-pseudo">{video.pseudo || 'Inconnu'}</span>
        </div>
        {video.caption && <div className="feed-video-caption">{video.caption}</div>}
        {video.location && (
          <div className="feed-video-location">
            <MapPin size={14} />
            <span>{video.location.name || `${video.location.lat?.toFixed(4)}, ${video.location.lng?.toFixed(4)}`}</span>
          </div>
        )}
      </div>

      <div className="feed-video-actions">
        <button
          className={`feed-action-btn${liked ? ' liked' : ''}`}
          onClick={handleLike}
          aria-label="J'aime"
          aria-pressed={liked}
        >
          <Heart size={28} />
          <span>{likeCount}</span>
        </button>
        <button className="feed-action-btn" onClick={toggleComments} aria-label="Commentaires">
          <MessageCircle size={28} />
          <span>{video.commentsCount}</span>
        </button>
      </div>

      {showComments && (
        <div className="feed-comments-overlay" onClick={() => setShowComments(false)}>
          <div className="feed-comments-panel" onClick={(e) => e.stopPropagation()}>
            <div className="feed-comments-header">
              <span>Commentaires</span>
              <button onClick={() => setShowComments(false)} aria-label="Fermer les commentaires">
                <X size={20} />
              </button>
            </div>
            <div className="feed-comments-list">
              {comments.length === 0 ? (
                <div className="feed-comments-empty">Aucun commentaire</div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="feed-comment-item">
                    <div className="feed-comment-avatar">
                      {c.avatar ? <img src={c.avatar} alt="" /> : <span>{(c.pseudo || '?')[0]}</span>}
                    </div>
                    <div className="feed-comment-body">
                      <div className="feed-comment-pseudo">{c.pseudo || 'Inconnu'}</div>
                      <div className="feed-comment-text">{c.text}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="feed-comments-input">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Écrire un commentaire..."
                onKeyDown={(e) => e.key === 'Enter' && sendComment()}
              />
              <button onClick={sendComment} disabled={!commentText.trim()} aria-label="Envoyer le commentaire">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
