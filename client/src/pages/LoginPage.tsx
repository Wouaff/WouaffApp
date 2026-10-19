import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Turnstile, { captchaEnabled } from '../components/Turnstile';
import { useAuth } from '../hooks/useAuth';
import { ApiError, errorMessage } from '../services/api';
import { login, register } from '../services/auth';

const inputClass =
  'w-full bg-transparent border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors';

export default function LoginPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register' && captchaEnabled && !captchaToken) {
      setError('Valide le captcha avant de continuer');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password, needs2fa ? code : undefined);
      } else {
        await register(pseudo, email, password, captchaToken || undefined);
      }
      const me = await refresh();
      if (!me) {
        throw new Error("Connecté, mais la session n'a pas pu être récupérée. Recharge la page et réessaie.");
      }
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError && err.data.needs2fa) setNeeds2fa(true);
      setError(errorMessage(err));
    }
    setLoading(false);
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setNeeds2fa(false);
    setCode('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4 py-8">
      <div className="w-full max-w-[440px]">
        <div className="flex flex-col items-center mb-8">
          <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-14 h-14 rounded-2xl mb-3" />
          <h1 className="text-4xl font-black text-[var(--text-primary)]">Wouaff</h1>
          <p className="text-[var(--text-secondary)] mt-1">T'as capté 🐺</p>
        </div>

        <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mb-6">
          {mode === 'login' ? 'Connexion à Wouaff' : 'Crée ton compte'}
        </h2>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-sm"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="pseudo" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Pseudo
              </label>
              <input
                id="pseudo"
                type="text"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                className={inputClass}
                placeholder="ton_pseudo"
                autoComplete="username"
                required
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_]+"
                title="Lettres, chiffres et underscores uniquement"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="toi@exemple.fr"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              maxLength={72}
            />
            {mode === 'register' && <p className="text-xs text-[var(--text-secondary)] mt-1">8 caractères minimum.</p>}
          </div>

          {needs2fa && (
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Code de ton application d'authentification
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={inputClass}
                placeholder="123456"
                required
                // biome-ignore lint/a11y/noAutofocus: le champ vient d'apparaître après la première étape de connexion
                autoFocus
              />
            </div>
          )}

          {mode === 'register' && <Turnstile onToken={setCaptchaToken} onError={setError} />}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-bold rounded-full py-3 transition-colors"
          >
            {loading ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        {mode === 'login' && (
          <p className="mt-4 text-center text-sm">
            <Link to="/forgot-password">Mot de passe oublié ?</Link>
          </p>
        )}

        {mode === 'register' && (
          <p className="mt-4 text-center text-xs text-[var(--text-secondary)]">
            En créant un compte, tu acceptes les <Link to="/legal/conditions">conditions d'utilisation</Link> et la{' '}
            <Link to="/legal/confidentialite">politique de confidentialité</Link>.
          </p>
        )}

        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          {mode === 'login' ? 'Pas encore de compte ?' : 'Déjà un compte ?'}
          <button type="button" onClick={switchMode} className="hover:underline ml-1 font-bold text-[var(--text-link)]">
            {mode === 'login' ? "S'inscrire" : 'Se connecter'}
          </button>
        </p>

        <div className="mt-8 text-center text-xs text-[var(--text-secondary)]">
          © 2026 Wouaff. Pas de revente de données. Pas de pub.
        </div>
      </div>
    </div>
  );
}
