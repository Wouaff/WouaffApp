import { Copy, Download } from 'lucide-react';
import { useState } from 'react';
import { outlineBtn, primaryBtn } from './formStyles';

/** Affiche les codes de secours une seule fois (le serveur n'en garde que l'empreinte). */
export default function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([`Codes de secours Wouaff (usage unique)\n\n${text}\n`], { type: 'text/plain' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wouaff-codes-de-secours.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="border border-[var(--accent)] rounded-xl p-4 mt-3 space-y-3"
      role="region"
      aria-label="Codes de secours"
    >
      <p className="font-bold text-[var(--text-primary)]">Tes codes de secours</p>
      <p className="text-sm text-[var(--text-secondary)]">
        Si tu perds ton application d'authentification, chacun de ces codes permet une connexion (une seule fois).
        Conserve-les dans un endroit sûr : ils ne seront plus affichés.
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[var(--text-primary)] list-none p-0 m-0">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${outlineBtn} inline-flex items-center gap-2`} onClick={copy}>
          <Copy className="w-4 h-4" /> {copied ? 'Copié' : 'Copier'}
        </button>
        <button type="button" className={`${outlineBtn} inline-flex items-center gap-2`} onClick={download}>
          <Download className="w-4 h-4" /> Télécharger
        </button>
        <button type="button" className={primaryBtn} onClick={onDone}>
          J'ai noté mes codes
        </button>
      </div>
    </div>
  );
}
