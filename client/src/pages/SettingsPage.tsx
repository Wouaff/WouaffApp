import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { badges as badgesAPI, profiles as profilesAPI } from '../services/api';
import type { UserProfile } from '../types';
import type { SocialLink } from '../utils/socialLinks';
import { PLATFORMS, parseSocialLinks, socialLinksToJson } from '../utils/socialLinks';

type BadgeDef = { name?: string; icon?: string; description?: string };
type ToastItem = { id: number; msg: string; type: 'success' | 'error' | 'info' };

const THEMES = ['default', 'rose', 'confetti', 'neon', 'fire', 'aurora', 'rgb', 'glitch', 'swing'];

let toastId = 0;
function _escHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c: string) =>
      (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }) as Record<string, string>)[c],
  );
}

function normalizeBadgeIds(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean) as string[];
  if (typeof raw === 'object') return Object.keys(raw as Record<string, unknown>);
  return [];
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pseudo, setPseudo] = useState('');
  const [bio, setBio] = useState('');
  const [wouaffId, setWouaffId] = useState('');
  const [avatar, setAvatar] = useState('');
  const [banner, setBanner] = useState('');
  const [messageTheme, setMessageTheme] = useState('default');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [saving, setSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ text: string; type: string } | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [badgeDefs, setBadgeDefs] = useState<Record<string, BadgeDef>>({});
  const [ownedBadgeIds, setOwnedBadgeIds] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [animationsEnabled, setAnimationsEnabled] = useState(
    localStorage.getItem('wouaff_animations_enabled') !== 'false',
  );

  const enableAnimations = (on: boolean) => {
    localStorage.setItem('wouaff_animations_enabled', on ? 'true' : 'false');
    setAnimationsEnabled(on);
  };

  const toast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const p = (await profilesAPI.get(user.uid)) as UserProfile;
        setProfile(p);
        setPseudo(p.pseudo || '');
        setBio(p.bio || '');
        setWouaffId(p.wouaffId || '');
        setAvatar(p.avatar || '');
        setBanner(p.banner || '');
        setMessageTheme((p as Record<string, string>).messageTheme || 'default');
        setOwnedBadgeIds(normalizeBadgeIds((p as Record<string, unknown>).ownedBadges));
        setSocialLinks(parseSocialLinks((p as Record<string, unknown>).social_links));
      } catch (e) {
        console.error(e);
      }
    })();
    badgesAPI
      .list()
      .then(setBadgeDefs)
      .catch((e) => {
        console.error(e);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSettingsMsg(null);
    try {
      const updateData: Record<string, string> = {};
      if (pseudo !== (profile?.pseudo || '')) updateData.pseudo = pseudo;
      if (bio !== (profile?.bio || '')) updateData.bio = bio;
      if (avatar !== (profile?.avatar || '')) updateData.avatar = avatar;
      if (banner !== (profile?.banner || '')) {
        if (isVip) updateData.banner = banner;
        else {
          toast('Bannière réservée aux VIP', 'error');
          setSaving(false);
          return;
        }
      }
      if (wouaffId !== (profile?.wouaffId || '')) {
        if (!wouaffId.startsWith('@')) {
          setSettingsMsg({ text: "L'identifiant doit commencer par @", type: 'error' });
          setSaving(false);
          return;
        }
        updateData.wouaffId = wouaffId;
      }
      if (messageTheme !== ((profile as Record<string, string>)?.messageTheme || 'default')) {
        if (isVip) updateData.messageTheme = messageTheme;
        else {
          toast('Thème de message réservé aux VIP', 'error');
          setSaving(false);
          return;
        }
      }
      const currentLinks = parseSocialLinks((profile as Record<string, unknown>)?.social_links);
      const socialJson = socialLinksToJson(socialLinks);
      if (socialJson !== socialLinksToJson(currentLinks)) {
        updateData.social_links = socialJson;
      }
      if (Object.keys(updateData).length > 0) {
        await profilesAPI.updateMe(updateData);
      }
      setSettingsMsg({ text: '✓ Profil mis à jour avec succès !', type: 'success' });
      toast('Profil sauvegardé !', 'success');
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Une erreur est survenue.';
      setSettingsMsg({ text: errMsg, type: 'error' });
      toast(errMsg, 'error');
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'SUPPRIMER') return;
    if (!user) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/profiles/me', {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur lors de la suppression' }));
        throw new Error(err.error || 'Erreur lors de la suppression');
      }
      toast('Compte supprimé avec succès.', 'success');
      setTimeout(() => {
        logout();
        navigate('/auth');
      }, 1500);
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    }
    setDeleting(false);
  };

  const initial = (profile?.pseudo || '?')[0]?.toUpperCase() || '?';
  const vipBadgeId =
    Object.entries(badgeDefs).find(([, b]) => {
      const n = b?.name?.toLowerCase();
      return n === 'v.i.p' || n === 'vip';
    })?.[0] || null;
  const isVip = !!(vipBadgeId && ownedBadgeIds.includes(vipBadgeId));
  const previewBanner = banner || '';
  const previewAvatar = avatar || '';
  const previewPseudo = pseudo || 'Votre pseudo';
  const previewId = wouaffId || '@wouaff_id';
  const previewBio = bio || '';

  const renderThemes = () => (
    <div className="message-theme-grid">
      {THEMES.map((t) => (
        <div
          key={t}
          className={`theme-option${messageTheme === t ? ' selected' : ''}`}
          onClick={() => {
            if (isVip) setMessageTheme(t);
            else toast('Thème réservé aux VIP', 'error');
          }}
        >
          <div className="theme-preview">
            <div className="theme-avatar">
              {previewAvatar ? <img src={previewAvatar} alt="" /> : <span>{initial}</span>}
            </div>
            <div className={`theme-bubble msg-bubble theme-${t}`}>
              <div className="msg-text">Salut</div>
            </div>
          </div>
          <div className="theme-name">{t.charAt(0).toUpperCase() + t.slice(1)}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div id="settingsPage" className="settings-page">
      <button
        id="mobile-nav-toggle"
        className="fixed top-[14px] left-[14px] z-[200] bg-[var(--bg-card2,var(--bg-card))] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-primary)] w-[38px] h-[38px] flex items-center justify-center cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,.3)]"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Menu"
      >
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
        </svg>
      </button>
      <div
        className={`fixed inset-0 bg-black/60 z-[99] backdrop-blur-[3px]${sidebarOpen ? '' : ' hidden'}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="settings-layout">
        <aside id="settingsSidebar" className={`settings-sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="sidebar-top">
            <div className="sidebar-brand">
              <div className="sidebar-brand-icon">
                <img
                  src="/assets/logo/logo.png"
                  alt="Wouaff"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <span className="sidebar-brand-name">Wouaff</span>
            </div>
            <div className="sidebar-title">Paramètres</div>
          </div>
          <nav className="settings-menu">
            <div className="menu-group-label">Mon compte</div>
            <div
              className={`settings-menu-item${activePanel === 'profile' ? ' active' : ''}`}
              onClick={() => {
                setActivePanel('profile');
                setSidebarOpen(false);
              }}
            >
              <svg className="menu-icon" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
              Profil
            </div>
            <div
              className={`settings-menu-item${activePanel === 'account' ? ' active' : ''}`}
              onClick={() => {
                setActivePanel('account');
                setSidebarOpen(false);
              }}
            >
              <svg className="menu-icon" viewBox="0 0 24 24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
              Compte
            </div>
            <div className="menu-group-label mt-2">Personnalisation</div>
            <div
              className={`settings-menu-item${activePanel === 'badges' ? ' active' : ''}`}
              onClick={() => {
                setActivePanel('badges');
                setSidebarOpen(false);
              }}
            >
              <svg className="menu-icon" viewBox="0 0 24 24">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
              Badges
            </div>
          </nav>
          <div className="settings-footer">
            <button className="back-btn-settings" onClick={() => navigate('/')}>
              <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
              </svg>
              Retour au chat
            </button>
            <button className="logout-btn-settings" onClick={logout}>
              <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
              </svg>
              Déconnexion
            </button>
          </div>
        </aside>

        <div className="settings-content">
          <main className="settings-main">
            <div id="settings-panel-profile" className={`settings-panel${activePanel === 'profile' ? ' active' : ''}`}>
              <div className="panel-header">
                <h2>Profil public</h2>
                <p>Ces informations sont visibles par les autres utilisateurs.</p>
              </div>
              <div className="settings-section">
                <div className="section-title">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                  Identité
                </div>
                <div className="settings-item">
                  <label htmlFor="settingsPseudo">Pseudo</label>
                  <input
                    id="settingsPseudo"
                    placeholder="Votre pseudo"
                    maxLength={32}
                    value={pseudo}
                    onChange={(e) => setPseudo(e.target.value.toLowerCase())}
                  />
                </div>
                <div className="settings-item">
                  <label htmlFor="settingsBio">Bio</label>
                  <textarea
                    id="settingsBio"
                    placeholder="Parlez un peu de vous..."
                    maxLength={280}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                  <div className="info-text">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                    </svg>
                    280 caractères max.
                  </div>
                </div>
                <div className="settings-item">
                  <label htmlFor="myWouaffId">Identifiant Wouaff</label>
                  <div className="input-with-icon">
                    <input
                      id="myWouaffId"
                      placeholder="@votre_id"
                      maxLength={32}
                      value={wouaffId}
                      onChange={(e) => setWouaffId(e.target.value)}
                    />
                    <button
                      className="input-copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(wouaffId);
                        toast('Identifiant copié !', 'success');
                      }}
                      title="Copier"
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                      </svg>
                    </button>
                  </div>
                  <div className="info-text">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                    </svg>
                    Partagez cet identifiant pour être ajouté en contact.
                  </div>
                </div>
              </div>
              <div className="settings-section social-links-section">
                <div className="section-title">
                  <svg viewBox="0 0 24 24">
                    <path d="M3.9 8.26l2.09-.36c.2-.03.38-.15.46-.33l1.36-3.02a.6.6 0 011.06-.01l1.37 3.03c.08.18.26.3.46.33l2.09.36c.48.08.66.66.33 1l-1.6 1.56c-.14.13-.2.33-.16.52l.42 2.24c.1.52-.47.9-.92.64l-1.91-1.13a.64.64 0 00-.6 0l-1.91 1.13c-.45.26-1.02-.12-.92-.64l.42-2.24a.55.55 0 00-.16-.52l-1.6-1.56c-.33-.34-.15-.92.33-1z" />
                    <path d="M3 13h1.5v4.5c0 .28.22.5.5.5h5a.5.5 0 00.5-.5V13H12v4.5c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V13z" />
                  </svg>
                  Liens sociaux
                  <span className="vip-badge ml-2 text-[9px]">{isVip ? 'VIP' : 'Gratuit'}</span>
                </div>
                <div className="info-text mb-3.5">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                  </svg>
                  {isVip
                    ? "Jusqu'à 3 liens sociaux. Ces liens apparaissent sur votre profil public."
                    : "Version gratuite : 1 lien social. Passez VIP pour en ajouter jusqu'à 3."}
                </div>
                {socialLinks.map((link, i) => {
                  const pf = PLATFORMS.find((p) => p.id === link.platform);
                  return (
                    <div key={link.platform + link.url} className="settings-item social-link-row">
                      <div className="social-link-inputs">
                        <select
                          value={link.platform}
                          onChange={(e) => {
                            const copy = [...socialLinks];
                            copy[i] = { ...copy[i], platform: e.target.value };
                            if (e.target.value === 'other') copy[i].url = '';
                            setSocialLinks(copy);
                          }}
                          className="social-platform-select"
                        >
                          {PLATFORMS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="url"
                          placeholder={pf?.id === 'other' ? 'https://...' : `URL ${pf?.label || ''}`}
                          value={link.url}
                          onChange={(e) => {
                            const copy = [...socialLinks];
                            copy[i] = { ...copy[i], url: e.target.value };
                            setSocialLinks(copy);
                          }}
                          className="social-url-input"
                        />
                        <button
                          className="social-link-remove"
                          onClick={() => setSocialLinks(socialLinks.filter((_, j) => j !== i))}
                          title="Supprimer ce lien"
                          aria-label="Supprimer"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
                {socialLinks.length < (isVip ? 3 : 1) && (
                  <button
                    className="social-link-add"
                    onClick={() => {
                      const used = new Set(socialLinks.map((l) => l.platform));
                      const next = PLATFORMS.find((p) => !used.has(p.id)) || PLATFORMS[0];
                      setSocialLinks([...socialLinks, { platform: next.id, url: '' }]);
                    }}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                    Ajouter un lien social
                  </button>
                )}
              </div>
              <div className="settings-section">
                <div className="section-title">
                  <svg viewBox="0 0 24 24">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                  </svg>
                  Apparence
                </div>
                <div className="settings-item">
                  <label htmlFor="settingsAvatar">URL de l'avatar</label>
                  <input
                    id="settingsAvatar"
                    placeholder="https://... ou /assets/..."
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                  />
                  {avatar && (
                    <div className="img-preview-chip visible avatar-preview">
                      <img
                        src={avatar}
                        alt="Aperçu avatar"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <span>Aperçu avatar</span>
                    </div>
                  )}
                  <div className="info-text">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                    </svg>
                    Lien direct vers une image (JPG, PNG, GIF, WebP).
                  </div>
                </div>
                <div className="settings-item">
                  <label htmlFor="themeSelectDark">Thème de l'application</label>
                  <input
                    type="radio"
                    id="themeSelectDark"
                    name="theme"
                    className="hidden"
                    defaultChecked={theme === 'dark'}
                  />
                  <input
                    type="radio"
                    id="themeSelectLight"
                    name="theme"
                    className="hidden"
                    defaultChecked={theme === 'light'}
                  />
                  <div className="theme-toggle-row">
                    <button
                      className={`theme-toggle-btn${theme === 'dark' ? ' active' : ''}`}
                      onClick={() => setTheme('dark')}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z" />
                        <path d="M12 7v10c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
                      </svg>
                      Sombre
                    </button>
                    <button
                      className={`theme-toggle-btn${theme === 'light' ? ' active' : ''}`}
                      onClick={() => setTheme('light')}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
                      </svg>
                      Clair
                    </button>
                  </div>
                </div>
                <div className={`settings-item${!isVip ? ' vip-locked' : ''}`} id="bannerField">
                  <label htmlFor="settingsBanner">
                    URL de la bannière
                    <span className="vip-badge ml-2">✦ VIP</span>
                  </label>
                  <input
                    id="settingsBanner"
                    placeholder="https://... ou /assets/..."
                    value={banner}
                    onChange={(e) => setBanner(e.target.value)}
                    disabled={!isVip}
                  />
                  {!isVip && (
                    <div className="vip-lock-overlay">
                      <div className="vip-lock-text">
                        <img
                          className="vip-lock-badge"
                          src="https://cdn-icons-png.flaticon.com/512/2583/2583344.png"
                          alt="VIP"
                        />
                        Réservé VIP
                      </div>
                    </div>
                  )}
                </div>
                <div className={`settings-item${!isVip ? ' vip-locked' : ''}`} id="messageThemeField">
                  <label htmlFor="msgThemeHidden">
                    Thème de message
                    <span className="vip-badge ml-2">✦ VIP</span>
                  </label>
                  <input type="hidden" id="msgThemeHidden" />
                  {renderThemes()}
                  {!isVip && (
                    <div className="vip-lock-overlay">
                      <div className="vip-lock-text">
                        <img
                          className="vip-lock-badge"
                          src="https://cdn-icons-png.flaticon.com/512/2583/2583344.png"
                          alt="VIP"
                        />
                        Réservé VIP
                      </div>
                    </div>
                  )}
                </div>
                <div className="settings-item">
                  <span className="settings-label">Animations des messages</span>
                  <div className="theme-toggle-row">
                    <button
                      className={`theme-toggle-btn${animationsEnabled ? ' active' : ''}`}
                      onClick={() => enableAnimations(true)}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                      Activées
                    </button>
                    <button
                      className={`theme-toggle-btn${!animationsEnabled ? ' active' : ''}`}
                      onClick={() => enableAnimations(false)}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                      Désactivées
                    </button>
                  </div>
                  <div className="info-text">
                    Affiche des animations (confettis, cœurs, etc.) quand certains mots-clés sont détectés dans les
                    messages.
                  </div>
                </div>
              </div>
              <button className={`save-btn${saving ? ' loading' : ''}`} onClick={handleSave} disabled={saving}>
                <span className="btn-spinner"></span>
                <span className="btn-text">
                  <svg className="w-[15px] h-[15px] align-middle mr-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
                  </svg>
                  Enregistrer les modifications
                </span>
              </button>
              {settingsMsg && (
                <div id="settingsMsg" className={settingsMsg.type}>
                  {settingsMsg.text}
                </div>
              )}
            </div>

            <div id="settings-panel-account" className={`settings-panel${activePanel === 'account' ? ' active' : ''}`}>
              <div className="panel-header">
                <h2>Informations du compte</h2>
                <p>Données liées à votre authentification — non visibles publiquement.</p>
              </div>
              <div className="settings-section">
                <div className="section-title">
                  <svg viewBox="0 0 24 24">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                  </svg>
                  Authentification
                </div>
                <div className="settings-item">
                  <label htmlFor="settingsEmail">Adresse email</label>
                  <div className="input-with-icon">
                    <input id="settingsEmail" readOnly value={user?.email || ''} />
                    <button
                      className="input-copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(user?.email || '');
                        toast('Email copié', 'success');
                      }}
                      title="Copier"
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="settings-item">
                  <label htmlFor="settingsUid">UID Firebase</label>
                  <div className="input-with-icon">
                    <input id="settingsUid" readOnly value={user?.uid || ''} />
                    <button
                      className="input-copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(user?.uid || '');
                        toast('UID copié', 'success');
                      }}
                      title="Copier"
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="info-text mt-0">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                  </svg>
                  Ces données ne sont jamais affichées publiquement.
                </div>
              </div>
              <div className="settings-section">
                <div className="section-title">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  Badges possédés
                </div>
                <div className="text-[28px] font-black text-[var(--text-primary)]">{ownedBadgeIds.length}</div>
                <div className="text-xs text-text-muted mt-0.5">badge(s) dans votre collection</div>
              </div>
              <div className="settings-section danger-zone-section">
                <div className="section-title">
                  <svg viewBox="0 0 24 24">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                  Zone dangereuse
                </div>
                <p className="text-sm text-text-secondary leading-relaxed mb-3.5">
                  La suppression de votre compte est <strong className="text-[var(--danger)]">irréversible</strong>.
                  Toutes vos données (profil, messages, badges) seront définitivement effacées.
                </p>
                <button className="save-btn danger-btn" onClick={() => setDeleteModalOpen(true)}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                  Supprimer mon compte
                </button>
              </div>
            </div>

            <div id="settings-panel-badges" className={`settings-panel${activePanel === 'badges' ? ' active' : ''}`}>
              <div className="panel-header">
                <h2>Mes badges</h2>
                <p>Badges obtenus sur Wouaff.</p>
              </div>
              <div className="settings-section">
                <div className="section-title">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  Collection
                </div>
                {ownedBadgeIds.length === 0 ? (
                  <div className="no-badges">
                    <div className="no-badges-icon">🏅</div>
                    Aucun badge pour l'instant.
                  </div>
                ) : (
                  <div className="badge-selector">
                    {ownedBadgeIds.map((id) => {
                      const b = badgeDefs[id];
                      if (!b) return null;
                      return (
                        <div key={id} className="badge-option" title={b.description || b.name || id}>
                          <div className="badge-option-icon">
                            {b.icon && (
                              <img
                                src={b.icon}
                                alt={b.name || id}
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                          <div className="badge-option-name">{b.name || id}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </main>

          <aside className="settings-preview">
            <div className="preview-label">Aperçu du profil</div>
            <div className="profile-box">
              <div
                className="profile-banner"
                style={
                  previewBanner
                    ? {
                        backgroundImage: `url(${previewBanner.replace(/"/g, '%22')})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : {}
                }
              ></div>
              <div className="profile-avatar-wrap">
                <div className="profile-avatar-lg">
                  {previewAvatar ? (
                    <img
                      src={previewAvatar}
                      alt={previewPseudo}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        (e.target as HTMLElement).parentElement!.textContent = initial;
                      }}
                    />
                  ) : (
                    <span>{initial}</span>
                  )}
                </div>
              </div>
              <div className="profile-body-content">
                <div className="profile-name-row">{previewPseudo}</div>
                <div className="profile-wouaff-id">{previewId}</div>
                <div className="profile-badges-row">
                  {ownedBadgeIds.map((id) => {
                    const b = badgeDefs[id];
                    if (!b) return null;
                    return (
                      <span key={id} className="badge-chip">
                        {b.icon && (
                          <img
                            src={b.icon}
                            alt=""
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                        {b.name || id}
                      </span>
                    );
                  })}
                </div>
                <div className="profile-section" id="previewStatusSection">
                  <div className="profile-section-label">Statut</div>
                  <div className="profile-section-val">
                    <span className="profile-status-dot bg-[var(--online)]" />
                    En ligne
                  </div>
                </div>
                {previewBio && (
                  <div className="profile-section">
                    <div className="profile-section-label">Bio</div>
                    <div className="profile-section-val">{previewBio}</div>
                  </div>
                )}
                {socialLinks.filter((l) => l.url.trim()).length > 0 && (
                  <div className="profile-section">
                    <div className="profile-section-label">Liens sociaux</div>
                    <div className="profile-section-val">
                      <div className="preview-social-links">
                        {socialLinks
                          .filter((l) => l.url.trim())
                          .map((link) => {
                            const pf = PLATFORMS.find((p) => p.id === link.platform);
                            return (
                              <a
                                key={link.platform + link.url}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="preview-social-link"
                                title={link.url}
                                style={pf ? ({ '--sl-color': pf.color } as React.CSSProperties) : {}}
                              >
                                {pf && (
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="w-[18px] h-[18px]"
                                    dangerouslySetInnerHTML={{ __html: pf.svg }}
                                  />
                                )}
                                <span>{pf?.label || link.platform}</span>
                              </a>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div
        className={`delete-modal${deleteModalOpen ? ' visible' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDeleteModalOpen(false);
        }}
      >
        <div className="delete-modal-box" onClick={(e) => e.stopPropagation()}>
          <h3>⚠️ Supprimer le compte</h3>
          <p>
            Cette action est <strong className="text-[var(--danger)]">irréversible</strong>. Tapez{' '}
            <strong className="text-[var(--danger)]">SUPPRIMER</strong> ci-dessous pour confirmer.
          </p>
          <input
            type="text"
            placeholder="SUPPRIMER"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          <div className="delete-modal-actions">
            <button
              className="cancel-btn"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeleteConfirm('');
                setDeleteError('');
              }}
            >
              Annuler
            </button>
            <button
              className={`confirm-btn${deleting ? ' loading' : ''}`}
              disabled={deleteConfirm !== 'SUPPRIMER' || deleting}
              onClick={handleDeleteAccount}
            >
              <span className="btn-spinner"></span>
              <span className="btn-text">Supprimer</span>
            </button>
          </div>
          {deleteError && (
            <div id="deleteError" className="visible">
              {deleteError}
            </div>
          )}
        </div>
      </div>

      <div className="toast-settings">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item ${t.type}`}>
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
