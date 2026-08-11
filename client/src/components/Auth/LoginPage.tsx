import { Check, Lock, MapPin, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCap } from '../../hooks/useCap';
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

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const required = ['A', 'a', '7', '!'];
  const values = crypto.getRandomValues(new Uint32Array(12));
  const password = [...required, ...Array.from(values, (value) => chars[value % chars.length])];
  const order = crypto.getRandomValues(new Uint32Array(password.length));
  return password
    .map((char, index) => ({ char, order: order[index] }))
    .sort((a, b) => a.order - b.order)
    .map(({ char }) => char)
    .join('');
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
  const cap = useCap('register');

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
          await login(email, password);
        }
        await refresh();
        cap.reset();
        requestAnimationFrame(() => navigate('/'));
      } catch (err: unknown) {
        setError((err as Error).message || "Une erreur s'est produite");
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, pseudo, confirmPassword, isRegister, pwValid, navigate, refresh, cap],
  );

  const toggleMode = () => {
    setIsRegister((r) => !r);
    setError('');
    setPseudo('');
    setConfirmPassword('');
  };

  return (
    <div className="flex min-h-dvh bg-[var(--bg-deep)]">
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

      <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto bg-[#11151b] px-6 py-10 sm:px-12 lg:my-3 lg:mr-3 lg:rounded-l-[28px] lg:border-y lg:border-l lg:border-[#303742] lg:px-16">
        <div className="w-full max-w-[440px] animate-[fadeIn_0.4s_ease]">
          <div className="mb-10 lg:hidden">
            <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-14 h-14 mb-5" />
            <h1 className="text-2xl font-black m-0 text-white">Wouaff</h1>
            <p className="text-[#8b98a5] text-sm mt-1 m-0">Le réseau social français et souverain 🐺</p>
          </div>

          <div key={isRegister ? 'register' : 'login'} className="w-full animate-[authModeIn_0.28s_ease-out]">
            <div className="mb-9">
              <div className="hidden lg:flex items-center gap-3 mb-10">
                <span className="w-8 h-[3px] rounded-full bg-brand-dark" />
                <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#8b98a5]">Espace membre</span>
              </div>
              <h2 className="text-[32px] leading-tight font-black m-0 text-white tracking-[-0.02em]">
                {isRegister ? 'Créer un compte' : 'Rejoins la communauté'}
              </h2>
              <p className="text-[#8b98a5] text-[15px] mt-2 m-0">
                {isRegister ? 'Inscris-toi en 30 secondes' : 'Connecte-toi pour continuer'}
              </p>
            </div>

            <div className="mb-5">
              <label htmlFor="email" className="block text-[13px] font-bold text-[#d6d9db] mb-2">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                placeholder="nom@exemple.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                className="w-full h-[54px] bg-[#181d25] rounded-[10px] px-4 text-[15px] text-white placeholder-[#68717d] outline-none font-sans transition-colors border border-[#303742] hover:border-[#59626e] focus:border-[#a9562d]"
              />
            </div>

            {isRegister && (
              <div className="mb-5">
                <label htmlFor="pseudo" className="block text-[13px] font-bold text-[#d6d9db] mb-2">
                  Pseudo
                </label>
                <input
                  id="pseudo"
                  type="text"
                  inputMode="text"
                  placeholder="Ton pseudo"
                  maxLength={20}
                  value={pseudo}
                  onChange={(e) => setPseudo(e.target.value)}
                  autoComplete="username"
                  onFocus={(e) =>
                    setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
                  }
                  className="w-full h-[54px] bg-[#181d25] rounded-[10px] px-4 text-[15px] text-white placeholder-[#68717d] outline-none font-sans transition-colors border border-[#303742] hover:border-[#59626e] focus:border-[#a9562d]"
                />
              </div>
            )}

            <div className="mb-5">
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-[13px] font-bold text-[#d6d9db]">
                    Mot de passe
                  </label>
                  {isRegister && (
                    <button
                      type="button"
                      className="border-none bg-transparent p-0 text-[12px] font-bold text-brand cursor-pointer hover:text-brand-light transition-colors"
                      onClick={() => {
                        const generated = generatePassword();
                        setPassword(generated);
                        setConfirmPassword(generated);
                        setShowPassword(true);
                        setShowConfirmPassword(true);
                      }}
                    >
                      Générer un mot de passe
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  inputMode="text"
                  placeholder="Ton mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  onFocus={(e) =>
                    setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
                  }
                  className="w-full h-[54px] bg-[#181d25] rounded-[10px] px-4 pr-12 text-[15px] text-white placeholder-[#68717d] outline-none font-sans transition-colors border border-[#303742] hover:border-[#59626e] focus:border-[#a9562d]"
                />
                <button
                  type="button"
                  className="absolute right-4 bottom-[15px] bg-transparent border-none cursor-pointer p-1 text-[#71767b] hover:text-white transition-colors"
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
                <div className="mt-2">
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 list-none p-0 m-0">
                    {[
                      ['Au moins 8 caractères', pwReqs.length],
                      ['Une majuscule', pwReqs.uppercase],
                      ['Une minuscule', pwReqs.lowercase],
                      ['Un chiffre', pwReqs.number],
                      ['Un caractère spécial', pwReqs.special],
                    ].map(([label, valid]) => (
                      <li
                        key={String(label)}
                        className={`flex items-center gap-1.5 text-[11px] transition-all ${valid ? 'text-[#5fd38d]' : 'text-[#8b98a5] opacity-45'}`}
                      >
                        <span
                          className={`flex h-[14px] w-[14px] flex-shrink-0 items-center justify-center rounded-full border transition-colors ${valid ? 'border-[#3ca66a] bg-[#173c2a]' : 'border-[#66717d] bg-[#66717d]/20'}`}
                        >
                          {valid && <Check size={9} strokeWidth={3} />}
                        </span>
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {isRegister && (
              <div className="mb-5">
                <div className="relative">
                  <label htmlFor="confirmPassword" className="block text-[13px] font-bold text-[#d6d9db] mb-2">
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
                    className="w-full h-[54px] bg-[#181d25] rounded-[10px] px-4 pr-12 text-[15px] text-white placeholder-[#68717d] outline-none font-sans transition-colors border border-[#303742] hover:border-[#59626e] focus:border-[#a9562d]"
                  />
                  <button
                    type="button"
                    className="absolute right-4 bottom-[15px] bg-transparent border-none cursor-pointer p-1 text-[#71767b] hover:text-white transition-colors"
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
              <div className="text-right -mt-2 mb-6">
                <a
                  href="/forgot-password"
                  className="text-[#8b98a5] hover:text-brand text-[13px] no-underline transition-colors"
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
                className="border border-red-500/40 bg-red-500/10 rounded-[10px] px-4 py-3 mb-5 text-sm text-red-400 animate-[shake_0.3s_ease-in-out]"
              >
                {error}
              </div>
            )}

            {isRegister && <div className="mb-5 flex justify-center">{cap.widget}</div>}

            <button
              type="submit"
              className="w-full h-[52px] bg-brand-dark text-white px-6 rounded-full font-black text-[15px] border-none cursor-pointer font-sans hover:bg-[#c75a24] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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

            <div className="text-center text-sm mt-7">
              <span className="text-[#71767b]">{isRegister ? 'Déjà un compte ?' : 'Pas de compte ?'}</span>
              <button
                type="button"
                className="bg-transparent border-none text-brand font-bold cursor-pointer text-sm ml-1 font-sans hover:underline"
                onClick={toggleMode}
              >
                {isRegister ? 'Connecte-toi' : 'Inscris-toi'}
              </button>
            </div>
          </div>

          <div className="hidden lg:flex items-center justify-center gap-1.5 mt-10 text-[12px] text-[#536471]">
            <span>🇫🇷</span>
            <span>Hébergé en France · Zéro log · RGPD &amp; lois européennes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
