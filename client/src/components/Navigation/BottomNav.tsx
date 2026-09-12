import { Home, MessageSquare, User } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { subscribeMessagesUnread } from '../../services/messagesUnread';

const BottomNav = memo(function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [msgUnread, setMsgUnread] = useState(0);

  useEffect(() => {
    return subscribeMessagesUnread(setMsgUnread);
  }, []);

  const isHome = location.pathname === '/' || location.pathname === '';
  const isSettings = location.pathname === '/settings';
  const isMessages = location.pathname.startsWith('/messages');

  const items = [
    { path: '/', label: 'Accueil', active: isHome, icon: Home },
    { path: '/messages', label: 'Messages', active: isMessages, icon: MessageSquare, badge: msgUnread > 0 },
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
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${item.active ? 'text-[var(--brand)]' : 'text-[var(--text-muted)]'}`}
              aria-label={item.label}
              aria-current={item.active ? 'page' : undefined}
            >
              <div
                className={`relative flex items-center justify-center w-10 h-7 rounded-xl transition-colors ${
                  item.active ? 'bg-brand text-[var(--brand-ink)]' : ''
                }`}
              >
                <Icon size={20} />
                {item.badge && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 bg-[var(--danger)] rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                    {msgUnread > 0 ? (msgUnread > 9 ? '9+' : msgUnread) : ''}
                  </span>
                )}
              </div>
              <span className={`text-[10px] ${item.active ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

export default BottomNav;
