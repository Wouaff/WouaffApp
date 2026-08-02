import { Heart, MapPin, MessageCircle, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { VideoComment, VideoData } from '../../types';
import { resolveMediaUrl } from '../../utils/media';

interface Props {
  video: VideoData;
  onClose: () => void;
  onLike: (id: string) => void;
}

export default function VideoModal({ video, onClose, onLike }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(video.liked || false);
  const [likeCount, setLikeCount] = useState(video.likesCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
    return () => {
      videoRef.current?.pause();
    };
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

  const loadComments = async () => {
    try {
      const res = await fetch(`/api/videos/${video.id}/comments`);
      setComments(await res.json());
    } catch (e) {
      console.error(e);
    }
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
    <div className="modal-overlay active" onClick={onClose}>
      <div className="video-modal" onClick={(e) => e.stopPropagation()}>
        <button className="video-modal-close" onClick={onClose}>
          <X size={22} />
        </button>

        <div className="video-modal-player">
          <video ref={videoRef} src={resolveMediaUrl(video.videoPath)} controls playsInline aria-label="Vidéo">
            <track kind="captions" />
          </video>
        </div>

        <div className="video-modal-info">
          <div className="video-modal-meta">
            <div className="video-modal-author">
              <div className="video-modal-avatar">
                {video.avatar ? <img src={video.avatar} alt="" loading="lazy" decoding="async" /> : <span>{(video.pseudo || '?')[0]}</span>}
              </div>
              <span className="video-modal-pseudo">{video.pseudo || 'Inconnu'}</span>
            </div>
            {video.caption && <div className="video-modal-caption">{video.caption}</div>}
            {video.location && (
              <div className="video-modal-location">
                <MapPin size={14} />
                <span>
                  {video.location.name || `${video.location.lat?.toFixed(4)}, ${video.location.lng?.toFixed(4)}`}
                </span>
              </div>
            )}
          </div>
          <div className="video-modal-actions">
            <button className={`video-modal-action${liked ? ' liked' : ''}`} onClick={handleLike}>
              <Heart size={22} />
              <span>{likeCount}</span>
            </button>
            <button
              className="video-modal-action"
              onClick={() => {
                if (!showComments) loadComments();
                setShowComments(!showComments);
              }}
            >
              <MessageCircle size={22} />
              <span>{video.commentsCount}</span>
            </button>
          </div>
        </div>

        {showComments && (
          <div className="video-modal-comments">
            <div className="video-modal-comments-header">
              <span>Commentaires</span>
            </div>
            <div className="video-modal-comments-list">
              {comments.length === 0 ? (
                <div className="video-modal-comments-empty">Aucun commentaire</div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="video-modal-comment-item">
                    <div className="video-modal-comment-avatar">
                      {c.avatar ? <img src={c.avatar} alt="" loading="lazy" decoding="async" /> : <span>{(c.pseudo || '?')[0]}</span>}
                    </div>
                    <div className="video-modal-comment-body">
                      <div className="video-modal-comment-pseudo">{c.pseudo || 'Inconnu'}</div>
                      <div className="video-modal-comment-text">{c.text}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="video-modal-comments-input">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Écrire un commentaire..."
                onKeyDown={(e) => e.key === 'Enter' && sendComment()}
              />
              <button onClick={sendComment} disabled={!commentText.trim()}>
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
