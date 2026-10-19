import { useEffect, useRef } from 'react';

const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || '';

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}

function loadScript(): Promise<void> {
  const w = window as unknown as { turnstile?: TurnstileApi };
  if (w.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Turnstile indisponible'));
    document.head.appendChild(s);
  });
}

export const captchaEnabled = SITE_KEY.length > 0;

/* Captcha Cloudflare Turnstile : n'affiche rien si VITE_TURNSTILE_SITE_KEY n'est pas défini. */
export default function Turnstile({
  onToken,
  onError,
}: {
  onToken: (token: string) => void;
  onError?: (m: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cbs = useRef({ onToken, onError });
  cbs.current = { onToken, onError };

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    let widgetId = '';
    loadScript()
      .then(() => {
        const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
        if (cancelled || !ref.current || !api) return;
        widgetId = api.render(ref.current, {
          sitekey: SITE_KEY,
          theme: 'auto',
          callback: (token: string) => cbs.current.onToken(token),
          'expired-callback': () => cbs.current.onToken(''),
          'error-callback': () => cbs.current.onError?.('Erreur du captcha'),
        });
      })
      .catch(() => cbs.current.onError?.('Impossible de charger le captcha'));
    return () => {
      cancelled = true;
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (widgetId && api) api.remove(widgetId);
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="flex justify-center" />;
}
