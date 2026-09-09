import { useI18n } from './context';

type T = (key: string, vars?: Record<string, string | number>) => string;

/** Temps relatif (ex. « il y a 5 min » / « 5 min ago ») selon la langue active. */
export function formatTimeAgo(ts: number, t: T): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return t("à l'instant");
  if (m < 60) return t('il y a {n} min', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('il y a {n} h', { n: h });
  const d = Math.floor(h / 24);
  if (d === 1) return t('hier');
  return t('il y a {n} j', { n: d });
}

/** Hook : renvoie une fonction formatTimeAgo liée à la langue courante. */
export function useFormatTimeAgo(): (ts: number) => string {
  const { t } = useI18n();
  return (ts: number) => formatTimeAgo(ts, t);
}
