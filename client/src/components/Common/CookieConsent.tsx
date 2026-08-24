import { useEffect, useState } from 'react';
import { getCookieConsent, initAnalytics, setCookieConsent } from '../../utils/analytics';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getCookieConsent()) {
      setVisible(true);
    } else {
      initAnalytics();
    }
  }, []);

  const accept = () => {
    setCookieConsent('accepted');
    setVisible(false);
    initAnalytics();
  };

  const refuse = () => {
    setCookieConsent('refused');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9998] border-t border-[var(--border)] bg-[var(--bg-deep)] p-4"
      role="dialog"
      aria-label="Choix des cookies"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="m-0 text-[13px] leading-relaxed text-[var(--text-muted)]">
          Wouaff n'utilise qu'un cookie de session, strictement nécessaire à la connexion. Aucun cookie de tracking
          n'est déposé sans votre accord.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={refuse}
            className="rounded-full border border-[var(--border)] bg-transparent px-4 py-2 text-[13px] font-bold text-[var(--text-muted)] cursor-pointer hover:border-[var(--border-light)] transition-colors"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-full bg-brand px-4 py-2 text-[13px] font-bold text-white border-none cursor-pointer transition-colors"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
