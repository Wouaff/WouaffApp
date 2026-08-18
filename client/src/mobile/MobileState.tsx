import { IonButton, IonIcon, IonSkeletonText } from '@ionic/react';
import { cloudOffline } from 'ionicons/icons';
import type { ReactNode } from 'react';

export function MobileEmpty({ icon, title, text }: { icon: ReactNode; title: string; text?: string }) {
  return (
    <div className="mobile-state">
      {icon && <div className="mobile-state-icon">{icon}</div>}
      <p className="mobile-state-title">{title}</p>
      {text && <p className="mobile-state-text">{text}</p>}
    </div>
  );
}

export function MobileError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="mobile-state">
      <div className="mobile-state-icon">
        <IonIcon icon={cloudOffline} />
      </div>
      <p className="mobile-state-title">Oups, une erreur est survenue</p>
      {message && <p className="mobile-state-text">{message}</p>}
      {onRetry && (
        <IonButton size="small" fill="solid" onClick={onRetry} className="mobile-state-retry">
          Réessayer
        </IonButton>
      )}
    </div>
  );
}

export function MobileSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mobile-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rangées de skeleton statiques
        <div key={i} className="mobile-skeleton-card">
          <IonSkeletonText animated style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0 }} />
          <div className="min-w-0 flex-1">
            <IonSkeletonText animated style={{ width: '40%', height: '14px', marginBottom: '10px' }} />
            <IonSkeletonText animated style={{ width: '100%', height: '14px', marginBottom: '6px' }} />
            <IonSkeletonText animated style={{ width: '78%', height: '14px' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function VideoGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 px-4 pt-3">
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: tuiles de skeleton statiques
        <div key={i} className="mobile-skeleton-video">
          <IonSkeletonText animated style={{ width: '100%', height: '100%' }} />
        </div>
      ))}
    </div>
  );
}
