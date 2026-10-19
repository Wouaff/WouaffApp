import { Feather } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import ComposeModal from './ComposeModal';
import RightSidebar from './RightSidebar';
import Sidebar from './Sidebar';

interface AppShellProps {
  children: ReactNode;
  /* Appelé après un post publié depuis la fenêtre de rédaction (pour rafraîchir la page). */
  onPosted?: () => void;
}

/** Mise en page commune : colonne de gauche, colonne centrale, colonne de droite, rédaction. */
export default function AppShell({ children, onPosted }: AppShellProps) {
  const { user } = useAuth();
  const [showCompose, setShowCompose] = useState(false);
  const [resent, setResent] = useState<'idle' | 'sent' | 'error'>('idle');

  const resend = async () => {
    try {
      await api.post('/auth/resend-verification');
      setResent('sent');
    } catch {
      setResent('error');
    }
  };

  return (
    <div className="flex min-h-screen justify-center pb-16 md:pb-0">
      <Sidebar onCompose={() => setShowCompose(true)} />

      <main className="flex-1 min-w-0 border-r border-[var(--border-color)] max-w-[600px] bg-[var(--bg-secondary)]">
        {user && !user.emailVerified && user.mailEnabled && (
          <div className="px-4 py-2.5 text-sm bg-[var(--accent)]/10 border-b border-[var(--border-color)] flex items-center justify-between gap-3">
            <span className="text-[var(--text-primary)]">
              Confirme ton adresse e-mail : un lien t'a été envoyé à <strong>{user.email}</strong>.
            </span>
            <button
              type="button"
              onClick={resend}
              disabled={resent === 'sent'}
              className="font-bold text-[var(--accent)] whitespace-nowrap disabled:opacity-60"
            >
              {resent === 'sent' ? 'Envoyé' : resent === 'error' ? 'Réessayer' : 'Renvoyer'}
            </button>
          </div>
        )}
        {user?.status === 'suspended' && (
          <div
            role="alert"
            className="px-4 py-2.5 text-sm bg-[var(--danger)]/10 border-b border-[var(--border-color)] text-[var(--text-primary)]"
          >
            Ton compte est suspendu
            {user.suspendedUntil ? ` jusqu'au ${new Date(user.suspendedUntil).toLocaleDateString('fr-FR')}` : ''}
            {user.statusReason ? ` (${user.statusReason})` : ''} : tu peux lire mais pas publier.
          </div>
        )}
        {children}
      </main>

      <RightSidebar />

      <button
        type="button"
        onClick={() => setShowCompose(true)}
        aria-label="Nouveau post"
        className="md:hidden fixed right-4 bottom-20 z-40 w-14 h-14 rounded-full bg-[var(--accent)] text-white shadow-lg flex items-center justify-center"
      >
        <Feather className="w-6 h-6" />
      </button>

      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} onPosted={() => onPosted?.()} />}
    </div>
  );
}
