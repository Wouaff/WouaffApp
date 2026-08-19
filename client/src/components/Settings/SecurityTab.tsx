import { Check, Copy, KeyRound, Loader2, Mail, QrCode, ShieldCheck, Trash2, X } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useCallback, useEffect, useState } from 'react';
import { passkeys as passkeysAPI, type SecurityStatus, twoFactor as twoFactorAPI } from '../../services/security';
import { showToast } from '../Common/Toast';

const cardCls =
  'rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5 mb-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]';
const sectionTitleCls = 'flex items-center gap-2.5 text-[12px] font-extrabold uppercase tracking-wider text-brand mb-4';
const iconBadgeCls =
  'w-7 h-7 rounded-lg bg-[var(--brand-glow)] text-brand flex items-center justify-center flex-shrink-0';
const labelCls = 'block text-[13px] font-bold text-[var(--text-primary)] mb-1.5';
const inputCls =
  'w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-glow)] font-sans transition-all duration-200';
const hintCls = 'flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] mt-1.5';
const primaryBtnCls =
  'flex items-center justify-center gap-2 w-full rounded-full bg-brand-dark text-white font-bold text-sm py-3 cursor-pointer border-none hover:bg-[#c75a24] transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const ghostBtnCls =
  'flex items-center justify-center gap-2 w-full rounded-full border border-[var(--border)] bg-transparent text-[var(--text-secondary)] font-bold text-sm py-3 cursor-pointer hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

type ConfirmAction = 'email-enable' | 'email-disable' | 'totp-disable' | 'recovery' | null;

