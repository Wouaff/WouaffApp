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
