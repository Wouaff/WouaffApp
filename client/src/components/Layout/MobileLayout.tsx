import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import BottomNav from '../Navigation/BottomNav';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [storyBadge, setStoryBadge] = useState(false);
  const touchStart = useRef({ x: 0, y: 0, t: 0 });
  const swipeHint = useRef(false);

  useEffect(() => {
    if (!user) return;
    const checkStories = () => {
      fetch('/api/stories')
        .then((r) => r.json())
        .then((data) => {
          const now = Date.now();
          const hasActive = Object.values(data as Record<string, unknown>).some((stories) =>
            Object.values(stories as Record<string, unknown>).some(
              (s: unknown) => ((s as Record<string, unknown>).expiresAt as number) > now,
            ),
          );
          setStoryBadge(hasActive);
        })
        .catch((e) => {
          console.error(e);
        });
    };
    checkStories();
    const interval = setInterval(checkStories, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const isChat = location.pathname === '/' || location.pathname === '' || location.pathname.match(/^\/@/);
  const isAdmin = location.pathname === '/admin';

  const goBackToChat = useCallback(() => {
    if (!isChat) navigate('/');
  }, [isChat, navigate]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (isChat || isAdmin) return;
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dt = Date.now() - touchStart.current.t;
      if (dx > 60 && dt < 400) {
        if (!swipeHint.current) {
          swipeHint.current = true;
        }
        goBackToChat();
      }
    },
    [isChat, isAdmin, goBackToChat],
  );

  return (
    <div className="flex flex-col h-full" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
      <div className={`swipe-hint${!isChat && !isAdmin && !swipeHint.current ? ' show' : ''}`}>
        Balayez vers la droite pour revenir à l'accueil
      </div>
      {user && !isAdmin && <BottomNav storyBadge={storyBadge} />}
    </div>
  );
}
