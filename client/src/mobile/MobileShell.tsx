import { IonApp, IonIcon, IonLabel, IonTabBar, IonTabButton } from '@ionic/react';
import { chatbubbles, home, notifications, person, videocam } from 'ionicons/icons';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { subscribeMessagesUnread } from '../services/messagesUnread';

const TABS = [
  { path: '/', label: 'Accueil', icon: home, match: (p: string) => p === '/' || p === '' },
  { path: '/messages', label: 'Messages', icon: chatbubbles, match: (p: string) => p.startsWith('/messages') },
  { path: '/feed', label: 'Feed', icon: videocam, match: (p: string) => p === '/feed' },
  { path: '/notifications', label: 'Notifications', icon: notifications, match: (p: string) => p === '/notifications' },
  { path: '/settings', label: 'Profil', icon: person, match: (p: string) => p === '/settings' },
];

/* Les écrans secondaires sont plein écran (sans barre d'onglets) */
const FULLSCREEN_PATHS: string[] = [];

export default function MobileShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [msgUnread, setMsgUnread] = useState(0);

  useEffect(() => {
    return subscribeMessagesUnread(setMsgUnread);
  }, []);

  const pathname = location.pathname;
  const showTabBar = !FULLSCREEN_PATHS.includes(pathname) && TABS.some((t) => t.match(pathname));

  const wrapStyle: CSSProperties = {
    height: '100%',
    width: '100%',
    paddingBottom: showTabBar ? 'var(--mobile-tab-h, 56px)' : 0,
  };

  return (
    <IonApp className="mobile-shell">
      <div className="h-full w-full" style={wrapStyle}>
        {children}
      </div>
      {showTabBar && (
        <IonTabBar slot="bottom">
          {TABS.map((t) => {
            const active = t.match(pathname);
            const badge = t.path === '/messages' ? msgUnread : 0;
            return (
              <IonTabButton key={t.path} tab={t.path} selected={active} onClick={() => navigate(t.path)}>
                <IonIcon aria-hidden="true" icon={t.icon} />
                <IonLabel>{t.label}</IonLabel>
                {badge > 0 && <span className="msg-tab-badge">{badge > 99 ? '99+' : badge}</span>}
                {active && <span className="is-active-dot" aria-hidden="true" />}
              </IonTabButton>
            );
          })}
        </IonTabBar>
      )}
    </IonApp>
  );
}
