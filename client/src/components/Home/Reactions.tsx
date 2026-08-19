import { useEffect, useRef } from 'react';
import type { PostReaction } from '../../types';

export const REACTIONS = ['❤️', '👍', '🔥', '🤣', '😮', '😢', '🙏'] as const;

export type ReactionType = (typeof REACTIONS)[number];

export function isReactionType(value: string | null | undefined): value is ReactionType {
  return !!value && (REACTIONS as readonly string[]).includes(value);
}

export function topReactions(reactions?: PostReaction[]): PostReaction[] {
  if (!reactions || reactions.length === 0) return [];
  return [...reactions]
    .sort((a, b) => {
      const oa = (REACTIONS as readonly string[]).indexOf(a.type);
      const ob = (REACTIONS as readonly string[]).indexOf(b.type);
      if (oa === -1 && ob === -1) return b.count - a.count;
      if (oa === -1) return 1;
      if (ob === -1) return -1;
      if (a.count !== b.count) return b.count - a.count;
      return oa - ob;
    })
    .slice(0, 3);
}

interface ReactionPickerProps {
  onSelect: (type: string) => void;
  onClose: () => void;
}

export default function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-0 z-30 flex items-center gap-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] shadow-xl px-2 py-1.5"
      role="toolbar"
      aria-label="Réactions"
    >
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          aria-label={`Réagir avec ${emoji}`}
          className="w-9 h-9 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-[20px] leading-none transition-transform hover:scale-125 hover:bg-[var(--bg-hover)]"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
