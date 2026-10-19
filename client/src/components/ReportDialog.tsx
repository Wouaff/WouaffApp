import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, errorMessage } from '../services/api';

export const REPORT_CATEGORIES = [
  { id: 'spam', label: 'Spam ou publicité' },
  { id: 'harassment', label: 'Harcèlement ou insultes' },
  { id: 'hate', label: 'Haine ou discrimination' },
  { id: 'violence', label: 'Violence ou menaces' },
  { id: 'illegal', label: 'Contenu illégal' },
  { id: 'sexual', label: 'Contenu sexuel' },
  { id: 'other', label: 'Autre' },
] as const;

interface ReportDialogProps {
  postId: number;
  onClose: () => void;
  onDone: () => void;
}

/** Fenêtre de signalement d'un post : catégorie obligatoire, précisions facultatives. */
export default function ReportDialog({ postId, onClose, onDone }: ReportDialogProps) {
  const [category, setCategory] = useState<string>('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) {
      setError('Choisis une catégorie');
      return;
    }
    setSending(true);
    setError('');
    try {
      await api.post(`/posts/${postId}/report`, { category, reason: details.trim() || undefined });
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Signalement impossible'));
      setSending(false);
    }
  };

  /* Portail + stopPropagation : un clic dans la fenêtre ne doit pas ouvrir le post situé derrière. */
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="absolute inset-0 bg-[var(--bg-modal)]" />
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Signaler ce post"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[var(--bg-secondary)] rounded-2xl w-full max-w-[480px] mx-4 shadow-xl border border-[var(--border-color)]"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <h2 className="font-extrabold text-lg">Signaler ce post</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-primary)]" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <fieldset className="space-y-1">
            <legend className="text-sm text-[var(--text-secondary)] mb-2">Pourquoi signales-tu ce post ?</legend>
            {REPORT_CATEGORIES.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] cursor-pointer"
              >
                <input
                  type="radio"
                  name="report-category"
                  value={c.id}
                  checked={category === c.id}
                  onChange={() => {
                    setCategory(c.id);
                    setError('');
                  }}
                  className="accent-[var(--accent)]"
                />
                <span className="text-[var(--text-primary)]">{c.label}</span>
              </label>
            ))}
          </fieldset>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 500))}
            placeholder="Précisions (facultatif)"
            aria-label="Précisions"
            rows={3}
            className="w-full bg-transparent border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none resize-none"
          />
          {error && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
          <p className="text-xs text-[var(--text-secondary)]">
            Un modérateur examinera ce signalement. Tu seras informé de la suite donnée.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[var(--border-color)] font-bold text-sm hover:bg-[var(--bg-tertiary)]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={sending}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-bold rounded-full px-5 py-2 text-sm"
            >
              {sending ? '…' : 'Signaler'}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
