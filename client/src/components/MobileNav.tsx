import { Bell, Home, Search, Settings, ShieldCheck, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUnread } from '../hooks/useUnread';

/** Barre de navigation basse (mobile, < 768px). Remplace la colonne de gauche, masquée. */
export default function MobileNav() {
  const { user } = useAuth();
  const unread = useUnread(!!user);
  if (!user) return null;

  const items = [
    { to: '/', icon: Home, label: 'Accueil', badge: 0 },
    { to: '/explore', icon: Search, label: 'Explorer', badge: 0 },
    { to: '/notifications', icon: Bell, label: 'Notifs', badge: unread },
    { to: `/${user.pseudo}`, icon: User, label: 'Profil', badge: 0 },
    { to: '/settings', icon: Settings, label: 'Réglages', badge: 0 },
    ...(user.role === 'moderator' || user.role === 'admin'
      ? [{ to: '/admin', icon: ShieldCheck, label: 'Modération', badge: 0 }]
      : []),
  ];

  return (
    <nav
      aria-label="Navigation principale"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-[var(--border-color)] bg-[var(--bg-secondary)] pb-[env(safe-area-inset-bottom)]"
    >
      {items.map(({ to, icon: Icon, label, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-1 min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-[10px] transition-colors hover:no-underline ${
              isActive
                ? 'text-[var(--accent)] font-bold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className="relative">
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold flex items-center justify-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
              <span className="truncate max-w-full">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
