import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ToastData {
  message: string;
  type?: string;
}

let showToastFn: ((msg: string, type?: string) => void) | null = null;

export function showToast(message: string, type?: string) {
  showToastFn?.(message, type);
}

const ICONS = {
  success: <CheckCircle2 size={18} />,
  error: <AlertCircle size={18} />,
  info: <Info size={18} />,
};

const TYPE_STYLE: Record<string, { icon: keyof typeof ICONS; accent: string }> = {
  success: { icon: 'success', accent: 'text-[#43b581]' },
  error: { icon: 'error', accent: 'text-[#ed4245]' },
  info: { icon: 'info', accent: 'text-brand' },
};

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

  const style = data ? TYPE_STYLE[data.type || ''] : undefined;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 z-[9999] -translate-x-1/2 transition-all duration-300 pointer-events-none ${
        data ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      style={{ bottom: 'calc(var(--bnav-h, 56px) + 16px)' }}
    >
      {data && (
        <div className="flex items-center gap-2.5 max-w-[85vw] px-5 py-2.5 rounded-full border border-[var(--border)] font-semibold text-sm text-[var(--text-primary)] bg-[var(--bg-card)] shadow-xl">
          {style && <span className={`flex-shrink-0 ${style.accent}`}>{ICONS[style.icon]}</span>}
          <span className="min-w-0 break-words">{data.message}</span>
        </div>
      )}
    </div>
  );
}
