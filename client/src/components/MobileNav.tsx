import { Bell, Home, Search, Settings, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/** Barre de navigation basse (mobile, < 768px). Remplace la colonne de gauche, masquée. */
export default function MobileNav() {
  const { user } = useAuth();
  if (!user) return null;

  const items = [
    { to: '/', icon: Home, label: 'Feed' },
    { to: '/explore', icon: Search, label: 'Explore' },
    { to: '/notifications', icon: Bell, label: 'Notifications' },
    { to: `/${user.pseudo}`, icon: User, label: 'Profile' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav
      aria-label="Main navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-[var(--border-color)] bg-[var(--bg-secondary)] pb-[env(safe-area-inset-bottom)]"
    >
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-1 min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-[10px] transition-colors ${
              isActive
                ? 'text-[var(--accent)] font-bold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className="truncate max-w-full">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
