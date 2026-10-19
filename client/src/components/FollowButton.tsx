import { useState } from 'react';
import { api } from '../services/api';

interface FollowButtonProps {
  pseudo: string;
  initialFollowing?: boolean;
  size?: 'sm' | 'md';
  onChange?: (following: boolean) => void;
}

export default function FollowButton({ pseudo, initialFollowing = false, size = 'sm', onChange }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.post<{ following: boolean }>(`/follows/${pseudo}`);
      setFollowing(res.following);
      onChange?.(res.following);
    } catch {
      /* l'état reste inchangé si la requête échoue */
    }
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`rounded-full font-bold transition-colors border disabled:opacity-60 ${
        size === 'md' ? 'px-5 py-2' : 'px-4 py-1.5 text-sm'
      } ${
        following
          ? 'border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--danger)] hover:text-[var(--danger)]'
          : 'border-transparent bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
      }`}
    >
      {following ? 'Abonné' : "S'abonner"}
    </button>
  );
}
