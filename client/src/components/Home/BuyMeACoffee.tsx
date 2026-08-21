import { useEffect, useRef } from 'react';

export default function BuyMeACoffee() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || ref.current.querySelector('script')) return;
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js';
    script.setAttribute('data-name', 'bmc-button');
    script.setAttribute('data-slug', 'wouaff');
    script.setAttribute('data-color', '#FFDD00');
    script.setAttribute('data-emoji', '🐺');
    script.setAttribute('data-font', 'Bree');
    script.setAttribute('data-text', 'Achetez-moi des croquettes');
    script.setAttribute('data-outline-color', '#000000');
    script.setAttribute('data-font-color', '#000000');
    script.setAttribute('data-coffee-color', '#ffffff');
    ref.current.appendChild(script);
  }, []);

  return (
    <div className="flex justify-center py-3 border-b border-[var(--border)]">
      <div ref={ref} />
    </div>
  );
}
