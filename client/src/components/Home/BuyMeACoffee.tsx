export default function BuyMeACoffee() {
  return (
    <div className="flex justify-center py-3 border-b border-[var(--border)]">
      <a
        href="https://www.buymeacoffee.com/wouaff"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-[Bree] text-sm font-bold no-underline transition-opacity hover:opacity-90"
        style={{
          backgroundColor: '#FFDD00',
          color: '#000000',
          border: '2px solid #000000',
        }}
      >
        <span className="text-lg">🐺</span>
        <span>Achetez-moi des croquettes</span>
      </a>
    </div>
  );
}
