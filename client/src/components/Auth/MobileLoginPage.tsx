import { IonContent, IonPage } from '@ionic/react';
import { Check, ChevronLeft, KeyRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCap } from '../../hooks/useCap';
import { login, register } from '../../services/auth';
import {
  browserSupportsWebAuthn,
  isPasskeyResult,
  passkeys as passkeysAPI,
  type TwoFactorMethods,
  twoFactor as twoFactorAPI,
} from '../../services/security';

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePseudo(pseudo: string) {
  return pseudo.length >= 3 && pseudo.length <= 20 && /^[a-z0-9_]+$/.test(pseudo);
}

function getPasswordReqs(password: string) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*]/.test(password),
  };
}

const inputCls =
  'w-full h-[52px] bg-[var(--bg-input)] border border-[var(--border)] rounded-[14px] px-4 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none font-sans transition-colors focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-glow)]';
const primaryBtnCls =
  'w-full h-[52px] bg-brand-dark text-white px-6 rounded-full font-black text-[15px] border-none cursor-pointer font-sans hover:bg-[#c75a24] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2';
const ghostBtnCls =
  'w-full h-[52px] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] px-6 rounded-full font-bold text-[15px] cursor-pointer font-sans hover:border-[var(--brand)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2';
const labelCls = 'block text-[13px] font-bold text-[var(--text-secondary)] mb-1.5';
const pillActive = 'bg-brand-dark text-white';
const pillIdle = 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-primary)]';

