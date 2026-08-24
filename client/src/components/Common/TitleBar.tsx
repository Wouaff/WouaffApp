import { useEffect, useState } from 'react';

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const api = window.electronAPI;

  useEffect(() => {
    if (!api) return;
    api.isMaximized().then(setMaximized);
    const cleanup = api.onMaximizeChange(setMaximized);
    return cleanup;
  }, []);

  if (!api) return null;

  return (
    <div id="titlebar" className="flex items-center justify-between h-9 bg-[var(--bg-deep)] select-none shrink-0 px-4">
      <div className="flex items-center gap-2 text-xs font-bold text-text-secondary">
        <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-4 h-4" />
        Wouaff
      </div>
      <div className="flex">
        <button className="titlebar-btn" onClick={api.minimize} aria-label="Minimiser">
          <svg viewBox="0 0 12 12" className="w-3 h-3">
            <rect x="1" y="5.5" width="10" height="1" rx="0.5" />
          </svg>
        </button>
        <button className="titlebar-btn" onClick={api.maximize} aria-label="Maximiser">
          {maximized ? (
            <svg viewBox="0 0 12 12" className="w-3 h-3">
              <rect x="2" y="2.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" />
              <rect x="3" y="1.5" width="7" height="7" rx="1" fill="var(--bg-card)" stroke="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" className="w-3 h-3">
              <rect x="1.5" y="2" width="9" height="8" rx="1" fill="none" stroke="currentColor" />
            </svg>
          )}
        </button>
        <button className="titlebar-btn close" onClick={api.close} aria-label="Fermer">
          <svg viewBox="0 0 12 12" className="w-3 h-3">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
