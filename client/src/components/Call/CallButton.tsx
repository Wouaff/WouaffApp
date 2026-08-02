import { useCall } from '../../hooks/useCall';

interface CallButtonProps {
  targetUid: string;
  pseudo: string;
  avatar?: string;
}

export default function CallButton({ targetUid, pseudo, avatar }: CallButtonProps) {
  const { state, startCall } = useCall();

  if (state !== 'idle') return null;

  return (
    <button
      type="button"
      className="call-btn"
      onClick={() => startCall(targetUid, pseudo, avatar)}
      title={`Appeler ${pseudo}`}
      aria-label="Appeler"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-label={`Appeler ${pseudo}`}>
        <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
      </svg>
    </button>
  );
}
