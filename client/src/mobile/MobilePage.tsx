import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { chevronBack } from 'ionicons/icons';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface MobilePageProps {
  title?: string;
  showBack?: boolean;
  rightSlot?: ReactNode;
  children: ReactNode;
  onRefresh?: () => Promise<void>;
}

export default function MobilePage({ title, showBack, rightSlot, children, onRefresh }: MobilePageProps) {
  const navigate = useNavigate();

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <IonContent className="mobile-page">
      {title && (
        <IonHeader className="ion-no-border">
          <IonToolbar>
            {showBack && (
              <IonButtons slot="start">
                <IonButton onClick={goBack} aria-label="Retour">
                  <IonIcon slot="icon-only" icon={chevronBack} />
                </IonButton>
              </IonButtons>
            )}
            <IonTitle>{title}</IonTitle>
            {rightSlot && <IonButtons slot="end">{rightSlot}</IonButtons>}
          </IonToolbar>
        </IonHeader>
      )}
      {children}
      {onRefresh && (
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (e) => {
            try {
              await onRefresh();
            } finally {
              e.detail.complete();
            }
          }}
        >
          <IonRefresherContent />
        </IonRefresher>
      )}
    </IonContent>
  );
}
