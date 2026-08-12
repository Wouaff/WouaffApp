import { Compass, Film, Home, User } from 'lucide-react';
import { memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface BottomNavProps {
  storyBadge?: boolean;
}

const BottomNav = memo(function BottomNav({ storyBadge }: BottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/' || location.pathname === '';
  const isExplore = location.pathname === '/explore';
  const isFeed = location.pathname === '/feed';
  const isSettings = location.pathname === '/settings';

  const items = [
    { path: '/', label: 'Accueil', active: isHome, icon: Home },
    { path: '/explore', label: 'Explorer', active: isExplore, icon: Compass },
    { path: '/feed', label: 'Feed', active: isFeed, icon: Film, badge: storyBadge },
    { path: '/settings', label: 'Profil', active: isSettings, icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] border-t border-[var(--border)] md:hidden"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
      aria-label="Navigation principale"
    >
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${item.active ? 'text-brand' : 'text-[var(--text-muted)]'}`}
              aria-label={item.label}
              aria-current={item.active ? 'page' : undefined}
            >
              <div className="relative">
                <Icon size={20} />
                {item.badge && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-brand rounded-full" />}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

export default BottomNav;
