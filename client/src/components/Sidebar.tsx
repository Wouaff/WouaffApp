import { Bell, Feather, Home, LogOut, Search, Settings, ShieldCheck, User } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUnread } from '../hooks/useUnread';
import Avatar from './Avatar';

export default function Sidebar({ onCompose }: { onCompose: () => void }) {
  const { user, logout } = useAuth();
  const unread = useUnread(!!user);

  const navItems = [
    { to: '/', icon: Home, label: 'Accueil' },
    { to: '/explore', icon: Search, label: 'Explorer' },
    { to: '/notifications', icon: Bell, label: 'Notifications', badge: unread },
    { to: `/${user?.pseudo}`, icon: User, label: 'Profil' },
    { to: '/settings', icon: Settings, label: 'Paramètres' },
    ...(user?.role === 'moderator' || user?.role === 'admin'
      ? [{ to: '/admin', icon: ShieldCheck, label: 'Modération', badge: 0 }]
      : []),
  ];

  return (
    /* Sous 768px la colonne de gauche laisse la place à la barre de navigation basse. */
    <aside className="hidden md:flex w-[275px] h-screen flex-col justify-between border-r border-[var(--border-color)] px-4 py-3 sticky top-0 overflow-y-auto">
      <div>
        <div className="flex items-center gap-2 px-3 py-3 mb-1">
          <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-8 h-8 rounded-lg" />
          <span className="text-xl font-black text-[var(--text-primary)]">Wouaff</span>
        </div>

        <nav aria-label="Navigation principale" className="flex flex-col gap-1">
          {navItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-5 px-3 py-3 rounded-full text-lg transition-colors hover:no-underline ${
                  isActive
                    ? 'font-bold text-[var(--text-primary)] bg-[var(--accent)]/10'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <Icon className={`w-6 h-6 ${isActive ? 'text-[var(--accent)]' : ''}`} />
                    {!!badge && (
                      <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent)] text-white text-[11px] font-bold flex items-center justify-center">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={onCompose}
          className="mt-4 w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold rounded-full py-3 flex items-center justify-center gap-2 transition-colors"
        >
          <Feather className="w-5 h-5" />
          Publier
        </button>
      </div>

      <div className="pb-1">
        <div className="flex items-center gap-3 px-3 py-3 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors">
          <Link to={`/${user?.pseudo}`} className="flex items-center gap-3 flex-1 min-w-0 hover:no-underline">
            <Avatar src={user?.avatar} name={user?.pseudo} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-[var(--text-primary)] truncate">
                {user?.displayName || user?.pseudo}
              </div>
              <div className="text-sm text-[var(--text-secondary)] truncate">@{user?.pseudo}</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={logout}
            title="Se déconnecter"
            aria-label="Se déconnecter"
            className="p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex-shrink-0"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <nav
          aria-label="Informations légales"
          className="mt-3 px-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]"
        >
          <Link to="/legal/conditions" className="text-[var(--text-secondary)]">
            Conditions
          </Link>
          <Link to="/legal/confidentialite" className="text-[var(--text-secondary)]">
            Confidentialité
          </Link>
          <Link to="/legal/regles" className="text-[var(--text-secondary)]">
            Règles
          </Link>
          <Link to="/legal/a-propos" className="text-[var(--text-secondary)]">
            À propos
          </Link>
        </nav>
        <div className="mt-2 px-3 text-xs text-[var(--text-secondary)]">
          © 2026 Wouaff. Pas de revente de données. Pas de pub.
        </div>
      </div>
    </aside>
  );
}
