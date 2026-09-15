import { Check } from 'lucide-react';

/** Pastille bleue avec coche, affichée à droite du nom des comptes vérifiés. */
export default function VerifiedBadge({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <span
      role="img"
      title="Verified"
      aria-label="Verified"
      className={`inline-flex items-center justify-center flex-shrink-0 rounded-full bg-[var(--accent)] ${className}`}
    >
      <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
    </span>
  );
}
