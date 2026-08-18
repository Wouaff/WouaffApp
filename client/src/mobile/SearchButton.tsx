import { IonButton, IonIcon } from '@ionic/react';
import { search } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';

export default function SearchButton({ ariaLabel = 'Rechercher' }: { ariaLabel?: string }) {
  const navigate = useNavigate();
  return (
    <IonButton onClick={() => navigate('/search')} aria-label={ariaLabel}>
      <IonIcon slot="icon-only" icon={search} />
    </IonButton>
  );
}
