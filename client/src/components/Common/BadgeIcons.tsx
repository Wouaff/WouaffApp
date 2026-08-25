import type { BadgeDef } from '../../hooks/useBadges';

interface Props {
  ids?: string[];
  defs: Record<string, BadgeDef>;
  size?: number;
  maxVisible?: number;
}

export default function BadgeIcons({ ids, defs, size = 15, maxVisible = 3 }: Props) {
  const icons = (ids || []).map((id) => defs[id]).filter((b): b is BadgeDef => !!b && !!b.icon);
  if (icons.length === 0) return null;

  const visible = icons.slice(0, maxVisible);
  const overflow = icons.length - maxVisible;

  return (
    <>
      {visible.map((b) => (
        <img
          key={b.icon}
          src={b.icon}
          alt={b.name || 'Badge'}
          title={b.name || 'Badge'}
          style={{ width: size, height: size }}
          className="rounded-full flex-shrink-0 object-cover"
        />
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] flex-shrink-0 font-bold"
          style={{ width: size, height: size, fontSize: Math.max(9, size - 5) }}
          title={`${overflow} badge(s) supplémentaire(s)`}
        >
          +{overflow}
        </span>
      )}
    </>
  );
}