export default function MobileLoginPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const cap = useCap('register');

  const [twoFactor, setTwoFactor] = useState<{ loginChallenge: string; methods: TwoFactorMethods } | null>(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFAMethod, setTwoFAMethod] = useState<'totp' | 'email' | 'recovery'>('totp');
  const [twoFAInfo, setTwoFAInfo] = useState('');
  const [sending2FA, setSending2FA] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const canPasskey = browserSupportsWebAuthn();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const pwReqs = getPasswordReqs(password);
  const pwValid = Object.values(pwReqs).every((v) => v);

  const finishLogin = useCallback(async () => {
    await refresh();
    cap.reset();
    requestAnimationFrame(() => navigate('/'));
  }, [navigate, refresh, cap]);

  const enter2FA = useCallback((data: { loginChallenge: string; twoFactorMethods: TwoFactorMethods }) => {
    setTwoFactor({ loginChallenge: data.loginChallenge, methods: data.twoFactorMethods });
    setTwoFAMethod(data.twoFactorMethods.totp ? 'totp' : data.twoFactorMethods.email ? 'email' : 'recovery');
    setTwoFACode('');
    setError('');
  }, []);

  const handleSubmit = useCallback(
    async (e: React.SyntheticEvent) => {
      e.preventDefault();
      setError('');
      if (!email || !validateEmail(email)) {
        setError("L'adresse email n'est pas valide.");
        return;
      }
      if (!password) {
        setError('Mot de passe obligatoire.');
        return;
      }
      if (isRegister) {
        if (!validatePseudo(pseudo)) {
          setError('Le pseudo doit contenir 3-20 caractères en minuscules (a-z, chiffres et _).');
          return;
        }
        if (password !== confirmPassword) {
          setError('Les mots de passe ne correspondent pas.');
          return;
        }
        if (!pwValid) {
          setError('Le mot de passe ne respecte pas les exigences de sécurité.');
          return;
        }
        if (cap.required && !cap.token) {
          setError('Veuillez confirmer que vous êtes humain.');
          return;
        }
      }
      setIsLoading(true);
      try {
        if (isRegister) {
          await register(email, password, pseudo, cap.token);
        } else {
          const data = await login(email, password);
          if (isPasskeyResult(data)) {
            enter2FA(data);
            setIsLoading(false);
            return;
          }
        }
        await finishLogin();
      } catch (err: unknown) {
        setError((err as Error).message || "Une erreur s'est produite");
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, pseudo, confirmPassword, isRegister, pwValid, cap, enter2FA, finishLogin],
  );

  const handleSendEmail2FA = useCallback(async () => {
    if (!twoFactor) return;
    setSending2FA(true);
    setTwoFAInfo('');
    setError('');
    try {
      await twoFactorAPI.sendEmail(twoFactor.loginChallenge);
      setTwoFAInfo('Code envoyé par email.');
    } catch (err: unknown) {
      setError((err as Error).message || "Impossible d'envoyer le code");
    } finally {
      setSending2FA(false);
    }
  }, [twoFactor]);

  const handleSubmit2FA = useCallback(
    async (e: React.SyntheticEvent) => {
      e.preventDefault();
      if (!twoFactor) return;
      setError('');
      setTwoFAInfo('');
      setSending2FA(true);
      try {
        const data = await twoFactorAPI.verify(twoFactor.loginChallenge, twoFACode, twoFAMethod);
        if (!isPasskeyResult(data)) {
          setTwoFactor(null);
          await finishLogin();
        }
      } catch (err: unknown) {
        setError((err as Error).message || 'Code invalide');
      } finally {
        setSending2FA(false);
      }
    },
    [twoFactor, twoFACode, twoFAMethod, finishLogin],
  );

  const handlePasskeyLogin = useCallback(async () => {
    setPasskeyBusy(true);
    setError('');
    try {
      const data = await passkeysAPI.login(email || undefined);
      if (isPasskeyResult(data)) {
        enter2FA(data);
        return;
      }
      await finishLogin();
    } catch (err: unknown) {
      setError((err as Error).message || "Échec de la connexion par clé d'accès");
    } finally {
      setPasskeyBusy(false);
    }
  }, [email, enter2FA, finishLogin]);

  const toggleMode = () => {
    setIsRegister((r) => !r);
    setError('');
    setPseudo('');
    setConfirmPassword('');
  };

  const twoFAMethods = twoFactor?.methods;

  return (
    <IonPage className="mobile-login">
      <IonContent className="mobile-login-content">
        <div className="min-h-full flex flex-col px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-[max(env(safe-area-inset-bottom,0px),24px)]">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-12 h-12 rounded-xl" />
            <div>
              <div className="text-xl font-black text-[var(--text-primary)] leading-tight">Wouaff</div>
              <div className="text-[13px] text-[var(--text-muted)]">Le réseau social français 🐺</div>
            </div>
          </div>

          {twoFactor ? (
            /* ── Étape 2FA ── */
            <form onSubmit={handleSubmit2FA} className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => {
                  setTwoFactor(null);
                  setTwoFACode('');
                  setError('');
                  setTwoFAInfo('');
                }}
                className="flex items-center gap-1 border-none bg-transparent p-0 text-[13px] font-bold text-[var(--text-muted)] cursor-pointer"
              >
                <ChevronLeft size={16} /> Retour à la connexion
              </button>

              <div className="mb-2">
                <h2 className="text-[24px] font-black m-0 text-[var(--text-primary)] tracking-[-0.02em]">
                  Double authentification
                </h2>
                <p className="text-[14px] text-[var(--text-muted)] mt-1 m-0">
                  Saisis le code de vérification pour valider ta connexion.
                </p>
              </div>

              <div className="flex gap-2">
                {twoFAMethods?.totp && (
                  <button
                    type="button"
                    onClick={() => {
                      setTwoFAMethod('totp');
                      setTwoFACode('');
                    }}
                    className={`flex-1 py-2.5 rounded-full text-[14px] font-bold border-none cursor-pointer font-sans transition-colors ${
                      twoFAMethod === 'totp' ? pillActive : pillIdle
                    }`}
                  >
                    Application
                  </button>
                )}
                {twoFAMethods?.email && (
                  <button
                    type="button"
                    onClick={() => {
                      setTwoFAMethod('email');
                      setTwoFACode('');
                    }}
                    className={`flex-1 py-2.5 rounded-full text-[14px] font-bold border-none cursor-pointer font-sans transition-colors ${
                      twoFAMethod === 'email' ? pillActive : pillIdle
                    }`}
                  >
                    Email
                  </button>
                )}
                {twoFAMethods?.recovery && (
                  <button
                    type="button"
                    onClick={() => {
                      setTwoFAMethod('recovery');
                      setTwoFACode('');
                    }}
                    className={`flex-1 py-2.5 rounded-full text-[14px] font-bold border-none cursor-pointer font-sans transition-colors ${
                      twoFAMethod === 'recovery' ? pillActive : pillIdle
                    }`}
                  >
                    Récupération
                  </button>
                )}
              </div>

              <div>
                <label htmlFor="twofaCode" className={labelCls}>
                  {twoFAMethod === 'recovery'
                    ? 'Code de récupération'
                    : twoFAMethod === 'email'
                      ? 'Code reçu par email'
                      : 'Code de l’application'}
                </label>
                <input
                  id="twofaCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value)}
                  className={`${inputCls} text-center tracking-[0.2em]`}
                />
              </div>

              {twoFAMethod === 'email' && (
                <button
                  type="button"
                  onClick={handleSendEmail2FA}
                  disabled={sending2FA}
                  className="w-full h-[48px] rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] text-[14px] font-bold cursor-pointer font-sans hover:border-[var(--brand)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sending2FA ? 'Envoi...' : 'Envoyer le code par email'}
                </button>
              )}

              {twoFAInfo && (
                <div className="text-sm text-[#5fd38d] bg-[#173c2a]/40 border border-[#3ca66a]/40 rounded-[12px] px-4 py-3">
                  {twoFAInfo}
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="border border-red-500/40 bg-red-500/10 rounded-[12px] px-4 py-3 text-sm text-red-400"
                >
                  {error}
                </div>
              )}

              <button type="submit" disabled={sending2FA || twoFACode.length < 4} className={primaryBtnCls}>
                {sending2FA ? 'Vérification...' : 'Vérifier'}
              </button>
            </form>
          ) : (
            /* ── Formulaire login / register ── */
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="mb-1">
                <h2 className="text-[24px] font-black m-0 text-[var(--text-primary)] tracking-[-0.02em]">
                  {isRegister ? 'Créer un compte' : 'Rejoins la communauté'}
                </h2>
                <p className="text-[14px] text-[var(--text-muted)] mt-1 m-0">
                  {isRegister ? 'Inscris-toi en 30 secondes' : 'Connecte-toi pour continuer'}
                </p>
              </div>

              {/* Sélecteur mode */}
              <div className="flex bg-[var(--bg-input)] border border-[var(--border)] rounded-full p-1">
                {(
                  [
                    ['login', 'Connexion', false],
                    ['register', 'Inscription', true],
                  ] as const
                ).map(([id, label, isReg]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleMode()}
                    className={`flex-1 py-2.5 rounded-full border-none cursor-pointer font-sans text-[14px] font-bold transition-colors ${
                      isRegister === isReg ? 'bg-brand-dark text-white' : 'bg-transparent text-[var(--text-muted)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {isRegister && (
                <div>
                  <label htmlFor="m-pseudo" className={labelCls}>
                    Pseudo
                  </label>
                  <input
                    id="m-pseudo"
                    type="text"
                    placeholder="Ton pseudo"
                    maxLength={20}
                    value={pseudo}
                    onChange={(e) => setPseudo(e.target.value)}
                    autoComplete="username"
                    className={inputCls}
                  />
                </div>
              )}

              <div>
                <label htmlFor="m-email" className={labelCls}>
                  Adresse email
                </label>
                <input
                  id="m-email"
                  type="email"
                  inputMode="email"
                  placeholder="nom@exemple.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={inputCls}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="m-password" className={labelCls}>
                    Mot de passe
                  </label>
                  {isRegister && (
                    <button
                      type="button"
                      className="border-none bg-transparent p-0 text-[12px] font-bold text-brand cursor-pointer"
                      onClick={() => {
                        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
                        const values = crypto.getRandomValues(new Uint32Array(12));
                        const generated = `Aa7!${Array.from(values, (v) => chars[v % chars.length]).join('')}a7!`;
                        setPassword(generated);
                        setConfirmPassword(generated);
                      }}
                    >
                      Générer
                    </button>
                  )}
                </div>
                <input
                  id="m-password"
                  type="password"
                  placeholder={isRegister ? 'Min. 8 caractères, majuscule, chiffre, symbole' : 'Ton mot de passe'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  className={inputCls}
                />
              </div>

              {isRegister && (
                <div>
                  <label htmlFor="m-confirm" className={labelCls}>
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="m-confirm"
                    type="password"
                    placeholder="Confirmer le mot de passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className={inputCls}
                  />
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 list-none p-0 mt-2.5 mb-0">
                    {[
                      ['8 caractères', pwReqs.length],
                      ['Une majuscule', pwReqs.uppercase],
                      ['Un chiffre', pwReqs.number],
                      ['Un symbole', pwReqs.special],
                    ].map(([label, valid]) => (
                      <li
                        key={String(label)}
                        className={`flex items-center gap-1.5 text-[11px] ${valid ? 'text-[#5fd38d]' : 'text-[var(--text-muted)] opacity-50'}`}
                      >
                        <span
                          className={`flex h-[14px] w-[14px] flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                            valid ? 'border-[#3ca66a] bg-[#173c2a]' : 'border-[#66717d] bg-[#66717d]/20'
                          }`}
                        >
                          {valid && <Check size={9} strokeWidth={3} />}
                        </span>
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!isRegister && (
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="self-end border-none bg-transparent p-0 text-[13px] font-bold text-[var(--text-muted)] cursor-pointer hover:text-brand transition-colors -mt-1"
                >
                  Mot de passe oublié ?
                </button>
              )}

              {isRegister && <div className="flex justify-center">{cap.widget}</div>}

              {error && (
                <div
                  role="alert"
                  className="border border-red-500/40 bg-red-500/10 rounded-[12px] px-4 py-3 text-sm text-red-400"
                >
                  {error}
                </div>
              )}

              <button type="submit" disabled={isLoading} className={primaryBtnCls}>
                {isLoading
                  ? isRegister
                    ? 'Création...'
                    : 'Connexion...'
                  : isRegister
                    ? 'Créer le compte'
                    : 'Se connecter'}
              </button>

              {!isRegister && canPasskey && (
                <button type="button" onClick={handlePasskeyLogin} disabled={passkeyBusy} className={ghostBtnCls}>
                  <KeyRound size={18} />
                  {passkeyBusy ? 'Vérification...' : 'Se connecter avec une clé d’accès'}
                </button>
              )}

              <div className="text-center text-sm mt-2">
                <span className="text-[var(--text-muted)]">{isRegister ? 'Déjà un compte ?' : 'Pas de compte ?'}</span>
                <button
                  type="button"
                  className="bg-transparent border-none text-brand font-bold cursor-pointer text-sm ml-1 font-sans hover:underline"
                  onClick={toggleMode}
                >
                  {isRegister ? 'Connecte-toi' : 'Inscris-toi'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-auto pt-8 text-center text-[12px] text-[var(--text-muted)]">
            🇫🇷 Hébergé en France · Zéro log · RGPD &amp; lois européennes
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
