import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/context';

const STORAGE_KEY = 'wouaff_pwa_install_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: minimal-ui)').matches);

export default function PwaInstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(STORAGE_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
      localStorage.setItem(STORAGE_KEY, '1');
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9990] w-[calc(100%-2rem)] max-w-[420px]">
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-3 shadow-[0_8px_32px_rgba(0,0,0,.4)]">
        <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-11 h-11 rounded-xl flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[13px] font-bold text-[var(--text-primary)]">{t('Installe Wouaff')}</p>
          <p className="m-0 text-[12px] text-[var(--text-secondary)] truncate">
            {t('Ton app, hors navigateur, accessible même hors-ligne.')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleInstall}
          className="flex items-center gap-1.5 flex-shrink-0 rounded-full bg-brand hover:opacity-90 transition-opacity text-[var(--brand-ink)] text-[13px] font-bold px-4 py-2 border-none cursor-pointer"
        >
          <Download size={15} />
          {t('Installer')}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('Fermer')}
          className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors bg-transparent border-none cursor-pointer rounded-full p-1"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
