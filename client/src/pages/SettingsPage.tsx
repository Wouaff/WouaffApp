import {
  Award,
  Check,
  ChevronLeft,
  Copy,
  Image,
  Link2,
  Loader2,
  Lock,
  Moon,
  Palette,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast, { showToast } from '../components/Common/Toast';
import LeftNav from '../components/Home/LeftNav';
import RightSidebar from '../components/Home/RightSidebar';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { badges as badgesAPI, profiles as profilesAPI } from '../services/api';
import type { UserProfile } from '../types';
import type { SocialLink } from '../utils/socialLinks';
import { PLATFORMS, parseSocialLinks, socialLinksToJson } from '../utils/socialLinks';

type BadgeDef = { name?: string; icon?: string; description?: string };
type Tab = 'profile' | 'account' | 'badges';

const THEMES = ['default', 'rose', 'confetti', 'neon', 'fire', 'aurora', 'rgb', 'glitch', 'swing'];

function normalizeBadgeIds(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean) as string[];
  if (typeof raw === 'object') return Object.keys(raw as Record<string, unknown>);
  return [];
}

const inputCls =
  'w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-glow)] font-sans transition-colors';
const cardCls = 'rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 mb-4';
const labelCls = 'block text-[13px] font-bold text-[var(--text-primary)] mb-1.5';
const hintCls = 'flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] mt-1.5';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [pseudo, setPseudo] = useState('');
  const [bio, setBio] = useState('');
  const [wouaffId, setWouaffId] = useState('');
  const [avatar, setAvatar] = useState('');
  const [banner, setBanner] = useState('');
  const [messageTheme, setMessageTheme] = useState('default');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);

  const [saving, setSaving] = useState(false);
  const [badgeDefs, setBadgeDefs] = useState<Record<string, BadgeDef>>({});
  const [ownedBadgeIds, setOwnedBadgeIds] = useState<string[]>([]);
  const [animationsEnabled, setAnimationsEnabled] = useState(
    localStorage.getItem('wouaff_animations_enabled') !== 'false',
  );

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const enableAnimations = (on: boolean) => {
    localStorage.setItem('wouaff_animations_enabled', on ? 'true' : 'false');
    setAnimationsEnabled(on);
  };

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

  const vipBadgeId =
    Object.entries(badgeDefs).find(([, b]) => {
      const n = b?.name?.toLowerCase();
      return n === 'v.i.p' || n === 'vip';
    })?.[0] || null;
  const isVip = !!(vipBadgeId && ownedBadgeIds.includes(vipBadgeId));

  const initial = (pseudo || profile?.pseudo || '?')[0]?.toUpperCase() || '?';
  const handle = wouaffId || profile?.wouaffId || '@wouaff_id';

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copié`, 'success');
    } catch {
      showToast('Impossible de copier', 'error');
    }
  };

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updateData: Record<string, string> = {};
      if (pseudo !== (profile?.pseudo || '')) updateData.pseudo = pseudo;
      if (bio !== (profile?.bio || '')) updateData.bio = bio;
      if (avatar !== (profile?.avatar || '')) updateData.avatar = avatar;
      if (banner !== (profile?.banner || '')) {
        if (isVip) updateData.banner = banner;
        else {
          showToast('Bannière réservée aux VIP', 'error');
          setSaving(false);
          return;
        }
      }
      if (wouaffId !== (profile?.wouaffId || '')) {
        if (!wouaffId.startsWith('@')) {
          showToast("L'identifiant doit commencer par @", 'error');
          setSaving(false);
          return;
        }
        updateData.wouaffId = wouaffId;
      }
      if (messageTheme !== ((profile as Record<string, string>)?.messageTheme || 'default')) {
        if (isVip) updateData.messageTheme = messageTheme;
        else {
          showToast('Thème de message réservé aux VIP', 'error');
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
      showToast('Profil sauvegardé !', 'success');
      setProfile((prev) => ({ ...(prev as UserProfile), ...updateData }));
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Une erreur est survenue.', 'error');
    }
    setSaving(false);
  }, [user, profile, pseudo, bio, avatar, banner, wouaffId, messageTheme, socialLinks, isVip]);

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'SUPPRIMER' || !user) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/profiles/me', { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur lors de la suppression' }));
        throw new Error(err.error || 'Erreur lors de la suppression');
      }
      showToast('Compte supprimé avec succès.', 'success');
      setTimeout(() => {
        logout();
        navigate('/auth');
      }, 1200);
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
      setDeleting(false);
    }
  };

  const setLink = (i: number, patch: Partial<SocialLink>) => {
    setSocialLinks((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  };

  const addLink = () => {
    const used = new Set(socialLinks.map((l) => l.platform));
    const next = PLATFORMS.find((p) => !used.has(p.id)) || PLATFORMS[0];
    setSocialLinks((prev) => [...prev, { platform: next.id, url: '' }]);
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profil', icon: <User size={16} /> },
    { id: 'account', label: 'Compte', icon: <Lock size={16} /> },
    { id: 'badges', label: 'Badges', icon: <Award size={16} /> },
  ];

  const visibleLinks = socialLinks.filter((l) => l.url.trim());

  return (
    <div className="flex h-full">
      <LeftNav />
      <main className="flex-1 min-w-0 h-full overflow-y-auto bg-[var(--bg-deep)]">
        <div className="mx-auto max-w-[600px] min-h-full border-x border-[var(--border)] bg-[var(--bg-base)]">
          <header className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-[12px] border-b border-[var(--border)]">
            <div className="flex items-center gap-5 px-2 h-14">
              <button
                type="button"
                onClick={goBack}
                aria-label="Retour"
                className="w-9 h-9 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="min-w-0">
                <div className="font-extrabold text-[17px] text-[var(--text-primary)] leading-tight">Paramètres</div>
              </div>
            </div>
            <div className="flex">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? 'page' : undefined}
                  className={`relative flex-1 flex items-center justify-center gap-1.5 py-3 border-none bg-transparent cursor-pointer transition-colors font-sans ${
                    tab === t.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {t.icon}
                  <span className={tab === t.id ? 'text-[15px] font-extrabold' : 'text-[15px] font-medium'}>
                    {t.label}
                  </span>
                  {tab === t.id && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-brand rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </header>

          {tab === 'profile' && (
            <div className="p-4">
              {/* Aperçu du profil */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden mb-4">
                <div
                  className="h-28 bg-gradient-to-br from-brand to-brand-dark bg-cover bg-center"
                  style={banner ? { backgroundImage: `url(${banner})` } : undefined}
                />
                <div className="px-4 pb-4">
                  <div className="w-20 h-20 -mt-10 rounded-full border-4 border-[var(--bg-card)] bg-gradient-to-br from-brand to-brand-dark overflow-hidden flex items-center justify-center text-white font-extrabold text-2xl flex-shrink-0">
                    {avatar ? (
                      <img src={avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{initial}</span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="font-extrabold text-[19px] text-[var(--text-primary)]">
                      {pseudo || 'Votre pseudo'}
                    </span>
                    {isVip && <Sparkles size={16} className="text-brand" aria-label="VIP" />}
                  </div>
                  <div className="text-[14px] text-[var(--text-muted)]">{handle}</div>
                  {bio && (
                    <p className="m-0 mt-2 text-[14px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                      {bio}
                    </p>
                  )}
                  {visibleLinks.length > 0 && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {visibleLinks.map((link) => {
                        const pf = PLATFORMS.find((p) => p.id === link.platform);
                        return (
                          <span
                            key={link.platform + link.url}
                            className="inline-flex items-center gap-1.5 text-[12px] text-brand no-underline"
                          >
                            {pf && (
                              <svg
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="w-3.5 h-3.5"
                                dangerouslySetInnerHTML={{ __html: pf.svg }}
                              />
                            )}
                            {pf?.label || link.platform}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Identité */}
              <div className={cardCls}>
                <h3 className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider text-brand mb-3">
                  <User size={14} /> Identité
                </h3>
                <div className="mb-3">
                  <label htmlFor="settingsPseudo" className={labelCls}>
                    Pseudo
                  </label>
                  <input
                    id="settingsPseudo"
                    placeholder="Votre pseudo"
                    maxLength={32}
                    value={pseudo}
                    onChange={(e) => setPseudo(e.target.value.toLowerCase())}
                    className={inputCls}
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="settingsBio" className={labelCls}>
                    Bio
                  </label>
                  <textarea
                    id="settingsBio"
                    placeholder="Parlez un peu de vous..."
                    maxLength={280}
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className={`${inputCls} resize-none`}
                  />
                  <div className={hintCls}>{bio.length} / 280</div>
                </div>
                <div>
                  <label htmlFor="myWouaffId" className={labelCls}>
                    Identifiant Wouaff
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="myWouaffId"
                      placeholder="@votre_id"
                      maxLength={32}
                      value={wouaffId}
                      onChange={(e) => setWouaffId(e.target.value)}
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => copy(wouaffId || handle, 'Identifiant')}
                      title="Copier"
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-muted)] cursor-pointer hover:text-brand hover:border-[var(--brand)] transition-colors"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                  <div className={hintCls}>Partagez cet identifiant pour être ajouté en contact.</div>
                </div>
              </div>

              {/* Liens sociaux */}
              <div className={cardCls}>
                <h3 className="flex items-center justify-between gap-2 text-[12px] font-extrabold uppercase tracking-wider text-brand mb-3">
                  <span className="flex items-center gap-2">
                    <Link2 size={14} /> Liens sociaux
                  </span>
                  <span className="flex items-center gap-1 text-[10px] normal-case tracking-normal px-2 py-0.5 rounded-full bg-[var(--brand-glow)] text-brand font-bold">
                    {isVip ? <Sparkles size={10} /> : null}
                    {isVip ? 'VIP' : `${socialLinks.length}/1`}
                  </span>
                </h3>
                <div className={`${hintCls} mb-3`}>
                  {isVip
                    ? "Jusqu'à 3 liens sociaux, affichés sur votre profil public."
                    : "Version gratuite : 1 lien social. Passez VIP pour en ajouter jusqu'à 3."}
                </div>
                {socialLinks.map((link, i) => {
                  const pf = PLATFORMS.find((p) => p.id === link.platform);
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: les liens sont réordonnés en direct
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <select
                        value={link.platform}
                        onChange={(e) => {
                          setLink(i, { platform: e.target.value });
                          if (e.target.value === 'other') setLink(i, { url: '' });
                        }}
                        aria-label="Plateforme"
                        className="flex-shrink-0 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-2.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand)] font-sans cursor-pointer"
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
                        onChange={(e) => setLink(i, { url: e.target.value })}
                        aria-label="URL du lien"
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={() => setSocialLinks((prev) => prev.filter((_, j) => j !== i))}
                        aria-label="Supprimer ce lien"
                        title="Supprimer"
                        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-muted)] cursor-pointer hover:text-red-500 hover:border-red-500/40 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
                {socialLinks.length < (isVip ? 3 : 1) && (
                  <button
                    type="button"
                    onClick={addLink}
                    className="flex items-center gap-1.5 text-[13px] font-bold text-brand rounded-full border-none bg-transparent cursor-pointer hover:bg-[var(--brand-glow)] px-3 py-2 transition-colors"
                  >
                    <Plus size={15} /> Ajouter un lien social
                  </button>
                )}
              </div>

              {/* Apparence */}
              <div className={cardCls}>
                <h3 className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider text-brand mb-3">
                  <Palette size={14} /> Apparence
                </h3>

                <div className="mb-3">
                  <label htmlFor="settingsAvatar" className={labelCls}>
                    URL de l'avatar
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="settingsAvatar"
                      placeholder="https://... ou /assets/..."
                      value={avatar}
                      onChange={(e) => setAvatar(e.target.value)}
                      className={inputCls}
                    />
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--bg-input)] border border-[var(--border)] overflow-hidden flex items-center justify-center">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt="Aperçu avatar"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Image size={15} className="text-[var(--text-muted)]" />
                      )}
                    </div>
                  </div>
                </div>

                <div className={`mb-3 ${!isVip ? 'opacity-60' : ''}`}>
                  <label htmlFor="settingsBanner" className={labelCls}>
                    URL de la bannière{' '}
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--brand-glow)] text-brand font-bold ml-1 align-middle">
                      <Sparkles size={9} /> VIP
                    </span>
                  </label>
                  <input
                    id="settingsBanner"
                    placeholder="https://... ou /assets/..."
                    value={banner}
                    onChange={(e) => setBanner(e.target.value)}
                    disabled={!isVip}
                    className={inputCls}
                  />
                  {!isVip && <div className={hintCls}>Bannière réservée aux comptes VIP.</div>}
                </div>

                <div className="mb-3">
                  <span className={labelCls}>Thème de l'application</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors cursor-pointer ${
                        theme === 'dark'
                          ? 'border-[var(--brand)] bg-[var(--brand-glow)] text-[var(--text-primary)]'
                          : 'border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <Moon size={16} /> Sombre
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors cursor-pointer ${
                        theme === 'light'
                          ? 'border-[var(--brand)] bg-[var(--brand-glow)] text-[var(--text-primary)]'
                          : 'border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <Sun size={16} /> Clair
                    </button>
                  </div>
                </div>

                <div className={`mb-3 ${!isVip ? 'opacity-60' : ''}`}>
                  <span className={labelCls}>
                    Thème des messages{' '}
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--brand-glow)] text-brand font-bold ml-1 align-middle">
                      <Sparkles size={9} /> VIP
                    </span>
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {THEMES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        disabled={!isVip}
                        onClick={() => setMessageTheme(t)}
                        title={t.charAt(0).toUpperCase() + t.slice(1)}
                        className={`rounded-xl border p-2 flex flex-col items-center gap-1.5 cursor-pointer transition-colors ${
                          !isVip
                            ? 'opacity-50 cursor-not-allowed'
                            : messageTheme === t
                              ? 'border-[var(--brand)] bg-[var(--brand-glow)]'
                              : 'border-[var(--border)] bg-[var(--bg-input)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <span className="w-11 h-7 rounded-lg msg-bubble theme-default theme-preview-bubble">
                          <span className="msg-text">A</span>
                        </span>
                        <span className="text-[10px] font-bold text-[var(--text-muted)] capitalize">{t}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className={labelCls}>Animations des messages</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => enableAnimations(true)}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors cursor-pointer ${
                        animationsEnabled
                          ? 'border-[var(--brand)] bg-[var(--brand-glow)] text-[var(--text-primary)]'
                          : 'border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <Check size={16} /> Activées
                    </button>
                    <button
                      type="button"
                      onClick={() => enableAnimations(false)}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors cursor-pointer ${
                        !animationsEnabled
                          ? 'border-[var(--brand)] bg-[var(--brand-glow)] text-[var(--text-primary)]'
                          : 'border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <X size={16} /> Désactivées
                    </button>
                  </div>
                  <div className={hintCls}>
                    Affiche des animations quand certains mots-clés sont détectés dans les messages.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-brand hover:opacity-90 disabled:opacity-50 transition-opacity text-white font-bold text-[15px] rounded-full py-3 border-none cursor-pointer mb-6"
              >
                {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                Enregistrer les modifications
              </button>
            </div>
          )}

          {tab === 'account' && (
            <div className="p-4">
              <div className={cardCls}>
                <h3 className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider text-brand mb-3">
                  <Lock size={14} /> Authentification
                </h3>
                <div className="mb-3">
                  <label htmlFor="settingsEmail" className={labelCls}>
                    Adresse email
                  </label>
                  <div className="flex items-center gap-2">
                    <input id="settingsEmail" readOnly value={user?.email || ''} className={`${inputCls} opacity-70`} />
                    <button
                      type="button"
                      onClick={() => copy(user?.email || '', 'Email')}
                      title="Copier"
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-muted)] cursor-pointer hover:text-brand hover:border-[var(--brand)] transition-colors"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="settingsUid" className={labelCls}>
                    UID
                  </label>
                  <div className="flex items-center gap-2">
                    <input id="settingsUid" readOnly value={user?.uid || ''} className={`${inputCls} opacity-70`} />
                    <button
                      type="button"
                      onClick={() => copy(user?.uid || '', 'UID')}
                      title="Copier"
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-muted)] cursor-pointer hover:text-brand hover:border-[var(--brand)] transition-colors"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                  <div className={hintCls}>
                    <ShieldCheck size={12} /> Ces données ne sont jamais affichées publiquement.
                  </div>
                </div>
              </div>

              <div className={cardCls}>
                <h3 className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider text-brand mb-3">
                  <Award size={14} /> Collection de badges
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-[var(--text-primary)]">{ownedBadgeIds.length}</span>
                  <span className="text-[13px] text-[var(--text-muted)]">badge(s) dans votre collection</span>
                </div>
                {ownedBadgeIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTab('badges')}
                    className="mt-2 text-[13px] font-bold text-brand rounded-full border-none bg-transparent cursor-pointer hover:underline"
                  >
                    Voir mes badges →
                  </button>
                )}
              </div>

              <div className={`${cardCls} border-red-500/30`}>
                <h3 className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider text-[var(--danger)] mb-3">
                  <Trash2 size={14} /> Zone dangereuse
                </h3>
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-3">
                  La suppression de votre compte est <strong className="text-[var(--danger)]">irréversible</strong>.
                  Toutes vos données (profil, messages, badges) seront définitivement effacées.
                </p>
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  className="flex items-center justify-center gap-2 w-full rounded-full border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 transition-colors text-[var(--danger)] font-bold text-sm py-3 cursor-pointer"
                >
                  <Trash2 size={16} /> Supprimer mon compte
                </button>
              </div>
            </div>
          )}

          {tab === 'badges' && (
            <div className="p-4">
              <div className={cardCls}>
                <h3 className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider text-brand mb-3">
                  <Award size={14} /> Mes badges
                </h3>
                {ownedBadgeIds.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-5xl mb-3" aria-hidden="true">
                      🏅
                    </div>
                    <p className="m-0 text-[var(--text-secondary)]">Aucun badge pour l'instant.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {ownedBadgeIds.map((id) => {
                      const b = badgeDefs[id];
                      if (!b) return null;
                      return (
                        <div
                          key={id}
                          title={b.description || b.name || id}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--bg-input)] p-3 flex flex-col items-center gap-2 text-center"
                        >
                          <div className="w-12 h-12 rounded-full bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center overflow-hidden">
                            {b.icon && (
                              <img
                                src={b.icon}
                                alt={b.name || id}
                                className="w-8 h-8 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-[var(--text-primary)] leading-tight">
                            {b.name || id}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <RightSidebar />

      {deleteModalOpen && (
        <div
          className="modal-overlay active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteModalOpen(false);
          }}
        >
          <div className="w-full max-w-[420px] rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl">
            <div className="px-5 pt-5 pb-4">
              <h3 className="text-[18px] font-extrabold text-[var(--text-primary)] m-0 mb-1">Supprimer le compte</h3>
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
                Cette action est <strong className="text-[var(--danger)]">irréversible</strong>. Tapez{' '}
                <strong className="text-[var(--danger)]">SUPPRIMER</strong> pour confirmer.
              </p>
              <input
                type="text"
                placeholder="SUPPRIMER"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                onFocus={(e) => e.target.select()}
                aria-label="Confirmer la suppression"
                className={inputCls}
              />
              {deleteError && <div className="text-[12px] text-[var(--danger)] mt-2">{deleteError}</div>}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteConfirm('');
                  setDeleteError('');
                }}
                className="px-4 py-2 rounded-full text-sm font-bold text-[var(--text-secondary)] border border-[var(--border)] bg-transparent cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={deleteConfirm !== 'SUPPRIMER' || deleting}
                onClick={handleDeleteAccount}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast />
    </div>
  );
}
