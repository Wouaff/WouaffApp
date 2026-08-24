import { Lock } from 'lucide-react';
import { useRef, useState } from 'react';

export default function EmailVerificationBanner({ onVerified }: { onVerified: () => void }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleSend = async () => {
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-verification', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      if (data.alreadyVerified) {
        onVerified();
        return;
      }
      setSent(true);
      setTimeout(() => inputsRef.current[0]?.focus(), 100);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Saisissez les 6 chiffres du code.');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Code invalide');
      onVerified();
    } catch (err: unknown) {
      setError((err as Error).message);
      setCode('');
      inputsRef.current[0]?.focus();
    } finally {
      setVerifying(false);
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
      handleVerify();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-card)] rounded-2xl p-8 max-w-md w-full mx-4 shadow-xl">
        <div className="text-center">
          <div className="mb-4 flex justify-center text-brand">
            <Lock size={48} />
          </div>
          <h3 className="text-lg font-bold mb-2">Vérification de votre email</h3>
          <p className="text-text-secondary text-sm mb-6">
            {sent
              ? 'Saisissez le code à 6 chiffres envoyé à votre adresse email.'
              : 'Un code de vérification à 6 chiffres va être envoyé à votre adresse email.'}
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg px-3 py-2.5 mb-4 text-sm text-red-500">
              {error}
            </div>
          )}

          {sent ? (
            <>
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

              <div className="flex flex-col gap-2">
                <button
                  className="w-full bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm border-none cursor-pointer font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleVerify}
                  disabled={verifying}
                >
                  {verifying ? 'Vérification...' : 'Vérifier le code'}
                </button>
                <button
                  className="w-full bg-transparent text-text-muted px-6 py-3 rounded-xl font-bold text-sm border border-border cursor-pointer font-sans hover:text-brand transition-colors disabled:opacity-50"
                  onClick={handleSend}
                  disabled={sending}
                >
                  {sending ? 'Envoi...' : 'Renvoyer le code'}
                </button>
              </div>
            </>
          ) : (
            <button
              className="w-full bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm border-none cursor-pointer font-sans disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? 'Envoi en cours...' : 'Envoyer le code de vérification'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
