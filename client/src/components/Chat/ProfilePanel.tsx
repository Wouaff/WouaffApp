import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { badges as badgesAPI, profiles as profilesAPI } from '../../services/api';
import { offProfileUpdated, offStatusChanged, onProfileUpdated, onStatusChanged } from '../../services/socket';
import type { UserProfile } from '../../types';
import CallButton from '../Call/CallButton';

type BadgeDef = { name?: string; icon?: string };

interface ProfilePanelProps {
  onClose: () => void;
  targetUid?: string;
}

export default function ProfilePanel({ onClose, targetUid }: ProfilePanelProps) {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [badgeDefs, setBadgeDefs] = useState<Record<string, BadgeDef>>({});
  const uid = targetUid || user?.uid || '';

  useEffect(() => {
    if (!uid) return;
    badgesAPI
      .list()
      .then(setBadgeDefs)
      .catch(() => {});
    (async () => {
      try {
        const p = (await profilesAPI.get(uid)) as UserProfile;
        setProfile(p);
      } catch {
        /* ignore */
      }
    })();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const handleProfileUpdate = (data: { uid: string } & Record<string, unknown>) => {
      if (data.uid === uid) {
        setProfile((prev) => (prev ? { ...prev, ...data } : prev));
      }
    };
    const handleStatus = (data: { uid: string; status: string }) => {
      if (data.uid === uid) {
        setProfile((prev) => (prev ? { ...prev, status: data.status } : prev));
      }
    };
    onProfileUpdated(handleProfileUpdate);
    onStatusChanged(handleStatus);
    return () => {
      offProfileUpdated(handleProfileUpdate);
      offStatusChanged(handleStatus);
    };
  }, [uid]);

  const p = profile;
  const initial = (p?.pseudo || '?')[0]?.toUpperCase() || '?';
  const isOnline = p?.status === 'online';
  const rawBadges = p?.ownedBadges;
  const badgeIds = Array.isArray(rawBadges) ? rawBadges : rawBadges ? Object.values(rawBadges) : [];

  return (
    <aside className="profile-panel" id="profilePanel">
      <div className="profile-panel-header">
        <span>Profil</span>
        <button type="button" className="profile-panel-close" onClick={onClose} aria-label="Fermer le profil">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>
      <div className="profile-panel-body">
        {p?.banner && (
          <div
            className="profile-panel-banner"
            style={
              {
                backgroundImage: `url(${p.banner})`,
                height: 80,
                backgroundSize: 'cover',
                borderRadius: '8px 8px 0 0',
              } as React.CSSProperties
            }
          />
        )}
        <div className="profile-panel-avatar" style={{ marginTop: p?.banner ? -32 : 0 } as React.CSSProperties}>
          {p?.avatar ? (
            <img
              src={p.avatar}
              alt={p?.pseudo || 'Avatar'}
              className="w-16 h-16 rounded-full object-cover border-[3px] border-[var(--bg)]"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center text-2xl font-bold text-white border-[3px] border-[var(--bg)]">
              {initial}
            </div>
          )}
        </div>
        <div className="profile-panel-name">{p?.pseudo || 'Utilisateur'}</div>
        {p?.wouaffId && <div className="text-xs text-text-muted">{p.wouaffId}</div>}
        <div className="text-xs" style={{ color: isOnline ? '#43b581' : 'var(--text-muted)' } as React.CSSProperties}>
          {isOnline ? 'En ligne' : 'Hors ligne'}
        </div>
        {badgeIds.length > 0 && (
          <div className="profile-badges-row justify-center mt-2">
            {badgeIds.map((id) => {
              const def = badgeDefs[id];
              return (
                <span key={id} className="badge-chip">
                  {def?.icon && <img src={def.icon} alt="" />}
                  {def?.name || id}
                </span>
              );
            })}
          </div>
        )}
        {p?.bio && <div className="text-xs mt-2 text-[var(--text)] px-3">{p.bio}</div>}
        <div className="text-xs text-text-muted mt-2">{user?.email}</div>
        {targetUid && targetUid !== user?.uid && (
          <div className="mt-4 flex justify-center">
            <CallButton targetUid={targetUid} pseudo={p?.pseudo || targetUid} avatar={p?.avatar} />
          </div>
        )}
        {(!targetUid || targetUid === user?.uid) && (
          <button type="button" className="logout-btn mt-6" onClick={logout}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-label="Déconnexion">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
            </svg>
            Déconnexion
          </button>
        )}
      </div>
    </aside>
  );
}
