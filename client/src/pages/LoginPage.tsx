import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { login, register } from '../services/auth';

export default function LoginPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(pseudo, email, password);
      }
      const me = await refresh();
      if (!me) {
        throw new Error("Connecté, mais la session n'a pas pu être récupérée. Recharge la page et réessaie.");
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-[440px]">
        <div className="flex flex-col items-center mb-8">
          <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-14 h-14 rounded-2xl mb-3" />
          <h1 className="text-4xl font-black text-[var(--text-primary)]">Wouaff</h1>
        </div>

        <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mb-6">
          {mode === 'login' ? 'Sign in to Wouaff' : 'Create your account'}
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Pseudo</label>
              <input
                type="text"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                className="w-full bg-transparent border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                placeholder="your_pseudo"
                required
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_]+"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-bold rounded-full py-3 transition-colors"
          >
            {loading ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            className="hover:underline ml-1 font-bold"
            style={{ color: '#1d9bf0' }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>

        <div className="mt-8 text-center text-xs text-[var(--text-secondary)]">
          © 2026 Wouaff. No data resale. No ads.
        </div>
      </div>
    </div>
  );
}
