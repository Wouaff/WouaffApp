import { IonApp, IonIcon, IonLabel, IonTabBar, IonTabButton } from '@ionic/react';
import { compass, home, person, videocam } from 'ionicons/icons';
import type { CSSProperties, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TABS = [
  { path: '/', label: 'Accueil', icon: home, match: (p: string) => p === '/' || p === '' },
  { path: '/explore', label: 'Explorer', icon: compass, match: (p: string) => p === '/explore' },
  { path: '/feed', label: 'Feed', icon: videocam, match: (p: string) => p === '/feed' },
  { path: '/settings', label: 'Profil', icon: person, match: (p: string) => p === '/settings' },
];

/* Les écrans secondaires sont plein écran (sans barre d'onglets) */
const FULLSCREEN_PATHS: string[] = [];

export default function MobileShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

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
          {TABS.map((t) => (
            <IonTabButton key={t.path} tab={t.path} selected={t.match(pathname)} onClick={() => navigate(t.path)}>
              <IonIcon aria-hidden="true" icon={t.icon} />
              <IonLabel>{t.label}</IonLabel>
            </IonTabButton>
          ))}
        </IonTabBar>
      )}
    </IonApp>
  );
}
