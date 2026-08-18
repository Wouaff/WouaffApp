import { IonFab, IonFabButton, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/react';
import { videocam } from 'ionicons/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import FeedCard from '../../components/Feed/FeedCard';
import VideoModal from '../../components/Feed/VideoModal';
import VideoUploader from '../../components/Feed/VideoUploader';
import type { VideoData } from '../../types';
import MobilePage from '../MobilePage';
import { MobileEmpty, MobileError, VideoGridSkeleton } from '../MobileState';
import SearchButton from '../SearchButton';

export default function FeedMobile() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const initialLoaded = useRef(false);

  const loadVideos = useCallback(
    async (p: number, append = true) => {
      if (loading) return;
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/videos?page=${p}&limit=12`);
        if (!res.ok) throw new Error('Impossible de charger les vidéos');
        const data = (await res.json()) as VideoData[];
        if (data.length === 0) {
          setHasMore(false);
        } else {
          setVideos((prev) => (append ? [...prev, ...data] : data));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Impossible de charger les vidéos');
        if (!append) setVideos([]);
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  useEffect(() => {
    if (!initialLoaded.current) {
      initialLoaded.current = true;
      loadVideos(1, false);
    }
  }, [loadVideos]);

  const handleLike = (id: string) => {
    setVideos((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, liked: !v.liked, likesCount: v.liked ? v.likesCount - 1 : v.likesCount + 1 } : v,
      ),
    );
  };

  const handleUploaded = (video: VideoData) => {
    setVideos((prev) => [video, ...prev]);
    setShowUploader(false);
  };

  return (
    <MobilePage title="Feed" onRefresh={() => loadVideos(1, false)} rightSlot={<SearchButton />}>
      {loading && videos.length === 0 ? (
        <VideoGridSkeleton count={6} />
      ) : error && videos.length === 0 ? (
        <MobileError message={error} onRetry={() => loadVideos(1, false)} />
      ) : videos.length === 0 ? (
        <MobileEmpty
          icon={<IonIcon icon={videocam} />}
          title="Bienvenue sur le Feed"
          text="Publie ta première vidéo pour commencer."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pt-3">
          {videos.map((v) => (
            <FeedCard key={v.id} video={v} onLike={handleLike} onOpen={() => setSelectedVideo(v)} />
          ))}
        </div>
      )}

      <IonInfiniteScroll
        threshold="100px"
        disabled={!hasMore}
        onIonInfinite={async (e) => {
          const next = page + 1;
          await loadVideos(next);
          setPage(next);
          e.target.complete();
        }}
      >
        <IonInfiniteScrollContent loadingSpinner="crescent" loadingText="Chargement..." />
      </IonInfiniteScroll>

      <IonFab vertical="bottom" horizontal="end" slot="fixed">
        <IonFabButton onClick={() => setShowUploader(true)} aria-label="Publier une vidéo">
          <IonIcon icon={videocam} />
        </IonFabButton>
      </IonFab>

      {selectedVideo && <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} onLike={handleLike} />}
      {showUploader && <VideoUploader onClose={() => setShowUploader(false)} onUploaded={handleUploaded} />}
    </MobilePage>
  );
}
