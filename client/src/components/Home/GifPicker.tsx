import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { gifs as gifsAPI } from '../../services/api';
import type { GifResult } from '../../types';

interface GifPickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    setError('');
    try {
      const data = query.trim() ? await gifsAPI.search(query.trim()) : await gifsAPI.trending();
      if (data.error) setError(data.error);
      setResults(data.results || []);
    } catch (e) {
      console.error(e);
      setError('Impossible de charger les GIF');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('');
    inputRef.current?.focus();
  }, [load]);

  useEffect(() => {
    const value = q.trim();
    const timer = setTimeout(() => {
      load(value);
    }, 400);
    return () => clearTimeout(timer);
  }, [q, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-overlay active"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex flex-col w-full max-w-[560px] max-h-[85dvh] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl animate-scale-in">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
          <span className="font-extrabold text-[16px] text-brand">GIF</span>
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher des GIFs"
              aria-label="Rechercher des GIFs"
              className="w-full bg-[var(--bg-input)] border border-transparent focus:border-[var(--brand)] outline-none rounded-full py-2 pl-9 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] font-sans transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full flex items-center justify-center border-none bg-transparent cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {loading ? (
            <div className="py-14 flex flex-col items-center gap-3">
              <div className="spinner" />
              <p className="m-0 text-sm text-[var(--text-muted)]">Chargement des GIF...</p>
            </div>
          ) : error ? (
            <div className="py-14 text-center px-4">
              <p className="m-0 text-[var(--text-secondary)]">{error}</p>
              <p className="m-0 mt-1 text-[12px] text-[var(--text-muted)]">
                Configure <code>GIPHY_API_KEY</code> dans le .env du serveur.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-14 text-center">
              <p className="m-0 text-[var(--text-secondary)]">Aucun GIF trouvé.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {results.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelect(g.url)}
                  title={g.title || undefined}
                  className="rounded-xl overflow-hidden border-none p-0 cursor-pointer bg-[var(--bg-input)] hover:opacity-90 transition-opacity aspect-video"
                >
                  <img
                    src={g.preview}
                    alt={g.title || 'GIF'}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
