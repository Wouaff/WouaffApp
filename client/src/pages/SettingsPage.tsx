import { Camera, Palette, Shield, ShieldAlert, User, UserCog } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { type ThemePreference, useTheme } from '../hooks/useTheme';
import { fullDate } from '../lib/time';
import { api, errorMessage } from '../services/api';
import type { CurrentUser } from '../services/auth';

const SETTINGS_TABS = [
  { id: 'account', label: 'Ton compte', icon: User, description: 'Identifiants, mot de passe, e-mail.' },
  { id: 'profile', label: 'Profil', icon: UserCog, description: 'Photo, bannière, bio, liens.' },
  { id: 'security', label: 'Sécurité', icon: Shield, description: 'Double authentification, sessions.' },
  { id: 'display', label: 'Affichage', icon: Palette, description: 'Thème clair, sombre ou auto.' },
  { id: 'privacy', label: 'Confidentialité', icon: ShieldAlert, description: 'Blocages, export, suppression.' },
] as const;

type TabId = (typeof SETTINGS_TABS)[number]['id'];

const inputClass =
  'w-full bg-transparent border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors';
const primaryBtn =
  'bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-bold rounded-full px-6 py-2.5 transition-colors';
const outlineBtn =
  'px-4 py-1.5 rounded-full border border-[var(--border-color)] text-[var(--text-primary)] font-bold text-sm hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50';

