import { useState } from 'react';
import { Link } from 'react-router-dom';
import DmcaBadge from '../components/Common/DmcaBadge';

export default function ContactPage() {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Indiquez une adresse email pour qu’on puisse vous répondre.');
      return;
    }
    if (message.trim().length < 10) {
      setError('Votre message est un peu court, détaillez un minimum.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible d'envoyer le message");
      setSent(true);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-[var(--bg-page)] p-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-lg font-bold">Message envoyé !</h1>
          <p className="text-text-secondary text-sm mt-2">
            On vous répondra à {email}, généralement sous quelques jours.
          </p>
          <Link
            to="/"
            className="inline-block mt-6 bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm no-underline"
          >
            Retour à l'accueil
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
        <div className="text-center text-text-secondary text-sm mb-6">
          Écrire à l'équipe : question, signalement, suggestion. Pas besoin de compte.
        </div>

        {error && (
          <div
            className="bg-red-500/10 border border-red-500 rounded-lg px-3 py-2.5 mb-4 text-sm text-red-500"
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="contact-email" className="block text-sm font-semibold mb-1.5">
              Votre email
            </label>
            <input
              id="contact-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[var(--bg-page)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-brand font-sans"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="contact-subject" className="block text-sm font-semibold mb-1.5">
              Sujet (optionnel)
            </label>
            <input
              id="contact-subject"
              type="text"
              value={subject}
              maxLength={120}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-[var(--bg-page)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-brand font-sans"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="contact-message" className="block text-sm font-semibold mb-1.5">
              Message
            </label>
            <textarea
              id="contact-message"
              required
              value={message}
              maxLength={2000}
              rows={6}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-[var(--bg-page)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-brand font-sans resize-y"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm border-none cursor-pointer font-sans disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Envoi...' : 'Envoyer le message'}
          </button>
        </form>
      </div>
      <div className="mt-6 flex justify-center">
        <DmcaBadge />
      </div>
    </div>
  );
}
