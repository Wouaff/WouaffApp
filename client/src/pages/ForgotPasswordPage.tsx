import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCap } from '../hooks/useCap';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const cap = useCap('forgot');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Email requis.');
      return;
    }
    if (cap.required && !cap.token) {
      setError('Veuillez confirmer que vous êtes humain.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, capToken: cap.token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      cap.reset();
      setSent(true);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-[var(--bg-page)] p-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-center mb-2">
            <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-12 h-12 mb-2 inline-block" />
            <h1 className="text-xl font-bold m-0">Wouaff</h1>
          </div>
          <div className="py-5">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-lg font-bold mb-0">Email envoyé !</h2>
            <p className="text-text-secondary text-sm mt-2">
              Si un compte existe avec cette adresse, vous recevrez un email de réinitialisation.
            </p>
            <Link to="/auth" className="text-brand mt-4 inline-block text-sm">
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-dvh bg-[var(--bg-page)] p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-2">
          <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-12 h-12 mb-2 inline-block" />
          <h1 className="text-xl font-bold m-0">Wouaff</h1>
        </div>
        <div className="text-center text-text-secondary text-sm mb-6">Mot de passe oublié ?</div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-semibold mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              placeholder="vous@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full bg-[var(--bg-page)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-brand font-sans"
            />
          </div>

          <div className="mb-5 flex justify-center">{cap.widget}</div>

          <button
            className="w-full bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm border-none cursor-pointer font-sans disabled:opacity-50 disabled:cursor-not-allowed"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
          </button>
        </form>

        {error && (
          <div className="bg-red-500/10 border border-[#ea4335] rounded-lg px-3 py-2.5 mt-3 text-sm text-[#ea4335]">
            {error}
          </div>
        )}

        <div className="text-center mt-4 text-sm">
          <Link to="/auth" className="text-brand">
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
