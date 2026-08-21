import { useEffect, useRef } from 'react';

export default function BuyMeACoffee() {
  const ref = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!ref.current || loaded.current) return;
    loaded.current = true;

    const container = ref.current;

    const originalWrite = document.write.bind(document);
    let buffer = '';
    document.write = (html: string) => {
      buffer += html;
      return true;
    };

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

    script.onload = () => {
      document.write = originalWrite;
      if (buffer) {
        container.innerHTML = buffer;
      }
    };
    script.onerror = () => {
      document.write = originalWrite;
    };

    document.head.appendChild(script);
  }, []);

  return (
    <div className="flex justify-center py-3 border-b border-[var(--border)]">
      <div ref={ref} />
    </div>
  );
}
