import { Flag, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { posts as postsAPI } from '../../services/api';
import { showToast } from '../Common/Toast';

const REPORT_REASONS = [
  'Spam',
  'Contenu inapproprié',
  'Harcèlement',
  'Discours haineux',
  'Désinformation',
  'Violence',
  'Autre',
];

interface ReportPostModalProps {
  postId: string;
  onClose: () => void;
}

export default function ReportPostModal({ postId, onClose }: ReportPostModalProps) {
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sending]);

  const submit = async () => {
    if (sending) return;
    const finalReason = reason === 'Autre' ? custom.trim() : reason;
    if (!finalReason) {
      showToast('Veuillez choisir un motif de signalement', 'error');
      return;
    }
    setSending(true);
    try {
      await postsAPI.report(postId, finalReason);
      showToast('Merci, votre signalement a été envoyé', 'success');
      onClose();
    } catch (e) {
      showToast((e as Error).message || 'Erreur lors du signalement', 'error');
      setSending(false);
    }
  };

  return (
    <div
      className="modal-overlay active"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div className="w-full max-w-[420px] rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl">
        <div className="flex items-center gap-4 px-4 h-14 border-b border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-primary)] border-none bg-transparent cursor-pointer hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={18} />
          </button>
          <span className="font-bold text-[var(--text-primary)] text-[17px] m-0">Signaler le post</span>
        </div>

        <div className="px-5 py-4">
          <p className="m-0 mb-3 text-sm text-[var(--text-secondary)]">Pourquoi signalez-vous ce post ?</p>
          <div className="flex flex-col gap-2">
            {REPORT_REASONS.map((r) => (
              <label
                key={r}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium cursor-pointer transition-colors ${
                  reason === r
                    ? 'border-[var(--brand)] bg-[var(--brand-glow)] text-[var(--text-primary)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-[var(--brand)]"
                />
                {r}
              </label>
            ))}
          </div>

          {reason === 'Autre' && (
            <textarea
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Précisez le motif..."
              maxLength={300}
              rows={2}
              aria-label="Précisez le motif"
              className="w-full mt-3 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--brand)] resize-none font-sans transition-colors"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 rounded-full text-sm font-bold text-[var(--text-secondary)] border border-[var(--border)] bg-transparent cursor-pointer hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
            Signaler
          </button>
        </div>
      </div>
    </div>
  );
}
