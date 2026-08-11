import { useState } from 'react';
import type { PostPoll } from '../../types';

interface PollProps {
  poll: PostPoll;
  onVote: (option: number) => void;
}

export default function Poll({ poll, onVote }: PollProps) {
  const [pendingVote, setPendingVote] = useState<number | null>(null);
  const total = poll.total || poll.votes.reduce((a, b) => a + b, 0);
  const voted = poll.votedIndex !== null && poll.votedIndex !== undefined;
  const pct = (i: number) => (total > 0 ? Math.round(((poll.votes[i] || 0) / total) * 100) : 0);

  return (
    <div
      className="mt-3 overflow-hidden rounded-xl border border-brand/35 bg-[#151b24]"
      onClick={(event) => event.stopPropagation()}
    >
      {poll.question && (
        <div className="border-b border-brand/15 px-3.5 py-3 text-[14px] font-bold leading-snug text-[var(--text-primary)]">
          {poll.question}
        </div>
      )}

      <div className="flex flex-col gap-2 p-3">
        {poll.options.map((option, index) => {
          const isVoted = voted && poll.votedIndex === index;
          const percentage = pct(index);
          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                if (!voted) {
                  onVote(index);
                  return;
                }
                if (poll.votedIndex !== index) setPendingVote(index);
              }}
              className={`relative overflow-hidden rounded-lg border-0 px-3 py-2.5 text-left transition-colors ${
                isVoted ? 'cursor-default' : 'cursor-pointer hover:bg-[#252d38]'
              } ${isVoted ? 'bg-[var(--brand-glow)] animate-[pollChoice_0.25s_ease-out]' : 'bg-[#1c2430]'}`}
            >
              {voted && (
                <span
                  className="absolute inset-y-0 left-0 origin-left bg-[var(--brand-glow)] animate-[pollFill_0.55s_ease-out]"
                  style={{ width: `${percentage}%` }}
                />
              )}
              <span className="relative flex items-center gap-2.5">
                <span
                  className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isVoted ? 'border-brand bg-brand/15' : 'border-[#f08a52] bg-[#f08a52]/10'}`}
                >
                  {isVoted && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--text-primary)]">{option}</span>
                {voted && (
                  <span className="text-[13px] font-bold text-[var(--text-secondary)] tabular-nums">{percentage}%</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {pendingVote !== null && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55 px-5 animate-[pollBackdropIn_0.18s_ease-out]"
          onClick={() => setPendingVote(null)}
        >
          <div
            className="w-full max-w-[340px] rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.45)] animate-[pollConfirmIn_0.22s_ease-out]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-[15px] font-bold text-[var(--text-primary)]">Changer ton vote ?</div>
            <div className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
              Ton nouveau choix sera « {poll.options[pendingVote]} ».
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="border-0 bg-transparent px-2 py-1.5 text-[13px] font-bold text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)]"
                onClick={() => setPendingVote(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="rounded-full border-0 bg-brand-dark px-4 py-1.5 text-[13px] font-bold text-white cursor-pointer hover:bg-[#c75a24]"
                onClick={() => {
                  onVote(pendingVote);
                  setPendingVote(null);
                }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-brand/15 px-3.5 py-2 text-[11px] text-[var(--text-secondary)]">
        {total} vote{total > 1 ? 's' : ''}
      </div>
    </div>
  );
}
