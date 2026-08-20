import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DmcaBadge from '../components/Common/DmcaBadge';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-[var(--bg-page)] p-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <h2 className="text-lg font-bold">Lien invalide</h2>
          <p className="text-text-secondary text-sm mt-1">Ce lien de réinitialisation est invalide.</p>
          <Link to="/auth" className="text-brand mt-4 inline-block text-sm">
            Retour à la connexion
          </Link>
        </div>
        <div className="mt-6 flex justify-center">
          <DmcaBadge />
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) {
      setError('Mot de passe requis.');
      return;
    }
    if (password.length < 8) {
      setError('Au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setDone(true);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-[var(--bg-page)] p-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-lg font-bold">Mot de passe réinitialisé !</h2>
          <p className="text-text-secondary text-sm mt-2">
            Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
          </p>
          <Link
            to="/auth"
            className="inline-block mt-4 bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm no-underline"
          >
            Se connecter
          </Link>
        </div>
        <div className="mt-6 flex justify-center">
          <DmcaBadge />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-[var(--bg-page)] p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-2">
          <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-12 h-12 mb-2 inline-block" />
          <h1 className="text-xl font-bold m-0">Wouaff</h1>
        </div>
        <div className="text-center text-text-secondary text-sm mb-6">Nouveau mot de passe</div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-semibold mb-1.5">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Au moins 8 caractères"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full bg-[var(--bg-page)] border border-[var(--border)] rounded-xl px-4 py-3 pr-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-brand font-sans"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-1 text-text-muted"
                onClick={() => setShowPassword((p) => !p)}
                tabIndex={-1}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
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
          </div>

          <div className="mb-4">
            <label htmlFor="confirmPassword" className="block text-sm font-semibold mb-1.5">
              Confirmer le mot de passe
            </label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="Répétez le mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full bg-[var(--bg-page)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-brand font-sans"
            />
          </div>

          <button
            className="w-full bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm border-none cursor-pointer font-sans disabled:opacity-50 disabled:cursor-not-allowed"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
          </button>
        </form>

        {error && (
          <div className="bg-red-500/10 border border-[#ea4335] rounded-lg px-3 py-2.5 mt-3 text-sm text-[#ea4335]">
            {error}
          </div>
        )}
      </div>
      <div className="mt-6 flex justify-center">
        <DmcaBadge />
      </div>
    </div>
  );
}
