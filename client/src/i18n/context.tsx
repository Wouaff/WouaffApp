import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en } from './en';

export type Lang = 'fr' | 'en';

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  /** Traduit une chaîne française (source du code) vers la langue active. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'wouaff:lang';

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'fr' || stored === 'en') return stored;
  } catch {
    /* stockage indisponible */
  }
  try {
    const nav = (navigator.language || 'fr').toLowerCase();
    return nav.startsWith('fr') ? 'fr' : 'en';
  } catch {
    return 'fr';
  }
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* stockage indisponible */
    }
    document.documentElement.lang = lang === 'fr' ? 'fr' : 'en';
  }, [lang]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      if (lang === 'fr') return interpolate(key, vars);
      return interpolate(en[key] ?? key, vars);
    },
    [lang],
  );

  const setLang = useCallback((next: Lang) => setLangState(next), []);
  const toggleLang = useCallback(() => setLangState((prev) => (prev === 'fr' ? 'en' : 'fr')), []);

  const value = useMemo(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n doit être utilisé dans un LanguageProvider');
  }
  return ctx;
}
