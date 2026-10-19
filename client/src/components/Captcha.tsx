import { useEffect, useRef, useState } from 'react';

/* Captcha Cap (auto-hébergé) : le serveur Wouaff relaie le défi sur /api/captcha/. Le calcul se fait dans le
   navigateur (WebAssembly) ; aucune ressource externe n'est chargée. */

let configPromise: Promise<boolean> | null = null;

function loadConfig(): Promise<boolean> {
  if (!configPromise) {
    configPromise = fetch('/api/captcha/config', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d: { enabled?: boolean }) => d.enabled === true)
      .catch(() => {
        configPromise = null;
        return false;
      });
  }
  return configPromise;
}

/** `null` tant que l'on ne sait pas si le serveur exige un captcha. */
export function useCaptchaEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    loadConfig().then((v) => alive && setEnabled(v));
    return () => {
      alive = false;
    };
  }, []);
  return enabled;
}

async function loadWidget(): Promise<void> {
  /* Les URLs des modules WebAssembly doivent être posées AVANT le chargement du widget, sinon il va les
     chercher sur un CDN public (bloqué par la CSP, et contraire à l'hébergement souverain). */
  const [wasm, hashwx] = await Promise.all([
    import('@cap.js/wasm/browser/cap_wasm_bg.wasm?url'),
    import('@cap.js/wasm/browser/hashwx.wasm?url'),
  ]);
  const w = window as unknown as { CAP_CUSTOM_WASM_URL?: string; CAP_CUSTOM_HASHWX_URL?: string };
  w.CAP_CUSTOM_WASM_URL = wasm.default;
  w.CAP_CUSTOM_HASHWX_URL = hashwx.default;
  await import('cap-widget');
}

interface CaptchaProps {
  onToken: (token: string) => void;
  onError?: (message: string) => void;
}

/* N'affiche rien si le captcha n'est pas configuré côté serveur. Pour obtenir un nouveau jeton (un jeton ne
   sert qu'une fois), le parent change la `key` du composant. */
export default function Captcha({ onToken, onError }: CaptchaProps) {
  const enabled = useCaptchaEnabled();
  const ref = useRef<HTMLDivElement>(null);
  const cbs = useRef({ onToken, onError });
  cbs.current = { onToken, onError };

  useEffect(() => {
    if (!enabled) return;
    const host = ref.current;
    if (!host) return;
    let cancelled = false;
    loadWidget()
      .then(() => {
        if (cancelled) return;
        const el = document.createElement('cap-widget');
        el.setAttribute('data-cap-api-endpoint', '/api/captcha/');
        el.setAttribute('data-cap-i18n-initial-state', 'Je ne suis pas un robot');
        el.setAttribute('data-cap-i18n-verifying-label', 'Vérification…');
        el.setAttribute('data-cap-i18n-solved-label', 'Vérifié');
        el.setAttribute('data-cap-i18n-error-label', 'Erreur, réessaie');
        el.addEventListener('solve', (e) => cbs.current.onToken((e as CustomEvent<{ token: string }>).detail.token));
        el.addEventListener('reset', () => cbs.current.onToken(''));
        el.addEventListener('error', () => cbs.current.onError?.('Erreur du captcha'));
        host.replaceChildren(el);
      })
      .catch(() => cbs.current.onError?.('Impossible de charger le captcha'));
    return () => {
      cancelled = true;
      host.replaceChildren();
    };
  }, [enabled]);

  if (!enabled) return null;
  return <div ref={ref} className="flex justify-center" />;
}
