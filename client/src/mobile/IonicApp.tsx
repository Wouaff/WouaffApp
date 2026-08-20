import { IonApp } from '@ionic/react';
import type { ReactNode } from 'react';

export default function IonicApp({ className, children }: { className?: string; children: ReactNode }) {
  return <IonApp className={className}>{children}</IonApp>;
}
