declare global {
  interface Window {
    _paq?: unknown[];
  }
}

const CONSENT_KEY = 'wouaff_cookie_consent';

export type CookieConsent = 'accepted' | 'refused' | null;

export function getCookieConsent(): CookieConsent {
  const v = localStorage.getItem(CONSENT_KEY);
  return v === 'accepted' || v === 'refused' ? v : null;
}

export function setCookieConsent(value: 'accepted' | 'refused'): void {
  localStorage.setItem(CONSENT_KEY, value);
}

/* Matomo, auto-hébergeable. Ne charge rien si les variables d'env sont absentes
   ou si l'utilisateur a refusé. Les URLs viennent du build (VITE_MATOMO_URL),
   jamais de code en dur. */
export function initAnalytics(): void {
  if (getCookieConsent() !== 'accepted') return;
  const url = import.meta.env.VITE_MATOMO_URL as string | undefined;
  const siteId = import.meta.env.VITE_MATOMO_SITE_ID as string | undefined;
  if (!url || !siteId) return;
  const base = url.replace(/\/+$/, '');
  if (!window._paq) window._paq = [];
  const paq = window._paq;
  paq.push(['trackPageView']);
  paq.push(['enableLinkTracking']);
  paq.push(['setTrackerUrl', `${base}/matomo.php`]);
  paq.push(['setSiteId', siteId]);
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.src = `${base}/matomo.js`;
  const first = document.getElementsByTagName('script')[0];
  first?.parentNode?.insertBefore(script, first);
}
