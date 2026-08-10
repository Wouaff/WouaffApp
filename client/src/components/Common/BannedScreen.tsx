import { Ban } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function BannedScreen() {
  const { logout } = useAuth();
  const [leaving, setLeaving] = useState(false);

  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await logout();
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="banned-screen">
      <div className="banned-card">
        <div className="banned-icon">
          <Ban size={40} />
        </div>
        <h1 className="banned-title">Compte banni</h1>
        <p className="banned-text">
          Votre compte a été banni de Wouaff pour non-respect des règles de la plateforme. Si vous pensez qu'il s'agit
          d'une erreur, contactez l'équipe de modération.
        </p>
        <button className="banned-btn" type="button" onClick={leave}>
          {leaving ? 'Déconnexion...' : 'Se déconnecter'}
        </button>
      </div>
    </div>
  );
}
