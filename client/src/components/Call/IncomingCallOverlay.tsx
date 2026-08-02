import { useCall } from '../../hooks/useCall';

export default function IncomingCallOverlay() {
  const { state, callerInfo, acceptCall, rejectCall } = useCall();

  if (state !== 'ringing' || !callerInfo) return null;

  const initial = callerInfo.pseudo[0]?.toUpperCase() || '?';

  return (
    <div className="call-overlay">
      <div className="call-overlay-card">
        <div className="call-overlay-avatar">
          {callerInfo.avatar ? (
            <img src={callerInfo.avatar} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="call-overlay-initial">{initial}</span>
          )}
        </div>
        <div className="call-overlay-name">{callerInfo.pseudo}</div>
        <div className="call-overlay-status">Appel entrant...</div>
        <div className="call-overlay-actions">
          <button type="button" className="call-overlay-btn call-overlay-btn-reject" onClick={rejectCall}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-label="Refuser l'appel">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
            </svg>
          </button>
          <button type="button" className="call-overlay-btn call-overlay-btn-accept" onClick={acceptCall}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-label="Accepter l'appel">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