export default function SecurityTab() {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const [confirm, setConfirm] = useState<{
    action: Exclude<ConfirmAction, null>;
    title: string;
    description: string;
  } | null>(null);
  const [password, setPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');

  const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');

  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [passkeyName, setPasskeyName] = useState('');
  const [addingPasskey, setAddingPasskey] = useState(false);

  const reload = useCallback(async () => {
    try {
      const data = await twoFactorAPI.status();
      setStatus(data);
    } catch (err: unknown) {
      showToast((err as Error).message || 'Impossible de charger la sécurité', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const copyCodes = async () => {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      showToast('Codes copiés', 'success');
    } catch {
      showToast('Impossible de copier', 'error');
    }
  };

  const runConfirm = async () => {
    if (!confirm || !password) return;
    setPwBusy(true);
    setPwError('');
    try {
      if (confirm.action === 'email-enable') {
        const res = await twoFactorAPI.enableEmail(password, true);
        if (res.newRecoveryCodes) setRecoveryCodes(res.newRecoveryCodes);
        showToast('2FA par email activée', 'success');
      } else if (confirm.action === 'email-disable') {
        await twoFactorAPI.enableEmail(password, false);
        showToast('2FA par email désactivée', 'success');
      } else if (confirm.action === 'totp-disable') {
        await twoFactorAPI.disableTotp(password);
        setTotpSetup(null);
        showToast('Application d’authentification désactivée', 'success');
      } else if (confirm.action === 'recovery') {
        const res = await twoFactorAPI.generateRecovery(password);
        setRecoveryCodes(res.recoveryCodes);
        showToast('Codes de récupération générés', 'success');
      }
      setConfirm(null);
      setPassword('');
      await reload();
    } catch (err: unknown) {
      setPwError((err as Error).message || 'Échec de l’opération');
    } finally {
      setPwBusy(false);
    }
  };

  const startTotp = async () => {
    try {
      const data = await twoFactorAPI.startTotpSetup();
      setTotpSetup(data);
      setTotpCode('');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Impossible de démarrer la configuration', 'error');
    }
  };

  const confirmTotp = async () => {
    if (!totpSetup || !totpCode || !password) {
      setPwError('Code et mot de passe requis');
      return;
    }
    setPwBusy(true);
    setPwError('');
    try {
      const res = await twoFactorAPI.confirmTotpSetup(totpCode, password);
      if (res.newRecoveryCodes) setRecoveryCodes(res.newRecoveryCodes);
      setTotpSetup(null);
      setPassword('');
      setTotpCode('');
      showToast('Application d’authentification activée', 'success');
      await reload();
    } catch (err: unknown) {
      setPwError((err as Error).message || 'Code invalide');
    } finally {
      setPwBusy(false);
    }
  };

  const addPasskey = async () => {
    setAddingPasskey(true);
    try {
      await passkeysAPI.register(passkeyName.trim() || 'Clé d’accès');
      setPasskeyName('');
      setAddingPasskey(false);
      showToast('Clé d’accès ajoutée', 'success');
      await reload();
    } catch (err: unknown) {
      setAddingPasskey(false);
      showToast((err as Error).message || 'Échec de l’ajout de la clé', 'error');
    }
  };

  const removePasskey = async (id: number, name: string) => {
    if (!window.confirm(`Supprimer la clé d’accès « ${name} » ?`)) return;
    try {
      await passkeysAPI.remove(id);
      showToast('Clé d’accès supprimée', 'success');
      await reload();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Échec de la suppression', 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex flex-col gap-4">
        <div className="h-24 rounded-2xl bg-[var(--bg-input)] animate-pulse" />
        <div className="h-24 rounded-2xl bg-[var(--bg-input)] animate-pulse" />
        <div className="h-24 rounded-2xl bg-[var(--bg-input)] animate-pulse" />
      </div>
    );
  }

  const email2FA = !!status?.email2faEnabled;
  const totpEnabled = !!status?.totpEnabled;
  const passkeyList = status?.passkeys ?? [];

  return (
    <div className="p-4">
      {/* ── 2FA par email ── */}
      <div className={cardCls}>
        <h3 className={sectionTitleCls}>
          <span className={iconBadgeCls}>
            <Mail size={14} />
          </span>
          2FA par email
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
          Un code de connexion à 6 chiffres t’est envoyé par email à chaque connexion.
        </p>
        {email2FA ? (
          <button
            type="button"
            onClick={() =>
              setConfirm({
                action: 'email-disable',
                title: 'Désactiver la 2FA par email',
                description: 'Saisis ton mot de passe pour confirmer.',
              })
            }
            className={ghostBtnCls}
          >
            Désactiver
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              setConfirm({
                action: 'email-enable',
                title: 'Activer la 2FA par email',
                description: 'Saisis ton mot de passe pour confirmer. Des codes de récupération seront générés.',
              })
            }
            className={primaryBtnCls}
          >
            <ShieldCheck size={16} /> Activer
          </button>
        )}
      </div>

      {/* ── Application d’authentification (TOTP) ── */}
      <div className={cardCls}>
        <h3 className={sectionTitleCls}>
          <span className={iconBadgeCls}>
            <QrCode size={14} />
          </span>
          Application d’authentification
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
          Utilise une application comme Google Authenticator, Authy ou 1Password pour générer un code à 6 chiffres.
        </p>

        {totpSetup ? (
          <div className="flex flex-col items-center text-center">
            <div className="rounded-2xl bg-white p-3 mb-3">
              <QRCodeCanvas value={totpSetup.otpauthUrl} size={180} marginSize={0} />
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] mb-2">
              Scanne ce QR code, ou saisis manuellement cette clé :
            </p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  .writeText(totpSetup.secret)
                  .then(() => showToast('Clé copiée', 'success'))
                  .catch(() => showToast('Impossible de copier', 'error'));
              }}
              className="flex items-center gap-2 text-[12px] font-mono text-[var(--text-primary)] bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2 mb-4 cursor-pointer hover:border-[var(--brand)] transition-colors"
            >
              {totpSetup.secret} <Copy size={12} />
            </button>
            <label htmlFor="totpCode" className={`${labelCls} w-full text-left`}>
              Code à 6 chiffres
            </label>
            <input
              id="totpCode"
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className={`${inputCls} text-center tracking-[0.2em] mb-3`}
            />
            <label htmlFor="totpPassword" className={`${labelCls} w-full text-left`}>
              Ton mot de passe
            </label>
            <input
              id="totpPassword"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} mb-4`}
            />
            {pwError && (
              <div className="w-full mb-4 border border-red-500/40 bg-red-500/10 rounded-xl px-3 py-2 text-[13px] text-[var(--danger)]">
                {pwError}
              </div>
            )}
            <div className="flex gap-2 w-full">
              <button type="button" onClick={() => setTotpSetup(null)} className={ghostBtnCls} disabled={pwBusy}>
                Annuler
              </button>
              <button type="button" onClick={confirmTotp} disabled={pwBusy || !totpCode} className={primaryBtnCls}>
                {pwBusy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Valider
              </button>
            </div>
          </div>
        ) : totpEnabled ? (
          <button
            type="button"
            onClick={() =>
              setConfirm({
                action: 'totp-disable',
                title: 'Désactiver l’application d’authentification',
                description: 'Saisis ton mot de passe pour confirmer.',
              })
            }
            className={ghostBtnCls}
          >
            Désactiver
          </button>
        ) : (
          <button type="button" onClick={startTotp} className={primaryBtnCls}>
            <QrCode size={16} /> Configurer
          </button>
        )}
      </div>

      {/* ── Codes de récupération ── */}
      <div className={cardCls}>
        <h3 className={sectionTitleCls}>
          <span className={iconBadgeCls}>
            <KeyRound size={14} />
          </span>
          Codes de récupération
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
          Utilise ces codes à usage unique pour te connecter si tu perds l’accès à ton application et ta boîte mail.{' '}
          {status?.recoveryCodesGenerated ? 'Tu en possèdes déjà — tu peux les régénérer.' : ''}
        </p>
        <button
          type="button"
          onClick={() =>
            setConfirm({
              action: 'recovery',
              title: status?.recoveryCodesGenerated
                ? 'Régénérer les codes de récupération'
                : 'Générer les codes de récupération',
              description: 'Les anciens codes seront invalidés immédiatement.',
            })
          }
          className={primaryBtnCls}
        >
          <KeyRound size={16} /> {status?.recoveryCodesGenerated ? 'Régénérer les codes' : 'Générer les codes'}
        </button>
        <div className={hintCls}>
          <ShieldCheck size={12} /> Stocke-les dans un endroit sûr (gestionnaire de mots de passe, papier…)
        </div>
      </div>

      {/* ── Clés d’accès (passkeys) ── */}
      <div className={cardCls}>
        <h3 className={sectionTitleCls}>
          <span className={iconBadgeCls}>
            <KeyRound size={14} />
          </span>
          Clés d’accès
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
          Connecte-toi sans mot de passe grâce à ton empreinte, ton visage ou un dispositif de sécurité (FIDO2).
        </p>

        {passkeyList.length > 0 && (
          <ul className="list-none p-0 m-0 mb-4 flex flex-col gap-2">
            {passkeyList.map((k) => (
              <li
                key={k.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)]/50 px-3 py-2.5"
              >
                <KeyRound size={16} className="text-[var(--text-muted)] flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-[var(--text-primary)] truncate">{k.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Ajoutée le {new Date(k.createdAt).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Supprimer ${k.name}`}
                  onClick={() => removePasskey(k.id, k.name)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border-none bg-transparent text-[var(--text-muted)] cursor-pointer hover:text-[var(--danger)] hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {addingPasskey ? (
          <div className="flex flex-col gap-2.5">
            <label htmlFor="passkeyName" className={labelCls}>
              Nom de la clé
            </label>
            <input
              id="passkeyName"
              type="text"
              placeholder="Ex. iPhone de Léa"
              value={passkeyName}
              onChange={(e) => setPasskeyName(e.target.value)}
              className={inputCls}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setAddingPasskey(false)} className={ghostBtnCls}>
                Annuler
              </button>
              <button type="button" onClick={addPasskey} className={primaryBtnCls}>
                <KeyRound size={16} /> Ajouter la clé
              </button>
            </div>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">Ton appareil va te demander de t’authentifier.</p>
          </div>
        ) : (
          <button type="button" onClick={() => setAddingPasskey(true)} className={primaryBtnCls}>
            <KeyRound size={16} /> Ajouter une clé d’accès
          </button>
        )}
      </div>

      {/* ── Codes de récupération affichés ── */}
      {recoveryCodes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[16px] font-extrabold text-[var(--text-primary)] m-0">Codes de récupération</h3>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setRecoveryCodes(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border-none bg-transparent text-[var(--text-muted)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] mb-4">
              Chaque code est à usage unique.{' '}
              <strong className="text-[var(--text-primary)]">Conserve-les précieusement :</strong> ils ne seront plus
              jamais affichés.
            </p>
            <div className="grid grid-cols-1 gap-1.5 mb-4">
              {recoveryCodes.map((code) => (
                <div
                  key={code}
                  className="font-mono text-[14px] tracking-[0.08em] text-center text-[var(--text-primary)] bg-[var(--bg-input)] border border-[var(--border)] rounded-lg py-2"
                >
                  {code}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={copyCodes} className={ghostBtnCls}>
                <Copy size={16} /> Copier
              </button>
              <button type="button" onClick={() => setRecoveryCodes(null)} className={primaryBtnCls}>
                <Check size={16} /> J’ai noté mes codes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation par mot de passe ── */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h3 className="text-[16px] font-extrabold text-[var(--text-primary)] mb-1">{confirm.title}</h3>
            <p className="text-[13px] text-[var(--text-secondary)] mb-4">{confirm.description}</p>
            <label htmlFor="confirmPassword" className={labelCls}>
              Mot de passe
            </label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} mb-3`}
            />
            {pwError && (
              <div className="mb-3 border border-red-500/40 bg-red-500/10 rounded-xl px-3 py-2 text-[13px] text-[var(--danger)]">
                {pwError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirm(null);
                  setPassword('');
                  setPwError('');
                }}
                className={ghostBtnCls}
              >
                Annuler
              </button>
              <button type="button" onClick={runConfirm} disabled={pwBusy || !password} className={primaryBtnCls}>
                {pwBusy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
