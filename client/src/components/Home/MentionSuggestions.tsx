import type { MentionUser } from '../../types';

interface MentionSuggestionsProps {
  open: boolean;
  query: string;
  results: MentionUser[];
  activeIndex: number;
  onSelect: (user: MentionUser) => void;
}

export default function MentionSuggestions({ open, query, results, activeIndex, onSelect }: MentionSuggestionsProps) {
  if (!open || results.length === 0) return null;

  return (
    <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow)]">
      <div className="px-4 py-2 text-[12px] text-[var(--text-muted)] border-b border-[var(--border)]">
        Mentions : « @{query} »
      </div>
      <ul className="list-none m-0 p-0">
        {results.map((user, i) => {
          const initial = (user.pseudo || '?')[0]?.toUpperCase() || '?';
          return (
            <li key={user.uid}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(user);
                }}
                onMouseEnter={() => {}}
                className={`w-full flex items-center gap-3 px-4 py-2.5 border-none bg-transparent cursor-pointer text-left transition-colors ${
                  i === activeIndex ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={`Avatar de ${user.pseudo || "l'utilisateur"}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initial}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-[var(--text-primary)] truncate">{user.pseudo}</div>
                  <div className="text-[13px] text-[var(--text-muted)] truncate">{user.handle}</div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
