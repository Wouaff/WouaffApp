import { useEffect, useState } from 'react';
import { badges as badgesAPI } from '../services/api';

export interface BadgeDef {
  name?: string;
  icon?: string;
}

let cached: Record<string, BadgeDef> | null = null;
let inflight: Promise<Record<string, BadgeDef>> | null = null;

export function useBadges(): Record<string, BadgeDef> {
  const [defs, setDefs] = useState<Record<string, BadgeDef>>(cached ?? {});

  useEffect(() => {
    if (cached) {
      setDefs(cached);
      return;
    }
    let cancelled = false;
    const apply = (data: Record<string, BadgeDef>) => {
      if (!cancelled) setDefs(data);
    };
    if (!inflight) {
      inflight = badgesAPI
        .list()
        .then((data) => {
          cached = data;
          return data;
        })
        .catch(() => cached ?? {})
        .finally(() => {
          inflight = null;
        });
    }
    inflight.then(apply);
    return () => {
      cancelled = true;
    };
  }, []);

  return defs;
}
