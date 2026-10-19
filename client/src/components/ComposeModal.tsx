import { X } from 'lucide-react';
import { useEffect } from 'react';
import ComposeBox from './ComposeBox';

interface ComposeModalProps {
  onClose: () => void;
  onPosted: () => void;
}

export default function ComposeModal({ onClose, onPosted }: ComposeModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-[var(--bg-modal)]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nouveau post"
        className="relative bg-[var(--bg-secondary)] rounded-2xl w-full max-w-[600px] mx-4 shadow-xl border border-[var(--border-color)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-primary)]" />
          </button>
        </div>
        <ComposeBox
          autoFocus
          onPosted={() => {
            onPosted();
            onClose();
          }}
        />
      </div>
    </div>
  );
}
