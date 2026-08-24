import { Check, Copy, Loader2, Search, X } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  createContext,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

/* ────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────── */
export function timeAgo(ts?: number | null): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `il y a ${days}j`;
  return new Date(ts).toLocaleDateString('fr-FR');
}

export function formatDate(ts?: number | null): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(n?: number | null): string {
  if (n === null || n === undefined) return '0';
  return n.toLocaleString('fr-FR');
}

export function shortUid(uid: string, len = 12): string {
  if (!uid) return '';
  return uid.length > len ? `${uid.slice(0, len)}…` : uid;
}

/* ────────────────────────────────────────────────────────────
   Toast
──────────────────────────────────────────────────────────── */
type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
}

const ToastCtx = createContext<(msg: string, type?: ToastType) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((msg: string, type: ToastType = 'info') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3400);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="wa-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`wa-toast wa-toast-${t.type}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ────────────────────────────────────────────────────────────
   Confirm dialog
──────────────────────────────────────────────────────────── */
export interface ConfirmOpts {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn>(async () => false);

export function useConfirm() {
  return useContext(ConfirmCtx);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOpts & { resolve: (b: boolean) => void }) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...opts, resolve });
      }),
    [],
  );

  const close = (val: boolean) => {
    pending?.resolve(val);
    setPending(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {pending && (
        <div className="wa-overlay" onClick={() => close(false)}>
          <div
            className={`wa-modal wa-modal-sm${pending.danger ? ' wa-modal-danger' : ''}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="wa-modal-title">{pending.title}</div>
            {pending.message && <div className="wa-modal-body">{pending.message}</div>}
            <div className="wa-modal-actions">
              <Button variant="ghost" onClick={() => close(false)}>
                Annuler
              </Button>
              <Button variant={pending.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
                {pending.confirmLabel ?? 'Confirmer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

/* ────────────────────────────────────────────────────────────
   Button
──────────────────────────────────────────────────────────── */
export type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
export type BtnSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`wa-btn wa-btn-${variant} wa-btn-${size}${className ? ` ${className}` : ''}`}
      disabled={loading || disabled}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="wa-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  onClick,
  className,
  danger,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`wa-icon-btn${danger ? ' wa-icon-btn-danger' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

export function CopyUid({ value, compact }: { value: string; compact?: boolean }) {
  const [ok, setOk] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setOk(true);
      setTimeout(() => setOk(false), 1400);
    } catch {
      /* clipboard indisponible */
    }
  };
  return (
    <button type="button" className="wa-copy" onClick={copy} title="Copier l'identifiant">
      {ok ? <Check size={12} /> : <Copy size={12} />}
      {ok ? 'copié !' : compact ? 'copier' : 'copier'}
    </button>
  );
}

/* ────────────────────────────────────────────────────────────
   Card / sections
──────────────────────────────────────────────────────────── */
export function Card({
  title,
  icon,
  action,
  children,
  className,
  pad = true,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={`wa-card${pad ? '' : ' wa-card-nopad'}${className ? ` ${className}` : ''}`}>
      {(title || action) && (
        <header className="wa-card-head">
          <div className="wa-card-title">
            {icon}
            {title}
          </div>
          {action}
        </header>
      )}
      <div className="wa-card-body">{children}</div>
    </section>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="wa-section-title">
      <span>{children}</span>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="wa-page-head">
      <div>
        <h2 className="wa-page-title">{title}</h2>
        {subtitle && <p className="wa-page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="wa-page-actions">{actions}</div>}
    </header>
  );
}

/* ────────────────────────────────────────────────────────────
   Form fields
──────────────────────────────────────────────────────────── */
export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="wa-field">
      <div className="wa-field-label">{label}</div>
      {children}
      {hint && <div className="wa-field-hint">{hint}</div>}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`wa-input${className ? ` ${className}` : ''}`} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`wa-input wa-textarea${className ? ` ${className}` : ''}`} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`wa-input wa-select${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </select>
  );
}

export function SearchInput({
  value,
  onChange,
  onEnter,
  onClear,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  onClear?: () => void;
  placeholder?: string;
}) {
  return (
    <div className="wa-search">
      <Search size={16} className="wa-search-ic" />
      <input
        className="wa-search-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      />
      {value && (
        <button
          type="button"
          className="wa-search-clear"
          onClick={() => {
            onChange('');
            onClear?.();
          }}
          aria-label="Effacer"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Segmented tabs
──────────────────────────────────────────────────────────── */
export function SegTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ id: T; label: ReactNode; icon?: ReactNode; count?: number }>;
  value: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="wa-seg">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={`wa-seg-btn${value === it.id ? ' active' : ''}`}
          onClick={() => onChange(it.id)}
        >
          {it.icon}
          {it.label}
          {it.count != null && it.count > 0 && <span className="wa-seg-count">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Misc
──────────────────────────────────────────────────────────── */
export function Avatar({ src, name, size = 40 }: { src?: string | null; name?: string | null; size?: number }) {
  return (
    <span className="wa-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {src ? (
        <img src={src} alt={`Avatar de ${name || 'utilisateur'}`} />
      ) : (
        <span>{(name || '?')[0]?.toUpperCase() || '?'}</span>
      )}
    </span>
  );
}

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'danger' | 'warning';
}) {
  return <span className={`wa-chip wa-chip-${tone}`}>{children}</span>;
}

export function Spinner() {
  return <div className="wa-spinner" />;
}

export function EmptyState({
  icon,
  title,
  text,
  children,
}: {
  icon?: ReactNode;
  title?: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="wa-empty">
      {icon && <div className="wa-empty-icon">{icon}</div>}
      {title && <div className="wa-empty-title">{title}</div>}
      {text && <p className="wa-muted">{text}</p>}
      {children}
    </div>
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="wa-skeleton-list">
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lignes de skeleton statiques
        <div key={i} className="wa-skeleton-row">
          <div className="wa-skeleton-avatar" />
          <div className="wa-skeleton-lines">
            <div className="wa-skeleton-line" style={{ width: '40%' }} />
            <div className="wa-skeleton-line" style={{ width: '85%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  color: string;
}) {
  return (
    <div className="wa-stat" style={{ '--sc': color } as CSSProperties}>
      <span className="wa-stat-icon" style={{ background: `${color}1f`, color }}>
        {icon}
      </span>
      <div className="wa-stat-val">{formatNumber(value)}</div>
      <div className="wa-stat-label">{label}</div>
    </div>
  );
}

export function BarChart({
  data,
  color = 'var(--brand)',
}: {
  data: Array<{ date: string; count: number }>;
  color?: string;
}) {
  if (data.length === 0) return <p className="wa-muted">Aucune donnée sur cette période.</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="wa-chart">
      {data.map((d) => (
        <div key={d.date} className="wa-chart-col" title={`${d.date} : ${d.count}`}>
          <span className="wa-chart-value">{d.count}</span>
          <div className="wa-chart-bar-wrap">
            <div
              className="wa-chart-bar"
              style={{ height: `${Math.max(6, Math.round((d.count / max) * 100))}%`, background: color }}
            />
          </div>
          <span className="wa-chart-date">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  icon,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="wa-overlay" onClick={onClose}>
      <div
        className={`wa-modal${wide ? ' wa-modal-wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="wa-modal-head">
          <div className="wa-modal-title">
            {icon}
            {title}
          </div>
          <IconButton label="Fermer" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="wa-modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ── petit utilitaire : horodatage localisé ── */
export function useNow(intervalMs = 30000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
