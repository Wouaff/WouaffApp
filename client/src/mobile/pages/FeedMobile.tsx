import { IonInfiniteScroll, IonInfiniteScrollContent, IonSpinner, IonText } from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import FeedCard from '../../components/Feed/FeedCard';
import VideoModal from '../../components/Feed/VideoModal';
import type { VideoData } from '../../types';
import MobilePage from '../MobilePage';

export default function FeedMobile() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const initialLoaded = useRef(false);

  const loadVideos = useCallback(
    async (p: number, append = true) => {
      if (loading) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/videos?page=${p}&limit=12`);
        const data = (await res.json()) as VideoData[];
        if (data.length === 0) {
          setHasMore(false);
        } else {
          setVideos((prev) => (append ? [...prev, ...data] : data));
        }
      } catch (e) {
        console.error(e);
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

  return (
    <MobilePage title="Feed" onRefresh={() => loadVideos(1, false)}>
      {videos.length === 0 && !loading ? (
        <div className="text-center py-16 px-6">
          <div className="text-4xl mb-3" aria-hidden="true">
            🎬
          </div>
          <IonText color="medium">Bienvenue sur le Feed ! Publie ta première vidéo.</IonText>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-3 pt-2">
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

      {loading && videos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <IonSpinner />
        </div>
      )}

      {selectedVideo && <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} onLike={handleLike} />}
    </MobilePage>
  );
}
