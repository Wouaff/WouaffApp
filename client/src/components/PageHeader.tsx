import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  back?: string;
  children?: ReactNode;
}

/** En-tête collant d'une page : flèche de retour, titre, et zone libre dessous (onglets…). */
export default function PageHeader({ title, subtitle, back = '/', children }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-40 bg-[var(--bg-secondary)]/80 backdrop-blur-md border-b border-[var(--border-color)]">
      <div className="flex items-center gap-6 px-4 py-2">
        <Link
          to={back}
          aria-label="Retour"
          className="p-2 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-primary)]" />
        </Link>
        <div className="min-w-0">
          <h1 className="font-bold text-xl leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

interface TabsProps<T extends string> {
  tabs: readonly T[];
  value: T;
  onChange: (tab: T) => void;
  labels?: Partial<Record<T, string>>;
}

export function Tabs<T extends string>({ tabs, value, onChange, labels }: TabsProps<T>) {
  return (
    <div role="tablist" className="flex border-t border-[var(--border-color)]">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={value === t}
          onClick={() => onChange(t)}
          className={`flex-1 py-3 text-sm font-medium transition-colors relative hover:bg-[var(--bg-tertiary)] ${
            value === t ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-secondary)]'
          }`}
        >
          {labels?.[t] ?? t}
          {value === t && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[var(--accent)] rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}
