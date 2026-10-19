import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../services/api';

/**
 * Liste paginée par offset : chargement initial, « charger la suite », rechargement.
 * `key` change => la liste repart de zéro (changement d'onglet, de recherche, de profil…).
 */
export function usePaged<T>(fetchPage: (offset: number) => Promise<T[]>, key: string, pageSize = 20) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const requestId = useRef(0);
  const itemsRef = useRef<T[]>([]);
  itemsRef.current = items;

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRef.current(0);
      if (id !== requestId.current) return;
      setItems(data);
      setHasMore(data.length >= pageSize);
    } catch (err) {
      if (id !== requestId.current) return;
      setItems([]);
      setHasMore(false);
      setError(errorMessage(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [pageSize]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const data = await fetchRef.current(itemsRef.current.length);
      if (id !== requestId.current) return;
      setItems((prev) => [...prev, ...data]);
      setHasMore(data.length >= pageSize);
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, pageSize]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` identifie la requête et doit relancer le chargement
  useEffect(() => {
    reload();
  }, [reload, key]);

  return { items, setItems, loading, loadingMore, hasMore, error, reload, loadMore };
}
