import { Compass, Film, Home, MessageSquare, Settings, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface HamburgerMenuProps {
  open: boolean;
  onClose: () => void;
  storyBadge?: boolean;
}

export default function HamburgerMenu({ open, onClose, storyBadge }: HamburgerMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isHome = location.pathname === '/' || location.pathname === '';
  const isChat = location.pathname === '/chat';
  const isSettings = location.pathname === '/settings';
  const isExplore = location.pathname === '/explore';
  const isFeed = location.pathname === '/feed';

  const items = [
    { path: '/', label: 'Accueil', active: isHome, icon: Home },
    { path: '/chat', label: 'Messages', active: isChat, icon: MessageSquare },
    { path: '/explore', label: 'Explorer', active: isExplore, icon: Compass },
    { path: '/feed', label: 'Feed', active: isFeed, icon: Film, badge: storyBadge },
    { path: '/settings', label: 'Profil', active: isSettings, icon: User },
    { path: '/settings', label: 'Paramètres', active: isSettings, icon: Settings },
  ];

  const handleNav = (item: (typeof items)[0]) => {
    navigate(item.path);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="hamburger-overlay" onClick={onClose}>
      <div className="hamburger-panel" onClick={(e) => e.stopPropagation()}>
        <div className="hamburger-header">
          <MessageSquare size={20} color="var(--brand)" />
          <span>Menu</span>
        </div>
        <div className="hamburger-items">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={`hamburger-item${item.active ? ' active' : ''}`}
                onClick={() => handleNav(item)}
                aria-current={item.active ? 'page' : undefined}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.badge && <span className="hamburger-badge" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