function Feedback({ ok, error }: { ok?: string; error?: string }) {
  if (error)
    return (
      <p role="alert" className="text-sm text-[var(--danger)]">
        {error}
      </p>
    );
  if (ok)
    return (
      <p role="status" className="text-sm text-[var(--repost-color)]">
        {ok}
      </p>
    );
  return null;
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const active: TabId = SETTINGS_TABS.some((t) => t.id === requested) ? (requested as TabId) : 'account';

  return (
    <AppShell>
      <PageHeader title="Paramètres" back="/" />
      <div className="flex flex-col md:flex-row">
        <div
          role="tablist"
          aria-orientation="vertical"
          className="w-full md:w-[200px] xl:w-[250px] flex-shrink-0 border-b md:border-b-0 md:border-r border-[var(--border-color)] py-2 flex md:block overflow-x-auto no-scrollbar"
        >
          {SETTINGS_TABS.map(({ id, label, icon: Icon, description }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active === id}
              onClick={() => setParams({ tab: id }, { replace: true })}
              className={`md:w-full flex-shrink-0 text-left px-4 py-4 transition-colors ${
                active === id
                  ? 'bg-[var(--accent)]/10 md:border-r-2 border-[var(--accent)]'
                  : 'hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-[var(--text-secondary)]" />
                <div>
                  <div
                    className={`font-bold text-[15px] ${active === id ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}
                  >
                    {label}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] hidden xl:block">{description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0 p-6">
          {user && active === 'account' && <AccountTab user={user} />}
          {user && active === 'profile' && <ProfileTab user={user} refresh={refresh} />}
          {user && active === 'security' && <SecurityTab user={user} refresh={refresh} />}
          {active === 'display' && <DisplayTab />}
          {user && active === 'privacy' && <PrivacyTab />}
        </div>
      </div>
    </AppShell>
  );
}

/* ── Compte ─────────────────────────────────────────────────────────────────── */

function AccountTab({ user }: { user: CurrentUser }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setOk('');
    setError('');
    try {
      await api.post('/auth/password', { currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setOk('Mot de passe modifié. Tes autres appareils ont été déconnectés.');
    } catch (err) {
      setError(errorMessage(err));
    }
    setSaving(false);
  };

  return (
    <div>
      <h2 className="font-extrabold text-xl mb-2">Informations du compte</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Ton pseudo et ton adresse e-mail.</p>

      <div className="border border-[var(--border-color)] rounded-xl overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-[var(--border-color)]">
          <div className="text-sm text-[var(--text-secondary)]">PSEUDO</div>
          <div className="font-bold text-[var(--text-primary)] mt-1">@{user.pseudo}</div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Le pseudo est défini à l'inscription et ne peut pas être modifié.
          </p>
        </div>
        <div className="px-4 py-3">
          <div className="text-sm text-[var(--text-secondary)]">E-MAIL</div>
          <div className="font-bold text-[var(--text-primary)] mt-1">{user.email}</div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {user.emailVerified
              ? 'Adresse confirmée.'
              : user.mailEnabled
                ? 'Adresse non confirmée : vérifie ta boîte mail.'
                : 'Adresse non confirmée.'}
          </p>
        </div>
      </div>

      <h3 className="font-extrabold text-lg mb-3">Changer de mot de passe</h3>
      <form onSubmit={changePassword} className="space-y-4">
        <Field label="Mot de passe actuel" id="cur-pass">
          <input
            id="cur-pass"
            type="password"
            className={inputClass}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <Field label="Nouveau mot de passe (8 caractères min.)" id="new-pass">
          <input
            id="new-pass"
            type="password"
            className={inputClass}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />
        </Field>
        <Feedback ok={ok} error={error} />
        <button type="submit" disabled={saving} className={primaryBtn}>
          {saving ? '…' : 'Mettre à jour'}
        </button>
      </form>
    </div>
  );
}

/* ── Profil ─────────────────────────────────────────────────────────────────── */

function ProfileTab({ user, refresh }: { user: CurrentUser; refresh: () => Promise<unknown> }) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [location, setLocation] = useState(user.location || '');
  const [website, setWebsite] = useState(user.website || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'avatar' | 'banner' | null>(null);
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const uploadImage = async (kind: 'avatar' | 'banner', file: File | undefined) => {
    if (!file) return;
    setError('');
    setOk('');
    if (!file.type.startsWith('image/')) {
      setError('Choisis une image (jpg, png, gif ou webp)');
      return;
    }
    setUploading(kind);
    try {
      const form = new FormData();
      form.append('file', file);
      const { url } = await api.upload<{ url: string }>('/upload', form);
      await api.put('/profiles/me', { [kind]: url });
      await refresh();
      setOk(kind === 'avatar' ? 'Photo mise à jour.' : 'Bannière mise à jour.');
    } catch (err) {
      setError(errorMessage(err));
    }
    setUploading(null);
  };

  const removeImage = async (kind: 'avatar' | 'banner') => {
    try {
      await api.put('/profiles/me', { [kind]: null });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setOk('');
    setError('');
    try {
      await api.put('/profiles/me', { displayName, bio, location, website });
      await refresh();
      setOk('Profil enregistré.');
    } catch (err) {
      setError(errorMessage(err));
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="h-[160px] bg-[var(--bg-tertiary)] rounded-xl relative overflow-hidden">
        {user.banner && <img src={user.banner} alt="" className="w-full h-full object-cover" />}
        <input
          ref={bannerInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => uploadImage('banner', e.target.files?.[0])}
        />
        <div className="absolute bottom-3 right-3 flex gap-2">
          {user.banner && (
            <button
              type="button"
              onClick={() => removeImage('banner')}
              className="px-3 py-1.5 text-sm bg-[var(--bg-primary)]/80 rounded-full text-[var(--text-primary)]"
            >
              Retirer
            </button>
          )}
          <button
            type="button"
            onClick={() => bannerInput.current?.click()}
            disabled={uploading === 'banner'}
            aria-label="Changer la bannière"
            className="p-2 bg-[var(--bg-primary)]/80 rounded-full text-[var(--text-primary)]"
          >
            <Camera className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative z-10 w-20 h-20 -mt-10 ml-4">
        <Avatar src={user.avatar} name={user.pseudo} className="w-20 h-20 text-2xl ring-4 ring-[var(--bg-secondary)]" />
        <input
          ref={avatarInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => uploadImage('avatar', e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => avatarInput.current?.click()}
          disabled={uploading === 'avatar'}
          aria-label="Changer la photo de profil"
          className="absolute inset-0 rounded-full bg-black/40 opacity-0 hover:opacity-100 focus-visible:opacity-100 flex items-center justify-center text-white transition-opacity"
        >
          <Camera className="w-6 h-6" />
        </button>
      </div>
      {user.avatar && (
        <button
          type="button"
          onClick={() => removeImage('avatar')}
          className="ml-4 mt-1 text-xs text-[var(--text-secondary)] hover:underline"
        >
          Retirer la photo
        </button>
      )}

      <div className="mt-3 mb-6">
        <div className="font-bold truncate">{user.displayName || user.pseudo}</div>
        <div className="text-sm text-[var(--text-secondary)] truncate">@{user.pseudo}</div>
      </div>

      <h3 className="font-extrabold text-xl mb-4">Modifier le profil</h3>
      <div className="space-y-4">
        <Field label="Nom affiché" id="dn">
          <input
            id="dn"
            type="text"
            maxLength={50}
            className={inputClass}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <Field label="Bio" id="bio">
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            className={`${inputClass} resize-none min-h-[100px]`}
          />
          <div className="text-right text-sm text-[var(--text-secondary)]">{bio.length}/160</div>
        </Field>
        <Field label="Localisation" id="loc">
          <input
            id="loc"
            type="text"
            maxLength={100}
            className={inputClass}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </Field>
        <Field label="Site web" id="web">
          <input
            id="web"
            type="url"
            maxLength={255}
            placeholder="https://"
            className={inputClass}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-4 mt-6">
        <Feedback ok={ok} error={error} />
        <button type="button" onClick={handleSave} disabled={saving} className={`${primaryBtn} ml-auto`}>
          {saving ? '…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

/* ── Sécurité ───────────────────────────────────────────────────────────────── */

interface SessionInfo {
  id: string;
  userAgent: string | null;
  createdAt: string;
  current: boolean;
}

function SecurityTab({ user, refresh }: { user: CurrentUser; refresh: () => Promise<unknown> }) {
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState<SessionInfo[]>([]);

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await api.get<SessionInfo[]>('/auth/sessions'));
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setOk('');
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(false);
  };

  const startSetup = () => run(async () => setSetup(await api.post('/auth/2fa/setup')));

  const enable = () =>
    run(async () => {
      await api.post('/auth/2fa/enable', { code });
      setSetup(null);
      setCode('');
      await refresh();
      setOk('Double authentification activée.');
    });

  const disable = () =>
    run(async () => {
      await api.post('/auth/2fa/disable', { password, code });
      setDisabling(false);
      setPassword('');
      setCode('');
      await refresh();
      setOk('Double authentification désactivée.');
    });

  const revoke = (id: string) =>
    run(async () => {
      await api.del(`/auth/sessions/${id}`);
      await loadSessions();
    });

  const revokeOthers = () =>
    run(async () => {
      await api.post('/auth/sessions/revoke-others');
      await loadSessions();
      setOk('Les autres appareils ont été déconnectés.');
    });

  return (
    <div>
      <h2 className="font-extrabold text-xl mb-2">Double authentification</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Protège ton compte avec un code à usage unique généré par une application d'authentification (Aegis, Google
        Authenticator, Authy…).
      </p>

      <div className="border border-[var(--border-color)] rounded-xl p-4 mb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-bold text-[var(--text-primary)]">APPLICATION D'AUTHENTIFICATION</div>
            <div className="text-sm text-[var(--text-secondary)]">{user.totpEnabled ? 'Activée' : 'Désactivée'}</div>
          </div>
          {!setup && !disabling && (
            <button
              type="button"
              disabled={busy}
              className={outlineBtn}
              onClick={user.totpEnabled ? () => setDisabling(true) : startSetup}
            >
              {user.totpEnabled ? 'Désactiver' : 'Configurer'}
            </button>
          )}
        </div>

        {setup && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-[var(--text-primary)]">
              1. Scanne ce QR code avec ton application, ou saisis la clé à la main.
            </p>
            <div className="inline-block bg-white p-3 rounded-lg">
              <QRCodeSVG value={setup.uri} size={160} />
            </div>
            <p className="text-sm break-all font-mono text-[var(--text-primary)]">{setup.secret}</p>
            <p className="text-sm text-[var(--text-primary)]">2. Entre le code à 6 chiffres affiché pour confirmer.</p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="Code à 6 chiffres"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={`${inputClass} max-w-[160px]`}
                placeholder="123456"
              />
              <button type="button" disabled={busy || code.length !== 6} onClick={enable} className={primaryBtn}>
                Activer
              </button>
              <button
                type="button"
                onClick={() => {
                  setSetup(null);
                  setCode('');
                }}
                className={outlineBtn}
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {disabling && (
          <div className="mt-4 space-y-3">
            <input
              type="password"
              aria-label="Mot de passe"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
            />
            <input
              type="text"
              inputMode="numeric"
              aria-label="Code à 6 chiffres"
              placeholder="Code à 6 chiffres"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={inputClass}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || !password || code.length !== 6}
                onClick={disable}
                className={primaryBtn}
              >
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => {
                  setDisabling(false);
                  setPassword('');
                  setCode('');
                }}
                className={outlineBtn}
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
      <Feedback ok={ok} error={error} />

      <h2 className="font-extrabold text-xl mt-8 mb-2">Appareils connectés</h2>
      <div className="border border-[var(--border-color)] rounded-xl overflow-hidden">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="px-4 py-3 border-b last:border-b-0 border-[var(--border-color)] flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-sm text-[var(--text-primary)] truncate">{s.userAgent || 'Appareil inconnu'}</div>
              <div className="text-xs text-[var(--text-secondary)]">
                Connecté le {fullDate(s.createdAt)}
                {s.current && ' · cet appareil'}
              </div>
            </div>
            {!s.current && (
              <button type="button" disabled={busy} onClick={() => revoke(s.id)} className={outlineBtn}>
                Déconnecter
              </button>
            )}
          </div>
        ))}
      </div>
      {sessions.length > 1 && (
        <button type="button" disabled={busy} onClick={revokeOthers} className={`${outlineBtn} mt-3`}>
          Déconnecter tous les autres appareils
        </button>
      )}
    </div>
  );
}

/* ── Affichage ──────────────────────────────────────────────────────────────── */

function DisplayTab() {
  const { preference, setPreference } = useTheme();
  const options: { id: ThemePreference; label: string }[] = [
    { id: 'dark', label: 'Sombre' },
    { id: 'light', label: 'Clair' },
    { id: 'system', label: "Automatique (selon l'appareil)" },
  ];
  return (
    <div>
      <h2 className="font-extrabold text-xl mb-2">Affichage</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Choisis le thème de Wouaff.</p>
      <div
        role="radiogroup"
        aria-label="Thème"
        className="border border-[var(--border-color)] rounded-xl overflow-hidden"
      >
        {options.map((o) => (
          <label
            key={o.id}
            className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-tertiary)]"
          >
            <input
              type="radio"
              name="theme"
              checked={preference === o.id}
              onChange={() => setPreference(o.id)}
              className="accent-[var(--accent)]"
            />
            <span className="text-[var(--text-primary)]">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ── Confidentialité & données ──────────────────────────────────────────────── */

interface BlockedUser {
  uid: string;
  pseudo: string;
  displayName: string | null;
  avatar: string | null;
}

function PrivacyTab() {
  const { user, logout } = useAuth();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadBlocked = useCallback(async () => {
    try {
      setBlocked(await api.get<BlockedUser[]>('/blocks'));
    } catch {
      setBlocked([]);
    }
  }, []);

  useEffect(() => {
    loadBlocked();
  }, [loadBlocked]);

  const unblock = async (pseudo: string) => {
    try {
      await api.post(`/blocks/${pseudo}`);
      await loadBlocked();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const exportData = async () => {
    setExporting(true);
    setError('');
    try {
      const data = await api.get<unknown>('/auth/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wouaff-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err));
    }
    setExporting(false);
  };

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.del('/auth/account', { password, code: code || undefined });
      await logout();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="font-extrabold text-xl mb-2">Comptes bloqués</h2>
      <div className="border border-[var(--border-color)] rounded-xl overflow-hidden mb-8">
        {blocked.length === 0 && (
          <p className="px-4 py-4 text-sm text-[var(--text-secondary)]">Tu n'as bloqué personne.</p>
        )}
        {blocked.map((b) => (
          <div
            key={b.uid}
            className="px-4 py-3 border-b last:border-b-0 border-[var(--border-color)] flex items-center gap-3"
          >
            <Avatar src={b.avatar} name={b.pseudo} />
            <Link to={`/${b.pseudo}`} className="flex-1 min-w-0 truncate font-bold text-[var(--text-primary)]">
              @{b.pseudo}
            </Link>
            <button type="button" onClick={() => unblock(b.pseudo)} className={outlineBtn}>
              Débloquer
            </button>
          </div>
        ))}
      </div>

      <h2 className="font-extrabold text-xl mb-2">Tes données</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Télécharge une copie de tout ce que Wouaff conserve sur toi (profil, posts, commentaires, abonnements,
        sessions…).
      </p>
      <button type="button" onClick={exportData} disabled={exporting} className={outlineBtn}>
        {exporting ? '…' : 'Exporter mes données'}
      </button>

      <h2 className="font-extrabold text-xl mt-10 mb-2 text-[var(--danger)]">Supprimer mon compte</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Suppression définitive de ton profil, de tes posts, commentaires, likes et abonnements. Cette action est
        irréversible.
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="px-4 py-1.5 rounded-full border border-[var(--danger)] text-[var(--danger)] font-bold text-sm hover:bg-[var(--danger)]/10"
        >
          Supprimer mon compte…
        </button>
      ) : (
        <form onSubmit={deleteAccount} className="space-y-3 border border-[var(--danger)]/40 rounded-xl p-4">
          <p className="text-sm text-[var(--text-primary)]">
            Pour confirmer, saisis ton mot de passe{user?.totpEnabled ? ' et un code de ton application' : ''}.
          </p>
          <input
            type="password"
            aria-label="Mot de passe"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            autoComplete="current-password"
            required
          />
          {user?.totpEnabled && (
            <input
              type="text"
              inputMode="numeric"
              aria-label="Code à 6 chiffres"
              placeholder="Code à 6 chiffres"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={inputClass}
              required
            />
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="bg-[var(--danger)] text-white font-bold rounded-full px-6 py-2.5 disabled:opacity-50"
            >
              {busy ? '…' : 'Supprimer définitivement'}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setPassword('');
                setCode('');
              }}
              className={outlineBtn}
            >
              Annuler
            </button>
          </div>
        </form>
      )}
      <div className="mt-4">
        <Feedback error={error} />
      </div>
    </div>
  );
}
