import { useEffect, useState } from 'react';

interface ToastData {
  message: string;
  type?: string;
}

let showToastFn: ((msg: string, type?: string) => void) | null = null;

export function showToast(message: string, type?: string) {
  showToastFn?.(message, type);
}

export default function Toast() {
  const [data, setData] = useState<ToastData | null>(null);

  useEffect(() => {
    showToastFn = (message, type) => setData({ message, type });
    return () => {
      showToastFn = null;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setData(null), 3000);
    return () => clearTimeout(t);
  }, [data]);

  if (!data) return null;

  return (
    <div role="status" aria-live="polite" className={`toast show ${data.type || ''}`}>
      {data.message}
    </div>
  );
}
