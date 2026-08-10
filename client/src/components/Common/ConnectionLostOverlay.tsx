import { RefreshCw, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { connectSocket, isConnected, offConnectionChange, onConnectionChange } from '../../services/socket';

export default function ConnectionLostOverlay() {
  const { user, loading } = useAuth();
  const [connected, setConnected] = useState(isConnected());

  useEffect(() => {
    if (!user) return;
    setConnected(isConnected());
    const cb = (v: boolean) => setConnected(v);
    onConnectionChange(cb);
    return () => offConnectionChange(cb);
  }, [user]);

  if (!user || loading || connected) return null;

  const retry = () => {
    try {
      connectSocket();
    } catch (e) {
      console.error('Reconnect failed', e);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] rounded-3xl px-8 py-10 text-center max-w-[360px] w-full border border-[var(--border)] shadow-[0_20px_60px_rgba(0,0,0,.45)] animate-scale-in">
        <div className="relative w-16 h-16 mx-auto mb-5">
          <span className="absolute inset-0 rounded-full bg-brand/30 animate-ping" />
          <span className="relative w-16 h-16 rounded-full bg-[var(--brand-glow)] flex items-center justify-center">
            <WifiOff size={26} className="text-brand" />
          </span>
        </div>

        <div className="text-xl font-extrabold mb-2 text-[var(--text-primary)]">Connexion perdue</div>
        <div className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Nous tentons de vous reconnecter automatiquement...
        </div>

        <button
          type="button"
          onClick={retry}
          className="mt-6 inline-flex items-center gap-2 bg-brand hover:opacity-90 transition-opacity text-white font-bold text-sm rounded-full px-6 py-2.5 border-none cursor-pointer"
        >
          <RefreshCw size={15} />
          Réessayer
        </button>
      </div>
    </div>
  );
}
