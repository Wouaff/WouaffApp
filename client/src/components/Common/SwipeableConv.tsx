import { memo, type ReactNode, useCallback, useRef, useState } from 'react';

interface SwipeAction {
  label: string;
  icon: string;
  type: 'danger' | 'info';
  onClick: () => void;
}

interface SwipeableConvProps {
  children: ReactNode;
  actions: SwipeAction[];
}

const SwipeableConv = memo(function SwipeableConv({ children, actions }: SwipeableConvProps) {
  const [swiped, setSwiped] = useState(false);
  const touchStart = useRef({ x: 0, y: 0 });
  const itemRef = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => setSwiped(false), []);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy) && dx < -10 && itemRef.current) {
      itemRef.current.style.transform = `translateX(${Math.max(dx, -70)}px)`;
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    if (itemRef.current) itemRef.current.style.transform = '';
    if (dx < -40) setSwiped(true);
    else setSwiped(false);
  };

  return (
    <div className="relative overflow-hidden" onClick={reset}>
      <div className={`absolute inset-y-0 right-0 flex${swiped ? '' : ' hidden'}`}>
        {actions.map((a) => (
          <button
            key={a.label}
            className={`flex flex-col items-center justify-center w-[70px] text-xs font-bold border-none cursor-pointer text-white ${a.type === 'danger' ? 'bg-red-500' : 'bg-blue-500'}`}
            onClick={(e) => {
              e.stopPropagation();
              a.onClick();
              setSwiped(false);
            }}
          >
            <svg className="w-5 h-5 mb-1" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: a.icon }} />
            <span>{a.label}</span>
          </button>
        ))}
      </div>
      <div
        ref={itemRef}
        className={`relative z-10 transition-transform duration-200${swiped ? ' -translate-x-[70px]' : ''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
});

export default SwipeableConv;
