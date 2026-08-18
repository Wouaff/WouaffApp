import type { BadgeDef } from '../../hooks/useBadges';

interface Props {
  ids?: string[];
  defs: Record<string, BadgeDef>;
  size?: number;
}

export default function BadgeIcons({ ids, defs, size = 15 }: Props) {
  const icons = (ids || []).map((id) => defs[id]).filter((b): b is BadgeDef => !!b && !!b.icon);
  if (icons.length === 0) return null;
  return (
    <>
      {icons.map((b) => (
        <img
          key={b.icon}
          src={b.icon}
          alt={b.name || 'Badge'}
          title={b.name || 'Badge'}
          style={{ width: size, height: size }}
          className="rounded-full flex-shrink-0 object-cover"
        />
      ))}
    </>
  );
}
