import {
  Bell,
  Bookmark,
  ChevronLeft,
  Feather,
  Home,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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

export default function LeftNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t, lang, toggleLang } = useI18n();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('wouaff:leftnav-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [avatar, setAvatar] = useState('');
  const [myHandle, setMyHandle] = useState('');
  const [unread, setUnread] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem('wouaff:leftnav-collapsed', next ? '1' : '0');
      } catch {
        /* stockage indisponible */
      }
      return next;
    });
  };

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

  const handleNav = (path: string) => {
    if (path === '/profile') {
      navigate(myHandle ? `/@${myHandle.replace(/^@/, '')}` : '/settings');
      return;
    }
    navigate(path);
  };

  /* CTA "Poster" façon Twitter : focus le composer, en revenant sur l'accueil si besoin */
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

  const initial = (user?.pseudo || '?')[0]?.toUpperCase() || '?';

  return (
    <aside
      className={`hidden lg:flex flex-col flex-shrink-0 h-full border-r border-[var(--border)] bg-[var(--bg-base)] transition-all duration-300 ease-in-out ${
        collapsed ? 'w-[76px]' : 'w-[250px] xl:w-[270px]'
      }`}
    >
      <div className={`flex flex-col flex-1 overflow-y-auto py-3 ${collapsed ? 'px-2' : 'px-3'}`}>
        <div
          className={`flex mb-2 ${
            collapsed ? 'flex-col items-center gap-3' : 'items-center justify-between gap-2 pl-1 pr-0.5'
          }`}
        >
          <button
            className="flex items-center gap-2 rounded-full p-2 w-max cursor-pointer bg-transparent border-none"
            onClick={() => navigate('/')}
            aria-label={t("Retour à l'accueil")}
            title={t('Accueil')}
          >
            <img src="/assets/logo/logo.png" alt="Wouaff" className="w-8 h-8 rounded-lg flex-shrink-0" />
            {!collapsed && <span className="text-xl font-black text-[var(--text-primary)] tracking-tight">Wouaff</span>}
          </button>
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? t('Déployer le menu') : t('Réduire le menu')}
            title={collapsed ? t('Déployer le menu') : t('Réduire le menu')}
            className="w-7 h-7 flex items-center justify-center rounded-full cursor-pointer border-none bg-transparent text-[var(--text-muted)] hover:text-brand hover:bg-[var(--bg-hover)] hover:scale-110 active:scale-95 transition-all duration-200 flex-shrink-0"
          >
            <ChevronLeft
              size={18}
              className={`transition-transform duration-300 ease-in-out ${collapsed ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        <nav className="flex flex-col gap-1" aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            const badge = item.path === '/notifications' ? unread : item.path === '/messages' ? msgUnread : 0;
            return (
              <button
                key={item.label}
                className={`flex items-center rounded-full py-2.5 cursor-pointer transition-colors border-none bg-transparent ${
                  collapsed ? 'justify-center px-0' : 'gap-4 px-3 text-left'
                } text-[var(--text-primary)] ${item.soon ? 'opacity-60' : 'hover:bg-[var(--bg-hover)]'}`}
                onClick={() => {
                  if (item.soon) return;
                  handleNav(item.path);
                }}
                aria-current={active ? 'page' : undefined}
                title={item.soon ? `${t(item.label)}, ${t('bientôt disponible')}` : t(item.label)}
              >
                <span className="relative flex-shrink-0">
                  <Icon size={26} strokeWidth={active ? 2.6 : 2} />
                  {badge > 0 && (
                    <span
                      className={`absolute bg-brand text-white text-xss font-bold rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center ${
                        collapsed ? '-top-1.5 -right-2' : '-top-1 -right-2.5'
                      }`}
                    >
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                {!collapsed && (
                  <span className={`text-xl ${active ? 'font-extrabold' : 'font-medium'}`}>{t(item.label)}</span>
                )}
                {!collapsed && item.soon && (
                  <span className="ml-auto inline-flex items-center text-xss font-bold text-[var(--text-muted)] border border-[var(--border)] rounded-full px-2 py-0.5">
                    {t('Bientôt')}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={focusCompose}
          aria-label={t('Poster un nouveau message')}
          title={collapsed ? t('Poster') : undefined}
          className={`mt-4 flex items-center justify-center gap-2 rounded-full bg-brand text-white font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer border-none ${
            collapsed ? 'w-12 h-12 mx-auto' : 'w-full py-3 px-4 text-lg'
          }`}
        >
          <Feather size={20} />
          {!collapsed && <span>{t('Poster')}</span>}
        </button>

        <div className="mt-auto">
          {(user?.staffRole === 'owner' || user?.staffRole === 'moderator') &&
            (collapsed ? (
              <button
                onClick={() => navigate('/admin')}
                title={t('Administration')}
                aria-label={t("Panneau d'administration")}
                className="w-full flex items-center justify-center rounded-full p-2 cursor-pointer border-none bg-transparent hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-[var(--brand-glow)] flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={18} className="text-brand" />
                </div>
              </button>
            ) : (
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-3 rounded-full p-2.5 w-full cursor-pointer border-none bg-transparent hover:bg-[var(--bg-hover)] transition-colors text-left"
                aria-label={t("Panneau d'administration")}
              >
                <div className="w-9 h-9 rounded-full bg-[var(--brand-glow)] flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={18} className="text-brand" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-md font-bold text-[var(--text-primary)] truncate">{t('Administration')}</span>
                  <span className="text-xs text-[var(--text-muted)] truncate">
                    {user?.staffRole === 'owner' ? t('Propriétaire') : t('Modérateur')}
                  </span>
                </div>
              </button>
            ))}

          {collapsed ? (
            <a
              href="https://discord.com/invite/yUX9KbFsZ6"
              target="_blank"
              rel="noopener noreferrer"
              title="Discord"
              className="w-full flex items-center justify-center rounded-full p-2 no-underline cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
              aria-label={t('Rejoindre le serveur Discord')}
            >
              <div className="w-9 h-9 rounded-full bg-[#5865F2] flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="#fff" className="w-5 h-5">
                  <path d="M20.317 4.3698a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </div>
            </a>
          ) : (
            <a
              href="https://discord.com/invite/yUX9KbFsZ6"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-full p-2.5 w-full no-underline cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
              aria-label={t('Rejoindre le serveur Discord')}
            >
              <div className="w-9 h-9 rounded-full bg-[#5865F2] flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="#fff" className="w-5 h-5">
                  <path d="M20.317 4.3698a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0 text-left flex-1">
                <span className="text-md font-bold text-[var(--text-primary)] truncate">Discord</span>
                <span className="text-xs text-[var(--text-muted)] truncate">{t('Rejoindre la communauté')}</span>
              </div>
            </a>
          )}

          {/* Bascule de langue rapide */}
          {collapsed ? (
            <button
              type="button"
              onClick={toggleLang}
              aria-label={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
              title={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
              className="w-9 h-9 rounded-full flex items-center justify-center mx-auto mt-2 cursor-pointer border border-[var(--border)] bg-transparent text-[var(--text-muted)] font-bold text-xs hover:border-brand hover:text-brand transition-colors"
            >
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleLang}
              className="mt-2 flex items-center gap-3 rounded-full p-2.5 w-full cursor-pointer border border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:border-brand hover:text-brand transition-colors text-left"
              aria-label={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
            >
              <span className="text-md">{lang === 'fr' ? '🇬🇧' : '🇫🇷'}</span>
              <span className="text-md font-bold">{lang === 'fr' ? 'English' : 'Français'}</span>
            </button>
          )}

          <div className={collapsed ? 'flex flex-col items-center gap-2 mt-2' : 'mt-2 flex flex-col gap-1'}>
            <button
              className={`flex items-center gap-3 rounded-full w-full cursor-pointer border-none bg-transparent transition-colors hover:bg-[var(--bg-hover)] ${
                collapsed ? 'justify-center p-2' : 'p-2.5'
              }`}
              onClick={() => navigate('/settings')}
              aria-label={t('Profil et paramètres')}
              title={collapsed ? t('Profil et paramètres') : undefined}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-sm overflow-hidden flex-shrink-0">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={t('Avatar de {name}', { name: user?.pseudo || t('vous') })}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              {!collapsed && (
                <>
                  <div className="flex flex-col min-w-0 text-left flex-1">
                    <span className="text-md font-bold text-[var(--text-primary)] truncate">
                      {user?.pseudo || t('Utilisateur')}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] truncate">{myHandle || t('Paramètres')}</span>
                  </div>
                  <Settings size={18} className="text-[var(--text-muted)] flex-shrink-0" />
                </>
              )}
            </button>
            {!collapsed && (
              <button
                className="flex items-center gap-3 rounded-full p-2.5 w-full cursor-pointer border-none bg-transparent text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={logout}
                aria-label={t('Se déconnecter')}
                title={t('Se déconnecter')}
              >
                <LogOut size={18} />
                <span className="text-md font-bold">{t('Se déconnecter')}</span>
              </button>
            )}
            {collapsed && (
              <button
                className="w-9 h-9 rounded-full flex items-center justify-center mx-auto cursor-pointer border-none bg-transparent text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={logout}
                aria-label={t('Se déconnecter')}
                title={t('Se déconnecter')}
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
