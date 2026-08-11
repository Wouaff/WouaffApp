import { useCallback, useEffect, useState } from 'react';
import CapWidget from '../components/Common/CapWidget';

export type CapScope = 'register' | 'forgot' | 'post' | 'comment';

const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
const CAP_ENABLED = !!(env.VITE_CAP_API_ENDPOINT || '').trim();

export interface UseCapResult {
  required: boolean;
  checking: boolean;
  token: string;
  widget: React.ReactNode;
  reset: () => void;
}

export function useCap(scope: CapScope): UseCapResult {
  const [required, setRequired] = useState(false);
  const [checking, setChecking] = useState(CAP_ENABLED);
  const [token, setToken] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!CAP_ENABLED) {
      setRequired(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    fetch(`/api/captcha/required?scope=${scope}`)
      .then((r) => r.json())
      .then((d: { required?: boolean }) => {
        if (!cancelled) setRequired(!!d.required);
      })
      .catch(() => {
        if (!cancelled) setRequired(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const onToken = useCallback((t: string) => setToken(t), []);
  const reset = useCallback(() => setToken(''), []);

  const widget = required ? <CapWidget onToken={onToken} /> : null;

  return { required, checking, token, widget, reset };
}
