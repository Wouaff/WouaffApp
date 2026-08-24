import { useCallback, useEffect, useRef, useState } from 'react';
import { search } from '../services/api';
import type { MentionUser } from '../types';
import { getMentionAt, type MentionToken } from '../utils/mentions';

export interface UseMentionAutocompleteResult {
  open: boolean;
  query: string;
  results: MentionUser[];
  activeIndex: number;
  handleChange: (value: string, caret: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  selectActive: () => void;
  reset: () => void;
}

export function useMentionAutocomplete(
  onApply: (user: MentionUser, token: MentionToken) => void,
): UseMentionAutocompleteResult {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MentionUser[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const tokenRef = useRef<MentionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    tokenRef.current = null;
    setOpen(false);
    setResults([]);
    setActiveIndex(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }, []);

  const handleChange = useCallback(
    (value: string, caret: number) => {
      const token = getMentionAt(value, caret);
      tokenRef.current = token;
      if (!token) {
        reset();
        return;
      }
      setQuery(token.query);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const res = await search.mentions(token.query);
          if (!tokenRef.current || tokenRef.current.start !== token.start) return;
          setResults(res.results);
          setActiveIndex(0);
          setOpen(res.results.length > 0);
        } catch {
          /* réseau, on garde le dropdown fermé */
        }
      }, 200);
    },
    [reset],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const selectActive = useCallback(() => {
    const token = tokenRef.current;
    const user = results[activeIndex];
    if (token && user) {
      onApply(user, token);
      reset();
    }
  }, [results, activeIndex, onApply, reset]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open || results.length === 0) return false;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % results.length);
        return true;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + results.length) % results.length);
        return true;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        selectActive();
        return true;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        reset();
        return true;
      }
      return false;
    },
    [open, results.length, selectActive, reset],
  );

  return { open, query, results, activeIndex, handleChange, handleKeyDown, selectActive, reset };
}
