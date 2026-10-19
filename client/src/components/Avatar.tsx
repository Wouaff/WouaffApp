interface AvatarProps {
  src?: string | null;
  name?: string | null;
  className?: string;
}

/* Photo de profil, ou l'initiale du pseudo quand il n'y en a pas. */
export default function Avatar({ src, name, className = 'w-10 h-10 text-sm' }: AvatarProps) {
  return (
    <div
      className={`rounded-full bg-[var(--bg-tertiary)] flex-shrink-0 flex items-center justify-center font-bold overflow-hidden text-[var(--text-primary)] ${className}`}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
      ) : (
        (name || '?')[0].toUpperCase()
      )}
    </div>
  );
}
