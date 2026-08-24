import { Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { communities as communitiesAPI } from '../../services/api';
import type { Community } from '../../types';
import { showToast } from '../Common/Toast';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}k`;
  return String(n);
}

interface CommunityCardProps {
  community: Community;
  onChanged?: (community: Community) => void;
  compact?: boolean;
}

export default function CommunityCard({ community, onChanged, compact }: CommunityCardProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const subscribed = community.isSubscribed;

  const toggleSubscribe = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (subscribed) {
        await communitiesAPI.unsubscribe(community.name);
        showToast(`Désabonné de c/${community.name}`);
      } else {
        await communitiesAPI.subscribe(community.name);
        showToast(`Abonné à c/${community.name}`);
      }
      onChanged?.({
        ...community,
        isSubscribed: !subscribed,
        memberCount: subscribed ? community.memberCount - 1 : community.memberCount + 1,
      });
    } catch (err) {
      showToast((err as Error).message || 'Une erreur est survenue', 'error');
    } finally {
      setBusy(false);
    }
  };

  const initial = (community.displayName || community.name)[0]?.toUpperCase() || 'r';

  return (
    <article
      className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
      onClick={() => navigate(`/c/${community.name}`)}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-lg overflow-hidden flex-shrink-0">
          {community.avatar ? (
            <img src={community.avatar} alt={`Avatar de c/${community.name}`} className="w-full h-full object-cover" />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[var(--text-primary)] text-[15px] truncate">c/{community.name}</span>
            {community.isPrivate && (
              <span className="text-[10px] font-bold text-[var(--text-muted)] border border-[var(--border)] rounded-full px-2 py-0.5">
                Privé
              </span>
            )}
          </div>
          {community.displayName && community.displayName !== community.name && (
            <div className="text-[13px] text-[var(--text-secondary)] truncate">{community.displayName}</div>
          )}
          <div className="flex items-center gap-1 text-[12px] text-[var(--text-muted)] mt-0.5">
            <Users size={13} />
            <span>{formatCount(community.memberCount)} membres</span>
            <span>·</span>
            <span>{formatCount(community.postCount)} posts</span>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleSubscribe}
          disabled={busy}
          className={`flex-shrink-0 font-bold text-[13px] rounded-full px-4 py-2 border cursor-pointer transition-colors disabled:opacity-50 ${
            subscribed
              ? 'bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--danger)] hover:text-[var(--danger)]'
              : 'bg-brand hover:opacity-90 text-white border-transparent'
          }`}
        >
          {subscribed ? 'Abonné' : "S'abonner"}
        </button>
      </div>
      {!compact && community.description && (
        <p className="m-0 text-[13px] leading-relaxed text-[var(--text-secondary)] line-clamp-2">
          {community.description}
        </p>
      )}
    </article>
  );
}
