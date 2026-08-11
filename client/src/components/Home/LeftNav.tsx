import { Bell, Bookmark, Compass, Film, Home, MessageSquare, Settings, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { offNotificationNew, onNotificationNew } from '../../services/socket';

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
  soon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Accueil', icon: Home },
  { path: '/explore', label: 'Explorer', icon: Compass },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/chat', label: 'Messages', icon: MessageSquare },
  { path: '/feed', label: 'Feed', icon: Film },
  { path: '/bookmarks', label: 'Signets', icon: Bookmark, soon: true },
  { path: '/profile', label: 'Profil', icon: User },
];

function focusCompose() {
  window.dispatchEvent(new CustomEvent('wouaff:focus-compose'));
}

export default function LeftNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [avatar, setAvatar] = useState('');
  const [myHandle, setMyHandle] = useState('');
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch('/api/notifications/unread-count')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.count === 'number') setUnread(d.count);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onUnread = (e: Event) => {
      const { count } = (e as CustomEvent<{ count: number }>).detail;
      if (typeof count === 'number') setUnread(count);
    };
    const onNew = () => setUnread((u) => u + 1);
    window.addEventListener('wouaff:unread-count', onUnread);
    onNotificationNew(onNew);
    return () => {
      window.removeEventListener('wouaff:unread-count', onUnread);
      offNotificationNew(onNew);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/profiles/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((profile) => {
        if (cancelled || !profile) return;
        setAvatar((profile.avatar as string) || '');
        const wouaffId = (profile.wouaffId as string) || '';
        setMyHandle(wouaffId.startsWith('@') ? wouaffId : wouaffId ? `@${wouaffId}` : '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNav = (path: string) => {
    if (path === '/profile') {
      navigate(myHandle ? `/@${myHandle.replace(/^@/, '')}` : '/settings');
      return;
    }
    navigate(path);
  };

  const isActive = (item: NavItem) => {
    if (item.soon) return false;
    if (item.path === '/') return location.pathname === '/';
    if (item.path === '/profile') return location.pathname.startsWith('/@');
    return location.pathname.startsWith(item.path);
  };

  const initial = (user?.pseudo || '?')[0]?.toUpperCase() || '?';

  return (
    <aside className="hidden lg:flex flex-col flex-shrink-0 h-full w-[250px] xl:w-[270px] border-r border-[var(--border)] bg-[var(--bg-base)]">
      <div className="flex flex-col flex-1 overflow-y-auto px-3 py-3">
        <button
          className="flex items-center gap-2 rounded-full p-2 mb-2 w-max cursor-pointer bg-transparent border-none"
          onClick={() => navigate('/')}
          aria-label="Retour à l'accueil"
        >
          <img src="/assets/logo/logo.png" alt="Wouaff" className="w-8 h-8 rounded-lg" />
          <span className="text-[19px] font-black text-[var(--text-primary)] tracking-tight">Wouaff</span>
        </button>

        <nav className="flex flex-col gap-1" aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <button
                key={item.label}
                className={`flex items-center gap-4 rounded-full px-3 py-2.5 text-left cursor-pointer transition-colors border-none bg-transparent ${
                  active ? 'text-brand' : 'text-[var(--text-primary)]'
                } ${item.soon ? 'opacity-60' : 'hover:bg-[var(--bg-hover)]'}`}
                onClick={() => {
                  if (item.soon) return;
                  handleNav(item.path);
                }}
                aria-current={active ? 'page' : undefined}
                title={item.soon ? `${item.label} — bientôt disponible` : item.label}
              >
                <Icon size={24} strokeWidth={active ? 2.4 : 2} />
                <span className={`text-[17px] ${active ? 'font-extrabold' : 'font-medium'}`}>{item.label}</span>
                {item.path === '/notifications' && unread > 0 && (
                  <span className="ml-auto bg-brand text-white text-[11px] font-bold rounded-full min-w-[18px] h-[18px] px-1.5 flex items-center justify-center">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
                {item.soon && (
                  <span className="ml-auto text-[10px] font-bold text-[var(--text-muted)] border border-[var(--border)] rounded-full px-2 py-0.5">
                    Bientôt
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <button
          className="mt-4 w-full bg-brand hover:opacity-90 transition-opacity text-white font-bold text-[15px] rounded-full py-3 border-none cursor-pointer"
          onClick={focusCompose}
        >
          Poster
        </button>

        <div className="mt-auto">
          <a
            href="https://discord.com/invite/yUX9KbFsZ6"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-full p-2.5 w-full no-underline cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
            aria-label="Rejoindre le serveur Discord"
          >
            <div className="w-9 h-9 rounded-full bg-[#5865F2] flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="#fff" className="w-5 h-5">
                <path d="M20.317 4.3698a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </div>
            <div className="flex flex-col min-w-0 text-left flex-1">
              <span className="text-[15px] font-bold text-[var(--text-primary)] truncate">Discord</span>
              <span className="text-xs text-[var(--text-muted)] truncate">Rejoindre la communauté</span>
            </div>
          </a>

          <button
            className="flex items-center gap-3 rounded-full p-2.5 w-full cursor-pointer border-none bg-transparent hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => navigate('/settings')}
            aria-label="Profil et paramètres"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-sm overflow-hidden flex-shrink-0">
              {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <span>{initial}</span>}
            </div>
            <div className="flex flex-col min-w-0 text-left flex-1">
              <span className="text-[15px] font-bold text-[var(--text-primary)] truncate">
                {user?.pseudo || 'Utilisateur'}
              </span>
              <span className="text-xs text-[var(--text-muted)] truncate">Paramètres</span>
            </div>
            <Settings size={18} className="text-[var(--text-muted)] flex-shrink-0" />
          </button>
        </div>
      </div>
    </aside>
  );
}
