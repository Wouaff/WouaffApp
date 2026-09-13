import {
  Bell,
  Bookmark,
  ChevronDown,
  Feather,
  Home,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n/context';
import { subscribeMessagesUnread } from '../../services/messagesUnread';
import { offNotificationNew, onNotificationNew } from '../../services/socket';

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
  soon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Accueil', icon: Home },
  { path: '/messages', label: 'Messages', icon: MessageSquare },
  { path: '/communities', label: 'Communautés', icon: Users },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/bookmarks', label: 'Signets', icon: Bookmark, soon: true },
  { path: '/profile', label: 'Profil', icon: User },
];

export default function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t, lang, toggleLang } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatar, setAvatar] = useState('');
  const [myHandle, setMyHandle] = useState('');
  const [unread, setUnread] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeMessagesUnread(setMsgUnread);
  }, []);

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

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const focusCompose = () => {
    if (location.pathname !== '/') {
      navigate('/');
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('wouaff:focus-compose')), 120);
    } else {
      window.dispatchEvent(new CustomEvent('wouaff:focus-compose'));
    }
  };

  const isActive = (item: NavItem) => {
    if (item.soon) return false;
    if (item.path === '/') return location.pathname === '/';
    if (item.path === '/profile') return location.pathname.startsWith('/@');
    return location.pathname.startsWith(item.path);
  };

  const openProfile = () => {
    navigate(myHandle ? `/@${myHandle.replace(/^@/, '')}` : '/settings');
    setMenuOpen(false);
  };

  const initial = (user?.pseudo || '?')[0]?.toUpperCase() || '?';
  const isStaff = user?.staffRole === 'owner' || user?.staffRole === 'moderator';

  return (
    <header className="topbar hidden lg:flex items-center gap-2 px-4 h-14 shrink-0 border-b border-[var(--border)] bg-[var(--bg-base)] sticky top-0 z-40">
      <button
        type="button"
        className="topbar-brand"
        onClick={() => navigate('/')}
        aria-label={t("Retour à l'accueil")}
        title={t('Accueil')}
      >
        <img src="/assets/logo/logo.png" alt="Wouaff" className="topbar-logo" />
        <span className="topbar-name">Wouaff</span>
      </button>

      <nav className="topnav" aria-label="Navigation principale">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          const badge = item.path === '/notifications' ? unread : item.path === '/messages' ? msgUnread : 0;
          return (
            <button
              key={item.label}
              type="button"
              className={`topnav-item${active ? ' is-active' : ''}${item.soon ? ' is-soon' : ''}`}
              onClick={() => {
                if (item.soon) return;
                navigate(
                  item.path === '/profile' ? (myHandle ? `/@${myHandle.replace(/^@/, '')}` : '/settings') : item.path,
                );
              }}
              aria-current={active ? 'page' : undefined}
              title={item.soon ? `${t(item.label)}, ${t('bientôt disponible')}` : t(item.label)}
            >
              <span className="topnav-icon">
                <Icon size={19} strokeWidth={active ? 2.6 : 2} />
                {badge > 0 && <span className="topnav-badge">{badge > 99 ? '99+' : badge}</span>}
              </span>
              <span className="topnav-label">{t(item.label)}</span>
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={focusCompose}
          className="topbar-compose"
          aria-label={t('Poster un nouveau message')}
        >
          <Feather size={18} />
          <span>{t('Poster')}</span>
        </button>

        {isStaff && (
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="topbar-icon-btn"
            title={t('Administration')}
            aria-label={t("Panneau d'administration")}
          >
            <ShieldCheck size={19} />
          </button>
        )}

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="topbar-user"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t('Profil et paramètres')}
          >
            <span className="topbar-avatar">
              {avatar ? (
                <img src={avatar} alt={t('Avatar de {name}', { name: user?.pseudo || t('vous') })} />
              ) : (
                <span>{initial}</span>
              )}
            </span>
            <ChevronDown size={15} className={`topbar-caret${menuOpen ? ' open' : ''}`} />
          </button>

          {menuOpen && (
            <div className="topbar-menu" role="menu">
              <div className="topbar-menu-head">
                <span className="topbar-avatar lg">
                  {avatar ? <img src={avatar} alt="" /> : <span>{initial}</span>}
                </span>
                <div className="min-w-0">
                  <div className="topbar-menu-name">{user?.pseudo || t('Utilisateur')}</div>
                  <div className="topbar-menu-handle">{myHandle || t('Paramètres')}</div>
                </div>
              </div>

              <button type="button" className="topbar-menu-item" role="menuitem" onClick={openProfile}>
                <User size={16} />
                {t('Profil')}
              </button>
              <button
                type="button"
                className="topbar-menu-item"
                role="menuitem"
                onClick={() => {
                  navigate('/settings');
                  setMenuOpen(false);
                }}
              >
                <Settings size={16} />
                {t('Profil et paramètres')}
              </button>
              {isStaff && (
                <button
                  type="button"
                  className="topbar-menu-item"
                  role="menuitem"
                  onClick={() => {
                    navigate('/admin');
                    setMenuOpen(false);
                  }}
                >
                  <ShieldCheck size={16} />
                  {t('Administration')}
                </button>
              )}
              <button
                type="button"
                className="topbar-menu-item"
                role="menuitem"
                onClick={() => {
                  toggleLang();
                  setMenuOpen(false);
                }}
              >
                <span className="topbar-menu-flag">{lang === 'fr' ? '🇬🇧' : '🇫🇷'}</span>
                {lang === 'fr' ? 'English' : 'Français'}
              </button>
              <a
                href="https://discord.com/invite/yUX9KbFsZ6"
                target="_blank"
                rel="noopener noreferrer"
                className="topbar-menu-item"
                role="menuitem"
              >
                <span className="topbar-menu-discord">
                  <svg viewBox="0 0 24 24" fill="#fff" className="w-4 h-4">
                    <path d="M20.317 4.3698a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                </span>
                Discord
              </a>
              <button
                type="button"
                className="topbar-menu-item danger"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
              >
                <LogOut size={16} />
                {t('Se déconnecter')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
