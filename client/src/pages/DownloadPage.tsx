import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const VERSION = '1.0.0';
const DOWNLOADS: Array<{ platform: string; label: string; arch: string; url: string; icon: string }> = [
  {
    platform: 'Windows',
    label: 'Windows 10 / 11',
    arch: 'x64',
    url: `https://wouaff.app/downloads/Wouaff-Setup-${VERSION}-win-x64.exe`,
    icon: 'M4 2h7v9H2V4c0-1.1.9-2 2-2zm0 13h7v7H4c-1.1 0-2-.9-2-2v-5zm9-13h7c1.1 0 2 .9 2 2v5h-9V2zm7 9v7c0 1.1-.9 2-2 2h-7v-9h9z',
  },
  {
    platform: 'Linux',
    label: 'Ubuntu / Debian / Fedora',
    arch: 'x86_64',
    url: `https://wouaff.app/downloads/Wouaff-Setup-${VERSION}-linux-x86_64.AppImage`,
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  },
  {
    platform: 'macOS',
    label: 'macOS 12+',
    arch: 'x64 / arm64',
    url: `https://wouaff.app/downloads/Wouaff-Setup-${VERSION}-mac-x64.dmg`,
    icon: 'M21.5 15a10.3 10.3 0 01-2.3 3.9c-.9 1-1.8 1.8-3 1.8-.5 0-1-.2-1.6-.4-.5-.2-1-.4-1.6-.4s-1 .2-1.5.4c-.6.2-1.1.4-1.6.4-1.1 0-2.1-.8-3-1.8A10.3 10.3 0 012.5 15a9.5 9.5 0 01-.5-3.1 5.5 5.5 0 011.4-3.7 3.5 3.5 0 012-1.2c.5 0 1.1.1 1.7.3.6.2 1.2.4 1.8.4.5 0 1.1-.2 1.7-.5.6-.2 1-.4 1.4-.4.7 0 1.4.2 2 .5.5.3.9.6 1.3 1a5 5 0 00-1.1 1.7 4.2 4.2 0 00-.3 1.5c0 1 .3 1.9 1 2.8a4.5 4.5 0 001.3 1.2c-.2.6-.4 1.2-.7 1.7zm-4-13a4.5 4.5 0 01-1 2.9A3.5 3.5 0 0114 4.5a2.7 2.7 0 01-.2 1.1c-.2.4-.4.7-.7 1-.3.2-.6.4-.9.5a3 3 0 01-.4-1.2 3 3 0 01.1-1.2c.2-.4.4-.8.7-1 .3-.4.7-.7 1.1-.9a5 5 0 012.3-.8z',
  },
];

export default function DownloadPage() {
  const navigate = useNavigate();
  const isElectron = typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).electronAPI;

  useEffect(() => {
    if (isElectron) navigate('/', { replace: true });
  }, [isElectron, navigate]);

  return (
    <div className="dl-page">
      <div className="dl-header">
        <div className="dl-brand" onClick={() => navigate('/')}>
          <img src="/assets/logo/logo.png" alt="Wouaff" className="dl-logo" />
          <span className="dl-brand-name">Wouaff</span>
        </div>
      </div>

      <div className="dl-hero">
        <div className="dl-hero-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
          </svg>
        </div>
        <h1 className="dl-title">Télécharger Wouaff</h1>
        <p className="dl-subtitle">Choisis ta plateforme et installe l'application pour une expérience optimale.</p>
      </div>

      <div className="dl-cards">
        {DOWNLOADS.map((d) => (
          <a key={d.platform} href={d.url} className="dl-card" download>
            <div className="dl-card-icon-wrap">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9">
                <path d={d.icon} />
              </svg>
            </div>
            <div className="dl-card-body">
              <div className="dl-card-platform">{d.platform}</div>
              <div className="dl-card-label">{d.label}</div>
              <div className="dl-card-arch">{d.arch}</div>
            </div>
            <div className="dl-card-btn">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </svg>
              Télécharger
            </div>
          </a>
        ))}
      </div>

      <div className="dl-footer">
        <span>Wouaff v{VERSION}</span>
        <span className="dl-dot">·</span>
        <span>Application de messagerie privée et sécurisée</span>
        <span className="dl-dot">·</span>
        <button className="dl-back-btn" onClick={() => navigate('/')}>
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
}
