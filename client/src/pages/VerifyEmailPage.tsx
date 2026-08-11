import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token') || '';
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const submit = useCallback(async (value: string) => {
    if (!value) {
      setStatus('error');
      setMessage('Saisissez le code à 6 chiffres reçu par email.');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: value }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('success');
        setMessage(data.alreadyVerified ? 'Votre email est déjà vérifié.' : 'Email vérifié avec succès !');
      } else {
        setStatus('error');
        setMessage(data.error || 'Échec de la vérification.');
      }
    } catch {
      setStatus('error');
      setMessage('Erreur lors de la vérification.');
    }
  }, []);

  useEffect(() => {
    /* Le lien de l'email contient le code : on le pré-remplit mais on n'auto-valide pas
       (les scanners d'email / prévisualisateurs consommeraient le code avant l'utilisateur). */
    const clean = urlToken.trim();
    if (clean) {
      if (/^\d{6}$/.test(clean)) {
        setCode(clean);
        inputsRef.current[0]?.focus();
      } else {
        submit(clean);
      }
    }
  }, [urlToken, submit]);

  const resend = async () => {
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/auth/send-verification', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatus('idle');
        setMessage('Un nouveau code vient de vous être envoyé par email.');
        setCode('');
        inputsRef.current[0]?.focus();
      } else {
        setStatus('error');
        setMessage(data.error || "Impossible d'envoyer un nouveau code.");
      }
    } catch {
      setStatus('error');
      setMessage("Impossible d'envoyer un nouveau code.");
    }
  };

  const handleDigit = (idx: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setCode((prev) => {
      const arr = prev.split('');
      arr[idx] = digit;
      const next = arr.join('');
      if (digit && idx < 5) setTimeout(() => inputsRef.current[idx + 1]?.focus(), 0);
      return next;
    });
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
    if (e.key === 'Enter') {
      submit(code);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-dvh bg-[var(--bg-page)] p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="text-center mb-2">
          <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-12 h-12 mb-2 inline-block" />
          <h1 className="text-xl font-bold m-0">Wouaff</h1>
        </div>
        <div className="py-5">
          {status === 'loading' && (
            <>
              <div className="text-5xl mb-4 animate-spin">⏳</div>
              <p className="text-text-secondary text-sm">Vérification de votre email...</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-lg font-bold">Email vérifié !</h2>
              <p className="text-text-secondary text-sm mt-2">{message}</p>
              <Link
                to="/"
                className="inline-block mt-4 bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm no-underline"
              >
                Accéder à Wouaff
              </Link>
            </>
          )}
          {(status === 'idle' || status === 'error') && (
            <>
              <div className="text-5xl mb-4">🔒</div>
              <h2 className="text-lg font-bold mb-2">Vérification de votre email</h2>
              <p className="text-text-secondary text-sm mb-6">Saisissez le code à 6 chiffres reçu par email.</p>

              {status === 'error' && message && (
                <div className="bg-red-500/10 border border-red-500 rounded-lg px-3 py-2.5 mb-4 text-sm text-red-500">
                  {message}
                </div>
              )}

              {status === 'idle' && message && (
                <div className="bg-green-500/10 border border-green-500 rounded-lg px-3 py-2.5 mb-4 text-sm text-green-500">
                  {message}
                </div>
              )}

              <div className="flex justify-center gap-2 mb-6" role="group" aria-label="Code de vérification">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputsRef.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code[i] || ''}
                    onChange={(e) => handleDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    maxLength={1}
                    aria-label={`Chiffre ${i + 1}`}
                    className="w-12 h-14 text-center text-xl font-extrabold bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-glow)] font-sans transition-colors"
                  />
                ))}
              </div>

              <button
                className="w-full bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm border-none cursor-pointer font-sans"
                onClick={() => submit(code)}
              >
                Vérifier
              </button>
              <button
                type="button"
                className="w-full bg-transparent text-brand px-6 py-2.5 rounded-xl font-bold text-sm border-none cursor-pointer font-sans mt-1 hover:bg-[var(--brand-glow)] transition-colors"
                onClick={resend}
              >
                Renvoyer le code
              </button>
              <Link to="/auth" className="text-brand mt-2 inline-block text-sm">
                Retour à la connexion
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
