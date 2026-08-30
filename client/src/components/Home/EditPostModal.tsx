import { History, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { posts as postsAPI } from '../../services/api';
import type { SocialPost } from '../../types';
import { showToast } from '../Common/Toast';

interface EditPostModalProps {
  post: SocialPost;
  onClose: () => void;
  onSaved: (post: SocialPost) => void;
}

export default function EditPostModal({ post, onClose, onSaved }: EditPostModalProps) {
  const [text, setText] = useState(post.text);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Array<{ id: number; text: string; editedAt: number }>>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    postsAPI
      .history(post.id)
      .then(setHistory)
      .catch(() => {});
  }, [post.id]);

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      const updated = await postsAPI.edit(post.id, { text: text.trim() });
      onSaved(updated);
      window.dispatchEvent(new CustomEvent('wouaff:post-updated', { detail: updated }));
      showToast('Publication modifiée', 'success');
      onClose();
    } catch (error) {
      showToast((error as Error).message || 'Impossible de modifier la publication', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay active" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-card w-full max-w-[520px] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="m-0 text-lg font-extrabold text-[var(--text-primary)]">Modifier la publication</h2>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={280}
          rows={5}
          className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--bg-input)] p-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand)]"
          aria-label="Texte de la publication"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>La modification est limitée à la fenêtre configurée.</span>
          <span>{text.length}/280</span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowHistory((value) => !value)}
            className="btn btn-ghost flex items-center gap-2 px-3 py-2 text-sm"
          >
            <History size={16} /> Historique ({history.length})
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost px-4 py-2 text-sm">
              Annuler
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!text.trim() || saving}
              className="btn btn-primary flex items-center gap-2 px-4 py-2 text-sm"
            >
              <Save size={16} /> Enregistrer
            </button>
          </div>
        </div>
        {showHistory && (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            {history.length === 0 ? (
              <p className="m-0 text-sm text-[var(--text-muted)]">Aucune modification précédente.</p>
            ) : (
              history.map((entry) => (
                <div key={entry.id} className="border-b border-[var(--border)] py-2 last:border-0">
                  <time className="text-xs text-[var(--text-muted)]">{new Date(entry.editedAt).toLocaleString()}</time>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{entry.text}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
