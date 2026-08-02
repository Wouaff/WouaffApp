import { ChevronLeft, Film, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FeedCard from '../components/Feed/FeedCard';
import VideoModal from '../components/Feed/VideoModal';
import VideoUploader from '../components/Feed/VideoUploader';
import type { VideoData } from '../types';

export default function FeedPage() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadVideos = useCallback(
    async (p: number) => {
      if (loading) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/videos?page=${p}&limit=12`);
        const data = await res.json();
        if (data.length === 0) {
          setHasMore(false);
          return;
        }
        setVideos((prev) => (p === 1 ? data : [...prev, ...data]));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  useEffect(() => {
    loadVideos(1);
  }, [loadVideos]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((prev) => prev + 1);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  useEffect(() => {
    if (page > 1) loadVideos(page);
  }, [page, loadVideos]);

  const handleLike = (id: string) => {
    setVideos((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, liked: !v.liked, likesCount: v.liked ? v.likesCount - 1 : v.likesCount + 1 } : v,
      ),
    );
  };

  const handleUploaded = (video: VideoData) => {
    setVideos((prev) => [video, ...prev]);
  };

  return (
    <div className="feed-page">
      <div className="feed-header">
        <button className="feed-back" onClick={() => navigate('/')} aria-label="Retour">
          <ChevronLeft size={22} />
        </button>
        <div className="feed-header-info">
          <Film size={20} className="feed-header-icon" />
          <span>Feed</span>
        </div>
        <button className="feed-upload-btn-header" onClick={() => setShowUploader(true)} aria-label="Publier une vidéo">
          <Upload size={16} /> Publier
        </button>
      </div>

      <div className="feed-content">
        {videos.length === 0 && !loading ? (
          <div className="feed-empty">
            <div className="feed-empty-icon">
              <Film size={64} />
            </div>
            <h3>Bienvenue sur le Feed</h3>
            <p>Publie ta première vidéo et partage tes moments avec la communauté !</p>
            <button className="feed-empty-btn" onClick={() => setShowUploader(true)}>
              <Upload size={16} /> Publier une vidéo
            </button>
          </div>
        ) : (
          <div className="feed-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {videos.map((v) => (
              <FeedCard key={v.id} video={v} onLike={handleLike} onOpen={() => setSelectedVideo(v)} />
            ))}
            <div ref={sentinelRef} className="feed-sentinel">
              {loading && <div className="feed-spinner" />}
              {!hasMore && videos.length > 0 && <div className="feed-end">Plus de vidéos</div>}
            </div>
          </div>
        )}
      </div>

      {showUploader && <VideoUploader onClose={() => setShowUploader(false)} onUploaded={handleUploaded} />}
      {selectedVideo && <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} onLike={handleLike} />}
    </div>
  );
}
