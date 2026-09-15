import { Bell, Feather, Home, MoreHorizontal, Search, Settings, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Sidebar({ onCompose }: { onCompose: () => void }) {
  const { user, logout } = useAuth();

  const navItems = [
    { to: '/', icon: Home, label: 'Feed' },
    { to: '/explore', icon: Search, label: 'Explore' },
    { to: '/notifications', icon: Bell, label: 'Notifications' },
    { to: `/${user?.pseudo}`, icon: User, label: 'Profile' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    /* Sous 768px la colonne de gauche laisse la place à la barre de navigation basse. */
    <aside className="hidden md:flex w-[275px] h-screen flex-col justify-between border-r border-[var(--border-color)] px-4 py-3 sticky top-0 overflow-y-auto">
      <div>
        <div className="flex items-center gap-2 px-3 py-3 mb-1">
          <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-8 h-8 rounded-lg" />
          <span className="text-xl font-black text-[var(--text-primary)]">Wouaff</span>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-5 px-3 py-3 rounded-full text-lg transition-colors ${
                  isActive
                    ? 'font-bold text-[var(--text-primary)] bg-[var(--accent)]/10'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-6 h-6 ${isActive ? 'text-[var(--accent)]' : ''}`} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={onCompose}
          className="mt-4 w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold rounded-full py-3 flex items-center justify-center gap-2 transition-colors"
        >
          <Feather className="w-5 h-5" />
          Post
        </button>
      </div>

      {/* Bloc du bas groupé : compte, liens et copyright collent au bas de la colonne. */}
      <div className="pb-1">
        <div className="flex items-center gap-3 px-3 py-3 rounded-full hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-sm font-bold text-[var(--text-primary)] overflow-hidden">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              (user?.pseudo || '?')[0].toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-[var(--text-primary)] truncate">
              {user?.displayName || user?.pseudo}
            </div>
            <div className="text-sm text-[var(--text-secondary)] truncate">@{user?.pseudo}</div>
          </div>
          <button
            onClick={logout}
            title="Log out"
            aria-label="Log out"
            className="p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex-shrink-0"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 px-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
          <span>Terms</span>
          <span>·</span>
          <span>Privacy</span>
          <span>·</span>
          <span>Rules</span>
          <span>·</span>
          <span>About</span>
        </div>
        <div className="mt-2 px-3 text-xs text-[var(--text-secondary)]">© 2026 Wouaff. No data resale. No ads.</div>
      </div>
    </aside>
  );
}
