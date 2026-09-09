import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/context';

const STORAGE_KEY = 'wouaff_opensource_dismissed';

export default function OpenSourceBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function handleClose() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center">
      <div
        className="bg-[var(--bg-card)] rounded-2xl p-6 max-w-[400px] w-[90%] border border-[var(--border)] shadow-[0_8px_32px_rgba(0,0,0,.4)]"
        role="dialog"
        aria-label="Annonce open source WouaffApp"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-3">{t('WouaffApp est maintenant open source !')}</h2>
        <p className="text-sm leading-relaxed mb-3">
          {t(
            'Nous sommes ravis de vous annoncer que le code source de WouaffApp est désormais ouvert à toutes et à tous sur',
          )}{' '}
          <a
            href="https://github.com/youtsuhodev/WouaffApp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            GitHub
          </a>
          .
        </p>
        <p className="text-sm leading-relaxed mb-3">
          {t(
            'Vous pouvez explorer le code, nous signaler des bugs via les <strong>Issues</strong>, et même proposer vos propres améliorations en créant des <strong>Pull Requests</strong>.',
          )}
        </p>
        <p className="text-sm leading-relaxed mb-4">
          {t("Chaque contribution, aussi petite soit-elle, est la bienvenue. Merci de faire partie de l'aventure !")}
        </p>
        <button
          type="button"
          onClick={handleClose}
          className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
        >
          {t('Compris !')}
        </button>
      </div>
    </div>
  );
}
