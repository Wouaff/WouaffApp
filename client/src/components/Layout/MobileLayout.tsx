import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import BottomNav from '../Navigation/BottomNav';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [storyBadge, setStoryBadge] = useState(false);

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

  return (
    <div className="flex flex-col h-full">
      {children}
      {user && <BottomNav storyBadge={storyBadge} />}
    </div>
  );
}
