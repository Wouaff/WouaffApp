import { BarChart3, Check } from 'lucide-react';
import type { PostPoll } from '../../types';

interface PollProps {
  poll: PostPoll;
  onVote: (option: number) => void;
}

export default function Poll({ poll, onVote }: PollProps) {
  const total = poll.total || poll.votes.reduce((a, b) => a + b, 0);
  const voted = poll.votedIndex !== null && poll.votedIndex !== undefined;
  const pct = (i: number) => (total > 0 ? Math.round(((poll.votes[i] || 0) / total) * 100) : 0);

  return (
    <div
      className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-input)] p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <BarChart3 size={15} className="text-brand flex-shrink-0" />
        <span className="text-[14px] font-bold text-[var(--text-primary)] leading-snug">
          {poll.question || 'Sondage'}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {poll.options.map((opt, i) => {
          const isVoted = voted && poll.votedIndex === i;
          const p = pct(i);
          return (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: options de sondage ordonnées
              key={i}
              type="button"
              onClick={() => onVote(i)}
              disabled={voted}
              className={`relative overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors ${
                voted ? 'cursor-default' : 'cursor-pointer hover:border-brand'
              } ${isVoted ? 'border-brand bg-[var(--brand-glow)]' : 'border-[var(--border)] bg-[var(--bg-base)]'}`}
            >
              {voted && (
                <span
                  className="absolute inset-y-0 left-0 bg-[var(--brand-glow)] transition-all duration-500"
                  style={{ width: `${p}%` }}
                />
              )}
              <span className="relative flex items-center justify-between gap-2">
                <span className="text-[14px] text-[var(--text-primary)] truncate">{opt}</span>
                {voted && <span className="text-[13px] font-bold text-[var(--text-secondary)] tabular-nums">{p}%</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[12px] text-[var(--text-muted)]">
          {total} vote{total > 1 ? 's' : ''}
        </span>
        {voted ? (
          <span className="flex items-center gap-1 text-[12px] font-bold text-brand">
            <Check size={13} /> Voté
          </span>
        ) : (
          <span className="text-[12px] text-[var(--text-muted)]">Touchez pour voter</span>
        )}
      </div>
    </div>
  );
}
