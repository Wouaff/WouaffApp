import { useEffect, useState } from 'react';
import { api } from '../services/api';

export const UNREAD_REFRESH_EVENT = 'wouaff:unread-refresh';

/* Nombre de notifications non lues, rafraîchi toutes les 30 s et à la demande. */
export function useUnread(enabled = true): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () => {
      api
        .get<{ count: number }>('/notifications/unread')
        .then((r) => {
          if (!cancelled) setCount(r.count);
        })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 30_000);
    window.addEventListener(UNREAD_REFRESH_EVENT, load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(UNREAD_REFRESH_EVENT, load);
    };
  }, [enabled]);

  return count;
}
