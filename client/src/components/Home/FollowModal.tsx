import { BadgeCheck, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { type FollowUser, profiles as profilesAPI, publicProfile } from '../../services/api';

interface FollowModalProps {
  wouaffId: string;
  kind: 'followers' | 'following';
  onClose: () => void;
  onChange: (kind: 'followers' | 'following', delta: number) => void;
}

const TITLES: Record<FollowModalProps['kind'], string> = {
  followers: 'Abonnés',
  following: 'Abonnements',
};

export default function FollowModal({ wouaffId, kind, onClose, onChange }: FollowModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data =
        kind === 'followers' ? await publicProfile.followers(wouaffId) : await publicProfile.following(wouaffId);
      setUsers(data.users);
    } catch {
      setError('Impossible de charger la liste.');
    } finally {
      setLoading(false);
    }
  }, [wouaffId, kind]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleFollow = useCallback(
    async (u: FollowUser) => {
      if (!user || u.isMe) return;
      try {
        if (u.isFollowing) {
          await profilesAPI.unfollow(u.uid);
          setUsers((prev) => prev.map((x) => (x.uid === u.uid ? { ...x, isFollowing: false } : x)));
          onChange('following', -1);
        } else {
          await profilesAPI.follow(u.uid);
          setUsers((prev) => prev.map((x) => (x.uid === u.uid ? { ...x, isFollowing: true } : x)));
          onChange('following', 1);
        }
      } catch {
        /* ignore */
      }
    },
    [user, onChange],
  );

  const openProfile = (u: FollowUser) => {
    const handle = ((u.wouaffId as string) || u.uid).replace(/^@/, '');
    onClose();
    navigate(`/@${handle}`);
  };

  return (
    <div
      className="modal-overlay active"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex flex-col w-full max-w-[440px] max-h-[85dvh] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl">
        <div className="flex items-center gap-4 px-4 h-14 border-b border-[var(--border)] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-primary)] border-none bg-transparent cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={18} />
          </button>
          <span className="font-bold text-[var(--text-primary)] text-[17px] m-0">{TITLES[kind]}</span>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="spinner" />
            </div>
          ) : error ? (
            <div className="py-10 text-center">
              <p className="m-0 text-[var(--text-secondary)]">{error}</p>
            </div>
          ) : users.length === 0 ? (
            <div className="py-10 text-center">
              <p className="m-0 text-[var(--text-secondary)]">
                {kind === 'followers' ? 'Aucun abonné pour le moment.' : 'Aucun abonnement pour le moment.'}
              </p>
            </div>
          ) : (
            <ul className="list-none m-0 p-0">
              {users.map((u) => (
                <li
                  key={u.uid}
                  className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => openProfile(u)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left border-none bg-transparent p-0 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-extrabold text-sm overflow-hidden flex-shrink-0">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={`Avatar de ${u.pseudo || "l'utilisateur"}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{(u.pseudo || '?')[0]?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-[var(--text-primary)] text-[14px] truncate">
                          {u.pseudo || 'Utilisateur'}
                        </span>
                        {u.isMe && <BadgeCheck size={15} className="text-brand flex-shrink-0" aria-label="Vous" />}
                      </div>
                      <span className="text-[var(--text-muted)] text-[13px]">
                        @{((u.wouaffId as string) || u.uid).replace(/^@/, '')}
                      </span>
                    </div>
                  </button>
                  {user && !u.isMe && (
                    <button
                      type="button"
                      onClick={() => toggleFollow(u)}
                      className={`flex-shrink-0 transition-colors font-bold text-[13px] rounded-full px-4 py-1.5 cursor-pointer ${
                        u.isFollowing
                          ? 'bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-hover)]'
                          : 'bg-brand text-white border-none hover:opacity-90'
                      }`}
                    >
                      {u.isFollowing ? 'Abonné' : 'Suivre'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
