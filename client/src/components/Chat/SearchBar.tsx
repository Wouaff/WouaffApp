import { useEffect, useRef } from 'react';
import type { MessageData } from '../../types';
import { formatTime } from '../../utils/chatHelpers';

interface SearchBarProps {
  searchOpen: boolean;
  searchQuery: string;
  searching: boolean;
  searchResults: Record<string, MessageData>;
  onSearchChange: (q: string) => void;
  onClose: () => void;
  onResultClick: (mid: string) => void;
}

export default function SearchBar({
  searchOpen,
  searchQuery,
  searching,
  searchResults,
  onSearchChange,
  onClose,
  onResultClick,
}: SearchBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  if (!searchOpen) return null;

  return (
    <div className="search-bar">
      <label htmlFor="searchInput" className="sr-only">
        Rechercher
      </label>
      <input
        id="searchInput"
        ref={searchInputRef}
        className="search-bar-input"
        placeholder="Rechercher dans la conversation…"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      />
      {searching && <span className="search-bar-spinner" />}
      {searchQuery && !searching && Object.keys(searchResults).length > 0 && (
        <div className="search-results">
          {Object.entries(searchResults)
            .slice(0, 10)
            .map(([mid, m]) => (
              <button key={mid} type="button" className="search-result-item" onClick={() => onResultClick(mid)}>
                <span className="search-result-text">{m.text?.substring(0, 80)}</span>
                <span className="search-result-time">{formatTime(m.time)}</span>
              </button>
            ))}
        </div>
      )}
      {searchQuery && !searching && Object.keys(searchResults).length === 0 && (
        <div className="search-no-results">Aucun résultat</div>
      )}
    </div>
  );
}
