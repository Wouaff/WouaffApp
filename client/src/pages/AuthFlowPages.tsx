import { type ReactNode, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Captcha, { useCaptchaEnabled } from '../components/Captcha';
import { api, errorMessage } from '../services/api';

const inputClass =
  'w-full bg-transparent border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors';
const buttonClass =
  'w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-bold rounded-full py-3 transition-colors';

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4 py-8">
      <div className="w-full max-w-[440px]">
        <div className="flex flex-col items-center mb-8">
          <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-14 h-14 rounded-2xl mb-3" />
          <h1 className="text-3xl font-black text-[var(--text-primary)]">{title}</h1>
        </div>
        {children}
        <p className="mt-8 text-center text-sm">
          <Link to="/">Retour à Wouaff</Link>
        </p>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const captchaEnabled = useCaptchaEnabled();
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (captchaEnabled && !captchaToken) {
      setError('Valide le captcha avant de continuer');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email, captchaToken: captchaToken || undefined });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
      setCaptchaToken('');
      setCaptchaKey((k) => k + 1);
    }
    setLoading(false);
  };

  return (
    <Frame title="Mot de passe oublié">
      {sent ? (
        <p className="text-[var(--text-primary)] text-center">
          Si un compte existe pour <strong>{email}</strong>, un e-mail avec un lien de réinitialisation vient d'être
          envoyé (valable 1 heure).
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Indique l'adresse e-mail de ton compte : on t'envoie un lien pour choisir un nouveau mot de passe.
          </p>
          {error && (
            <div role="alert" className="p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] text-sm">
              {error}
            </div>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="toi@exemple.fr"
            aria-label="Adresse e-mail"
            autoComplete="email"
            required
          />
          <Captcha key={captchaKey} onToken={setCaptchaToken} onError={setError} />
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? '…' : 'Envoyer le lien'}
          </button>
        </form>
      )}
    </Frame>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    }
    setLoading(false);
  };

  return (
    <Frame title="Nouveau mot de passe">
      {done ? (
        <p className="text-center text-[var(--text-primary)]">
          Mot de passe mis à jour. Tu peux maintenant <Link to="/auth">te connecter</Link>.
        </p>
      ) : !token ? (
        <p className="text-center text-[var(--text-secondary)]">Lien invalide.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div role="alert" className="p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] text-sm">
              {error}
            </div>
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="Nouveau mot de passe (8 caractères min.)"
            aria-label="Nouveau mot de passe"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? '…' : 'Changer le mot de passe'}
          </button>
        </form>
      )}
    </Frame>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('Lien invalide.');
      return;
    }
    api
      .post<{ changed?: string }>('/auth/verify-email', { token })
      .then((r) => {
        setChanged(r.changed === 'email');
        setState('ok');
      })
      .catch((err) => {
        setState('error');
        setMessage(errorMessage(err));
      });
  }, [token]);

  return (
    <Frame title="Vérification de l'e-mail">
      {state === 'loading' && (
        <div className="flex justify-center">
          <div className="spinner" />
        </div>
      )}
      {state === 'ok' && (
        <p className="text-center text-[var(--text-primary)]">
          {changed
            ? 'Ta nouvelle adresse e-mail est confirmée : utilise-la désormais pour te connecter.'
            : 'Ton adresse e-mail est confirmée. Merci !'}
        </p>
      )}
      {state === 'error' && <p className="text-center text-[var(--danger)]">{message}</p>}
    </Frame>
  );
}
