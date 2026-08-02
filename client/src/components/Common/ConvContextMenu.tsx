import { memo, useEffect, useRef } from 'react';

interface ConvContextMenuProps {
  x: number;
  y: number;
  isPinned: boolean;
  onClose: () => void;
  onDelete: () => void;
  onBlock: () => void;
  onReport: () => void;
  onTogglePin: () => void;
}

const ConvContextMenu = memo(function ConvContextMenu({
  x,
  y,
  isPinned,
  onClose,
  onDelete,
  onBlock,
  onReport,
  onTogglePin,
}: ConvContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [onClose]);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width - 8;
      const maxY = window.innerHeight - rect.height - 8;
      if (rect.left > maxX) ref.current.style.left = `${maxX}px`;
      if (rect.top > maxY) ref.current.style.top = `${maxY}px`;
    }
  }, []);

  return (
    <div ref={ref} className="ctx-menu" style={{ left: x, top: y } as React.CSSProperties}>
      <div
        role="menuitem"
        tabIndex={0}
        className="ctx-item"
        onClick={() => {
          onTogglePin();
          onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onTogglePin();
            onClose();
          }
        }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
        </svg>
        {isPinned ? 'Désépingler' : 'Épingler'}
      </div>
      <div className="ctx-divider" />
      <div
        role="menuitem"
        tabIndex={0}
        className="ctx-item"
        onClick={() => {
          onDelete();
          onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onDelete();
            onClose();
          }
        }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
        </svg>
        Supprimer
      </div>
      <div
        role="menuitem"
        tabIndex={0}
        className="ctx-item"
        onClick={() => {
          onBlock();
          onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onBlock();
            onClose();
          }
        }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z" />
        </svg>
        Bloquer
      </div>
      <div
        role="menuitem"
        tabIndex={0}
        className="ctx-item"
        onClick={() => {
          onReport();
          onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onReport();
            onClose();
          }
        }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" />
        </svg>
        Signaler
      </div>
    </div>
  );
});

export default ConvContextMenu;
