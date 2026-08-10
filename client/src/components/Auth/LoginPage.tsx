import { Lock, MapPin, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { login, register } from '../../services/auth';

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

const FEATURES = [
  { icon: MapPin, label: 'Hébergé en France', desc: 'Aucune donnée ne quitte le territoire' },
  { icon: ShieldCheck, label: 'RGPD & lois européennes', desc: 'Vos données sont protégées' },
  { icon: Lock, label: 'Politique zéro log', desc: 'Nous ne traçons pas vos activités' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const pwReqs = getPasswordReqs(password);
  const pwValid = Object.values(pwReqs).every((v) => v);

  const handleSubmit = useCallback(
    async (e: React.SyntheticEvent) => {
      e.preventDefault();
      setError('');

      if (!email) {
        setError('Email obligatoire.');
        return;
      }
      if (!validateEmail(email)) {
        setError("L'adresse email n'est pas valide.");
        return;
      }
      if (!password) {
        setError('Mot de passe obligatoire.');
        return;
      }

      if (isRegister) {
        if (!pseudo) {
          setError('Pseudo obligatoire.');
          return;
        }
        if (!validatePseudo(pseudo)) {
          setError('Le pseudo doit contenir 3-20 caractères en minuscules (a-z, chiffres et _).');
          return;
        }
        if (!confirmPassword) {
          setError('Confirmation du mot de passe obligatoire.');
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
      }

      setIsLoading(true);
      try {
        if (isRegister) {
          await register(email, password, pseudo);
        } else {
          await login(email, password);
        }
        await refresh();
        requestAnimationFrame(() => navigate('/'));
      } catch (err: unknown) {
        setError((err as Error).message || "Une erreur s'est produite");
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, pseudo, confirmPassword, isRegister, pwValid, navigate, refresh],
  );

  const toggleMode = () => {
    setIsRegister((r) => !r);
    setError('');
    setPseudo('');
    setConfirmPassword('');
  };

  return (
    <div className="flex min-h-dvh bg-[var(--bg-deep)]">
      {/* ── Panneau branding (desktop) ── */}
      <div className="hidden lg:flex flex-col justify-between flex-1 relative overflow-hidden p-12 border-r border-[var(--border)]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'var(--auth-bg-image)' }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-brand-dark/70 via-[var(--bg-deep)]/80 to-[var(--bg-deep)]"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center gap-3">
          <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-11 h-11 rounded-xl" />
          <span className="text-2xl font-black text-white tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
            Wouaff
          </span>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-black leading-tight text-white m-0 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            Le premier réseau social <span className="text-brand-light">français</span> et{' '}
            <span className="text-brand-light">souverain</span>.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/80 m-0">
            Conçu en France, hébergé en France, pour les Français. Vos données restent chez vous.
          </p>
          <div className="mt-8 flex flex-col gap-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-[8px] flex items-center justify-center flex-shrink-0">
                    <Icon size={19} className="text-brand-light" />
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-white">{f.label}</div>
                    <div className="text-[13px] text-white/70">{f.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 text-[13px] text-white/60">
          Wouaff · Fait en France 🇫🇷 · Respectueux du RGPD et des lois européennes
        </div>
      </div>

      {/* ── Formulaire ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 bg-[var(--bg-base)]">
        <div className="w-full max-w-md animate-[fadeIn_0.4s_ease]">
          <div className="text-center mb-6 lg:hidden">
            <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-16 h-16 mx-auto mb-3" />
            <h1 className="text-2xl font-black m-0 text-[var(--text-primary)]">Wouaff</h1>
            <p className="text-[var(--text-secondary)] text-sm mt-1 m-0">Le réseau social français et souverain 🐺</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_8px_32px_rgba(0,0,0,0.25)] p-8 w-full">
            <div className="text-center mb-6">
              <h2 className="text-xl font-extrabold m-0 text-[var(--text-primary)]">
                {isRegister ? 'Créer un compte' : 'Rejoins la communauté'}
              </h2>
              <p className="text-[var(--text-secondary)] text-sm mt-1.5 m-0">
                {isRegister ? 'Inscris-toi en 30 secondes' : 'Connecte-toi pour continuer'}
              </p>
            </div>

            <div className="mb-4">
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                className="w-full bg-[var(--bg-input)] rounded-xl px-4 py-3.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--brand)] font-sans transition-all duration-200 border border-transparent focus:border-[var(--brand)]"
              />
            </div>

            {isRegister && (
              <div className="mb-4">
                <label htmlFor="pseudo" className="sr-only">
                  Pseudo
                </label>
                <input
                  id="pseudo"
                  type="text"
                  inputMode="text"
                  placeholder="Pseudo"
                  maxLength={20}
                  value={pseudo}
                  onChange={(e) => setPseudo(e.target.value)}
                  autoComplete="username"
                  onFocus={(e) =>
                    setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
                  }
                  className="w-full bg-[var(--bg-input)] rounded-xl px-4 py-3.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--brand)] font-sans transition-all duration-200 border border-transparent focus:border-[var(--brand)]"
                />
              </div>
            )}

            <div className="mb-4">
              <div className="relative">
                <label htmlFor="password" className="sr-only">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  inputMode="text"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  onFocus={(e) =>
                    setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
                  }
                  className="w-full bg-[var(--bg-input)] rounded-xl px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--brand)] font-sans transition-all duration-200 border border-transparent focus:border-[var(--brand)]"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
              {isRegister && (
                <div className="text-xs mt-2">
                  <ul className="list-none p-0 m-0">
                    <li className={pwReqs.length ? 'text-green-500' : 'text-[var(--text-muted)]'}>
                      Au moins 8 caractères
                    </li>
                    <li className={pwReqs.uppercase ? 'text-green-500' : 'text-[var(--text-muted)]'}>Une majuscule</li>
                    <li className={pwReqs.lowercase ? 'text-green-500' : 'text-[var(--text-muted)]'}>Une minuscule</li>
                    <li className={pwReqs.number ? 'text-green-500' : 'text-[var(--text-muted)]'}>Un chiffre</li>
                    <li className={pwReqs.special ? 'text-green-500' : 'text-[var(--text-muted)]'}>
                      Un caractère spécial
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {isRegister && (
              <div className="mb-4">
                <div className="relative">
                  <label htmlFor="confirmPassword" className="sr-only">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    inputMode="text"
                    placeholder="Confirmer le mot de passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    onFocus={(e) =>
                      setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
                    }
                    className="w-full bg-[var(--bg-input)] rounded-xl px-4 py-3.5 pr-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--brand)] font-sans transition-all duration-200 border border-transparent focus:border-[var(--brand)]"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {showConfirmPassword ? (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      ) : (
                        <>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {!isRegister && (
              <div className="text-right mb-4">
                <a
                  href="/forgot-password"
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs no-underline transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/forgot-password');
                  }}
                >
                  Mot de passe oublié ?
                </a>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="bg-red-500/15 rounded-lg px-4 py-3 mb-4 text-sm text-red-400 animate-[shake_0.3s_ease-in-out]"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-brand text-white px-6 py-3.5 rounded-xl font-bold text-sm border-none cursor-pointer font-sans hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading
                ? isRegister
                  ? 'Création...'
                  : 'Connexion...'
                : isRegister
                  ? 'Créer le compte'
                  : 'Se connecter'}
            </button>

            <div className="text-center text-sm mt-6">
              <span className="text-[var(--text-muted)]">{isRegister ? 'Déjà un compte ?' : 'Pas de compte ?'}</span>
              <button
                type="button"
                className="bg-transparent border-none text-brand font-bold cursor-pointer text-sm ml-1 font-sans hover:underline"
                onClick={toggleMode}
              >
                {isRegister ? 'Connecte-toi' : 'Inscris-toi'}
              </button>
            </div>
          </div>

          <div className="hidden lg:flex items-center justify-center gap-1.5 mt-6 text-[12px] text-[var(--text-muted)]">
            <span>🇫🇷</span>
            <span>Hébergé en France · Zéro log · RGPD &amp; lois européennes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
