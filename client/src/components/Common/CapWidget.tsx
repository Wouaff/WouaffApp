import { useEffect, useRef } from 'react';

const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
const CAP_WIDGET_URL = env.VITE_CAP_WIDGET_URL || 'https://cdn.jsdelivr.net/npm/cap-widget@latest';
const CAP_API_ENDPOINT = env.VITE_CAP_API_ENDPOINT || '';

interface CapWidgetProps {
  onToken: (token: string) => void;
  onError?: (message: string) => void;
}

function loadWidgetScript(): Promise<void> {
  if (customElements.get('cap-widget')) return Promise.resolve();
  const existing = document.querySelector('script[data-cap-widget]');
  if (existing) {
    return new Promise((resolve) => {
      const check = () => {
        if (customElements.get('cap-widget')) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = CAP_WIDGET_URL;
    s.type = 'module';
    s.dataset.capWidget = 'true';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

export default function CapWidget({ onToken, onError }: CapWidgetProps) {
  const hostRef = useRef<HTMLElement | null>(null);
  const tokenRef = useRef(onToken);
  const errorRef = useRef(onError);
  tokenRef.current = onToken;
  errorRef.current = onError;

  useEffect(() => {
    if (!CAP_API_ENDPOINT) return;
    let cancelled = false;
    loadWidgetScript().then(() => {
      if (cancelled) return;
      const el = hostRef.current;
      if (!el) return;
      const handleSolve = (e: Event) => {
        const detail = (e as CustomEvent<{ token?: string }>).detail;
        if (detail?.token) tokenRef.current(detail.token);
      };
      const handleError = (e: Event) => {
        const detail = (e as CustomEvent<{ message?: string }>).detail;
        if (detail?.message) errorRef.current?.(detail.message);
      };
      el.addEventListener('solve', handleSolve);
      el.addEventListener('error', handleError);
      return () => {
        el.removeEventListener('solve', handleSolve);
        el.removeEventListener('error', handleError);
      };
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!CAP_API_ENDPOINT) return null;

  return (
    <>
      {/* aligne le widget avec la DA (thème sombre Wouaff) */}
      <style>{`
        cap-widget {
          --cap-background: var(--bg-card, #1c2333);
          --cap-border-color: var(--border, #2a3448);
          --cap-color: var(--text-primary, #e8ecf0);
          --cap-checkbox-background: var(--bg-input, #111827);
          --cap-checkbox-border: 1px solid var(--border, #2a3448);
          --cap-spinner-color: var(--brand, #f97b3b);
        }
      `}</style>
      <cap-widget
        ref={hostRef as React.RefObject<HTMLElement>}
        data-cap-api-endpoint={CAP_API_ENDPOINT}
        data-cap-disable-haptics
        data-cap-i18n-initial-state="Confirmez que vous êtes humain"
        data-cap-i18n-verifying-label="Vérification..."
        data-cap-i18n-solved-label="Vous êtes humain"
        data-cap-i18n-error-label="Erreur"
        data-cap-i18n-troubleshooting-label="Dépannage"
        data-cap-i18n-required-label="Veuillez confirmer que vous êtes humain"
      />
    </>
  );
}
