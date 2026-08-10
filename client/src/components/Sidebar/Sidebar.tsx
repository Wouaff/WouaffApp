import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  badges as badgesAPI,
  blocks as blocksAPI,
  contacts as contactsAPI,
  conversations as convAPI,
  groups as groupsAPI,
  stories as storiesAPI,
} from '../../services/api';
import {
  getSocket,
  offAccountDeleted,
  offContactAdded,
  offContactRemoved,
  offContactRequest,
  offContactRequestAccepted,
  offContactRequestRejected,
  offGroupCreated,
  offGroupDeleted,
  offGroupMemberAdded,
  offGroupMemberRemoved,
  offGroupUpdated,
  offMessageAdded,
  offProfileUpdated,
  offStatusChanged,
  offStoryAdded,
  offStoryRemoved,
  onAccountDeleted,
  onContactAdded,
  onContactRemoved,
  onContactRequest,
  onContactRequestAccepted,
  onContactRequestRejected,
  onGroupCreated,
  onGroupDeleted,
  onGroupMemberAdded,
  onGroupMemberRemoved,
  onGroupUpdated,
  onMessageAdded,
  onProfileUpdated,
  onStatusChanged,
  onStoryAdded,
  onStoryRemoved,
} from '../../services/socket';
import type { GroupData, MessageData, SocketMessageEvent, UserProfile } from '../../types';
import { playMessageSound } from '../../utils/notificationSound';
import ConvContextMenu from '../Common/ConvContextMenu';
import SwipeableConv from '../Common/SwipeableConv';

interface ConvEntry {
  id: string;
  type: 'dm' | 'group';
  profile?: UserProfile;
  group?: GroupData;
  lastMsg: MessageData | null;
  lastTime: number;
}

interface PendingRequest {
  fromUid: string;
  profile: UserProfile;
  createdAt: number;
}

interface StoryUser {
  uid: string;
  pseudo: string;
  avatar?: string;
  initials: string;
  hasStories: boolean;
  allViewed: boolean;
  isMe: boolean;
}

interface SidebarProps {
  chatWith: string | null;
  currentGroupId: string | null;
  onOpenChat: (uid: string, pseudo: string) => void;
  onOpenGroup: (gid: string) => void;
  onToggleProfile: () => void;
  onOpenSettings: () => void;
  onOpenAddContact: () => void;
  onOpenNewGroup: () => void;
  onOpenStoryViewer?: (uid: string) => void;
  onOpenStoryCreator?: () => void;
  onOpenUserProfile?: (uid: string) => void;
}

function buildConvsEntries(convData: { dms: Record<string, unknown>; groups: Record<string, unknown> }): ConvEntry[] {
  const entries: ConvEntry[] = [];
  for (const [uid, d] of Object.entries(convData.dms || {})) {
    const entry = d as { profile?: UserProfile; lastMsg?: MessageData | null; lastTime?: number };
    if (entry.profile) {
      entries.push({
        id: uid,
        type: 'dm',
        profile: entry.profile,
        lastMsg: entry.lastMsg || null,
        lastTime: entry.lastTime || 0,
      });
    }
  }
  for (const [gid, d] of Object.entries(convData.groups || {})) {
    const entry = d as { group?: GroupData; lastMsg?: MessageData | null; lastTime?: number };
    if (entry.group) {
      entries.push({
        id: gid,
        type: 'group',
        group: entry.group,
        lastMsg: entry.lastMsg || null,
        lastTime: entry.lastTime || 0,
      });
    }
  }
  return entries.sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0));
}

export default function Sidebar({
  chatWith,
  currentGroupId,
  onOpenChat,
  onOpenGroup,
  onToggleProfile,
  onOpenSettings,
  onOpenAddContact,
  onOpenNewGroup,
  onOpenStoryViewer,
  onOpenStoryCreator,
  onOpenUserProfile,
}: SidebarProps) {
  const { user } = useAuth();
  const [convs, setConvs] = useState<ConvEntry[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [pendingOpen, setPendingOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [storyUsers, setStoryUsers] = useState<StoryUser[]>([]);
  const [badgeDefs, setBadgeDefs] = useState<Record<string, { name?: string; icon?: string }>>({});
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; conv: ConvEntry } | null>(null);
  const [pendingLoading, setPendingLoading] = useState<Record<string, 'accept' | 'reject' | null>>({});
  const [pinned, setPinned] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('pinned_convs') || '[]');
    } catch {
      return [];
    }
  });

  const togglePin = useCallback((id: string) => {
    setPinned((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      localStorage.setItem('pinned_convs', JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    badgesAPI
      .list()
      .then(setBadgeDefs)
      .catch((e) => {
        console.error(e);
      });
  }, []);

  const fetchRef = useRef<(() => Promise<void>) | null>(null);

  /* Refetch ciblé : recharge uniquement les conversations (pas stories/profil) */
  const loadConvs = useCallback(async () => {
    if (!user) return;
    try {
      const convData = await convAPI.list();
      setConvs(buildConvsEntries(convData));
    } catch (e) {
      console.error(e);
    }
  }, [user]);
  const loadConvsRef = useRef(loadConvs);
  useEffect(() => {
    loadConvsRef.current = loadConvs;
  }, [loadConvs]);

  const loadPending = useCallback(async () => {
    if (!user) return;
    try {
      const res = await contactsAPI.pending();
      setPendingRequests(
        res.incoming.map((r: { fromUid: string; profile: UserProfile; createdAt: number }) => ({
          fromUid: r.fromUid,
          profile: r.profile,
          createdAt: r.createdAt,
        })),
      );
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fn = async () => {
      try {
        const [convData, storiesData, myStoriesData, profileRes] = await Promise.all([
          convAPI.list(),
          storiesAPI.list(),
          storiesAPI.mine(),
          fetch('/api/profiles/me')
            .then((r) => r.json() as Promise<UserProfile>)
            .catch(() => null),
        ]);
        if (cancelled) return;

        const profiles: Record<string, UserProfile> = {};
        for (const [uid, d] of Object.entries(convData.dms || {})) {
          const entry = d as { profile?: UserProfile };
          if (entry.profile) profiles[uid] = entry.profile;
        }
        setConvs(buildConvsEntries(convData));

        if (profileRes) setMyProfile(profileRes);

        const myStoriesVal = myStoriesData as Record<string, unknown>;
        const myStoryCount = Object.keys(myStoriesVal).length;
        const now = Date.now();

        const sUsers: StoryUser[] = [];
        if (profileRes) {
          sUsers.push({
            uid: user.uid,
            pseudo: 'Votre story',
            hasStories: myStoryCount > 0,
            initials: (profileRes.pseudo || '?')[0].toUpperCase(),
            isMe: true,
            allViewed: false,
          });
        }
        for (const [uid, stories] of Object.entries(storiesData as Record<string, Record<string, unknown>>)) {
          if (uid === user.uid) continue;
          const activeStories = Object.values(stories).filter(
            (s: unknown) => ((s as Record<string, unknown>).expiresAt as number) > now,
          );
          if (activeStories.length === 0) continue;
          const profile = profiles[uid];
          const allViewed = activeStories.every((s: unknown) => {
            const v = ((s as Record<string, unknown>).viewedBy as Record<string, boolean>) || {};
            return v[user.uid] === true;
          });
          sUsers.push({
            uid,
            pseudo: profile?.pseudo || '?',
            avatar: profile?.avatar,
            initials: (profile?.pseudo || '?')[0]?.toUpperCase() || '?',
            hasStories: true,
            allViewed,
            isMe: false,
          });
        }
        setStoryUsers(sUsers);
      } catch (e) {
        console.error('loadAll error:', e);
      }
    };
    fetchRef.current = fn;
    fn();
    const interval = setInterval(fn, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  /* Load pending requests on mount */
  useEffect(() => {
    loadPending();
  }, [loadPending]);

  /* Socket listeners: real-time updates for all features */
  useEffect(() => {
    if (!user) return;

    const fetchAll = () => fetchRef.current?.();
    const refreshConvs = () => loadConvsRef.current?.();

    const handleContactRequest = () => {
      setPendingOpen(true);
      loadPending();
    };

    const handleStatusChanged = (data: { uid: string; status: string }) => {
      setConvs((prev) =>
        prev.map((c) => {
          if (c.type === 'dm' && c.id === data.uid && c.profile) {
            return { ...c, profile: { ...c.profile, status: data.status } };
          }
          return c;
        }),
      );
    };

    const handleGroupCreated = () => refreshConvs();
    const handleGroupUpdated = (data: { gid: string } & Record<string, unknown>) => {
      setConvs((prev) =>
        prev.map((c) => (c.type === 'group' && c.id === data.gid ? { ...c, group: { ...c.group!, ...data } } : c)),
      );
    };
    const handleGroupDeleted = (data: { gid: string }) => {
      setConvs((prev) => prev.filter((c) => !(c.type === 'group' && c.id === data.gid)));
    };
    const handleGroupMemberAdded = (data: { gid: string; name?: string }) => {
      if (data.name !== undefined) refreshConvs();
    };
    const handleGroupMemberRemoved = (data: { gid: string; kicked?: boolean }) => {
      if (data.kicked) setConvs((prev) => prev.filter((c) => !(c.type === 'group' && c.id === data.gid)));
      else refreshConvs();
    };
    const handleProfileUpdated = (data: { uid: string } & Record<string, unknown>) => {
      setConvs((prev) =>
        prev.map((c) => {
          if (c.type === 'dm' && c.id === data.uid && c.profile) {
            return { ...c, profile: { ...c.profile, ...data } };
          }
          return c;
        }),
      );
    };
    const handleAccountDeleted = (data: { uid: string }) => {
      setConvs((prev) => prev.filter((c) => !(c.type === 'dm' && c.id === data.uid)));
    };
    const handleContactRemoved = (data: { by: string }) => {
      setConvs((prev) => prev.filter((c) => !(c.type === 'dm' && c.id === data.by)));
      refreshConvs();
    };
    const handleStoryAdded = (data: { uid: string; storyId: string }) => {
      setStoryUsers((prev) =>
        prev.some((s) => s.uid === data.uid)
          ? prev
          : [
              ...prev,
              {
                uid: data.uid,
                pseudo: '',
                avatar: undefined,
                initials: '?',
                hasStories: true,
                allViewed: false,
                isMe: false,
              },
            ],
      );
      fetchAll();
    };
    const handleStoryRemoved = (_data: { uid: string }) => {
      fetchAll();
    };
    const handleMessageAdded = (ev: SocketMessageEvent) => {
      refreshConvs();
      if (ev.data.from !== user?.uid) playMessageSound();
    };

    onStatusChanged(handleStatusChanged);
    onContactAdded(refreshConvs);
    onContactRemoved(handleContactRemoved);
    onContactRequest(handleContactRequest);
    onContactRequestAccepted(refreshConvs);
    const handleContactRequestRejected = (data: { by: string }) => {
      setPendingRequests((prev) => prev.filter((r) => r.fromUid !== data.by));
      refreshConvs();
    };
    onContactRequestRejected(handleContactRequestRejected);
    onGroupCreated(handleGroupCreated);
    onGroupUpdated(handleGroupUpdated);
    onGroupDeleted(handleGroupDeleted);
    onGroupMemberAdded(handleGroupMemberAdded);
    onGroupMemberRemoved(handleGroupMemberRemoved);
    onProfileUpdated(handleProfileUpdated);
    onAccountDeleted(handleAccountDeleted);
    onStoryAdded(handleStoryAdded);
    onStoryRemoved(handleStoryRemoved);
    onMessageAdded(handleMessageAdded);
    const sock = getSocket();
    sock?.on('connect', fetchAll);

    return () => {
      offStatusChanged(handleStatusChanged);
      offContactAdded(refreshConvs);
      offContactRemoved(handleContactRemoved);
      offContactRequest(handleContactRequest);
      offContactRequestAccepted(refreshConvs);
      offContactRequestRejected(handleContactRequestRejected);
      offGroupCreated(handleGroupCreated);
      offGroupUpdated(handleGroupUpdated);
      offGroupDeleted(handleGroupDeleted);
      offGroupMemberAdded(handleGroupMemberAdded);
      offGroupMemberRemoved(handleGroupMemberRemoved);
      offProfileUpdated(handleProfileUpdated);
      offAccountDeleted(handleAccountDeleted);
      offStoryAdded(handleStoryAdded);
      offStoryRemoved(handleStoryRemoved);
      offMessageAdded(handleMessageAdded);
      sock?.off('connect', fetchAll);
    };
  }, [user, loadPending]);

  const filtered = useMemo(
    () =>
      (search.trim()
        ? convs.filter((c) => {
            const name = c.type === 'dm' ? c.profile?.pseudo || '' : c.group?.name || '';
            return name.toLowerCase().includes(search.toLowerCase());
          })
        : convs
      ).sort((a, b) => {
        const aPinned = pinned.includes(a.id) ? 1 : 0;
        const bPinned = pinned.includes(b.id) ? 1 : 0;
        return bPinned - aPinned;
      }),
    [convs, search, pinned],
  );

  const handleDeleteConv = useCallback(async (uid: string) => {
    try {
      await contactsAPI.remove(uid);
    } catch (e) {
      console.error(e);
    }
    setConvs((prev) => prev.filter((c) => !(c.type === 'dm' && c.id === uid)));
  }, []);

  const handleLeaveGroup = useCallback(
    async (gid: string) => {
      try {
        await groupsAPI.removeMember(gid, user!.uid);
      } catch (e) {
        console.error(e);
      }
      setConvs((prev) => prev.filter((c) => !(c.type === 'group' && c.id === gid)));
    },
    [user],
  );

  const handleCtxDelete = useCallback(
    async (conv: ConvEntry) => {
      if (conv.type === 'group') {
        await handleLeaveGroup(conv.id);
      } else {
        await handleDeleteConv(conv.id);
      }
    },
    [handleDeleteConv, handleLeaveGroup],
  );

  const handleCtxBlock = useCallback(async (conv: ConvEntry) => {
    if (conv.type !== 'dm') return;
    try {
      await blocksAPI.block(conv.id);
      await contactsAPI.remove(conv.id);
      setConvs((prev) => prev.filter((c) => !(c.type === 'dm' && c.id === conv.id)));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleCtxReport = useCallback(async (conv: ConvEntry) => {
    try {
      await blocksAPI.report(conv.id);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleAcceptRequest = useCallback(async (fromUid: string) => {
    setPendingLoading((prev) => ({ ...prev, [fromUid]: 'accept' }));
    try {
      await contactsAPI.accept(fromUid);
      setPendingRequests((prev) => prev.filter((r) => r.fromUid !== fromUid));
      fetchRef.current?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      import('../Common/Toast').then((m) => m.showToast(msg, 'error'));
    } finally {
      setPendingLoading((prev) => ({ ...prev, [fromUid]: null }));
    }
  }, []);

  const handleRejectRequest = useCallback(async (fromUid: string) => {
    setPendingLoading((prev) => ({ ...prev, [fromUid]: 'reject' }));
    try {
      await contactsAPI.reject(fromUid);
      setPendingRequests((prev) => prev.filter((r) => r.fromUid !== fromUid));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      import('../Common/Toast').then((m) => m.showToast(msg, 'error'));
    } finally {
      setPendingLoading((prev) => ({ ...prev, [fromUid]: null }));
    }
  }, []);

  const handleCtxMenu = useCallback((e: React.MouseEvent, conv: ConvEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, conv });
  }, []);

  const myAvatar = myProfile?.avatar || '';
  const myInitial = (myProfile?.pseudo || '?')[0]?.toUpperCase() || '?';

  return (
    <div id="sidebar" className="sidebar">
      {/* Stories bar */}
      {(storyUsers.length > 0 || onOpenStoryCreator) && (
        <div id="storiesBar" className="stories-bar">
          {onOpenStoryCreator && (
            <div
              className="story-avatar-wrap"
              onClick={onOpenStoryCreator}
              title="Ajouter une story"
              role="button"
              tabIndex={0}
              aria-label="Ajouter une story"
            >
              <div className="story-avatar story-add-avatar">
                <div className="story-add-icon">+</div>
              </div>
              <div className="story-name">Ajouter</div>
            </div>
          )}
          {storyUsers.map((su) => (
            <div
              key={su.uid}
              className="story-avatar-wrap"
              onClick={() => onOpenStoryViewer?.(su.uid)}
              role="button"
              tabIndex={0}
              aria-label={`Story de ${su.pseudo}`}
            >
              <div
                className={`story-avatar ${su.hasStories ? (su.allViewed ? 'story-ring viewed' : 'story-ring') : ''}`}
              >
                {su.avatar ? (
                  <img src={su.avatar} alt={su.pseudo} loading="lazy" decoding="async" />
                ) : (
                  <span>{su.initials}</span>
                )}
              </div>
              <div className="story-name">{su.isMe ? 'Votre story' : su.pseudo}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="sidebar-search">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
        <input
          id="searchConv"
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Contact requests */}
      {pendingRequests.length > 0 && (
        <div id="pendingContainer" className="pending-container">
          <div className="pending-header" onClick={() => setPendingOpen(!pendingOpen)} role="button" tabIndex={0}>
            <span>Demandes d'ami ({pendingRequests.length})</span>
            <span id="pendingToggleIcon">{pendingOpen ? '▾' : '▸'}</span>
          </div>
          {pendingOpen && (
            <div id="pendingList" className="pending-list">
              {pendingRequests.map((r) => {
                const loading = pendingLoading[r.fromUid];
                const initial = (r.profile.pseudo || '?')[0]?.toUpperCase() || '?';
                return (
                  <div key={r.fromUid} className="pending-item">
                    <div className="pending-item-avatar">
                      {r.profile.avatar ? (
                        <img src={r.profile.avatar} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span>{initial}</span>
                      )}
                    </div>
                    <div className="pending-item-name">{r.profile.pseudo || '?'}</div>
                    <div className="pending-item-actions">
                      <button
                        className="pending-accept-btn"
                        disabled={!!loading}
                        onClick={() => handleAcceptRequest(r.fromUid)}
                        title="Accepter"
                      >
                        {loading === 'accept' ? (
                          <span className="spinner-sm" />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        )}
                      </button>
                      <button
                        className="pending-decline-btn"
                        disabled={!!loading}
                        onClick={() => handleRejectRequest(r.fromUid)}
                        title="Refuser"
                      >
                        {loading === 'reject' ? (
                          <span className="spinner-sm" />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Conversations list */}
      <div id="conversationsList" className="conversations-list">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-text-muted text-sm">
            {search ? 'Aucun résultat' : 'Aucune conversation.\nAjoutez un contact pour commencer !'}
          </div>
        ) : (
          filtered.map((c) => {
            const isActive = c.type === 'group' ? currentGroupId === c.id : chatWith === c.id;
            const _name = c.type === 'dm' ? c.profile?.pseudo || '?' : c.group?.name || 'Groupe';
            const preview = c.lastMsg?.deleted ? <em>Message supprimé</em> : c.lastMsg?.text || <em>Aucun message</em>;
            const timeStr = c.lastMsg?.time ? formatTime(c.lastMsg.time) : '';

            if (c.type === 'group') {
              const g = c.group!;
              const iconUrl = g.icon || 'https://cdn-icons-png.flaticon.com/512/4128/4128199.png';
              return (
                <SwipeableConv
                  key={c.id}
                  actions={[
                    {
                      label: 'Quitter',
                      icon: '<path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>',
                      type: 'danger',
                      onClick: () => handleLeaveGroup(c.id),
                    },
                  ]}
                >
                  <div
                    className={`conv-item${isActive ? ' active' : ''}`}
                    onClick={() => onOpenGroup(c.id)}
                    onContextMenu={(e) => handleCtxMenu(e, c)}
                  >
                    <div className="conv-avatar group-avatar">
                      <img src={iconUrl} alt={g.name} loading="lazy" decoding="async" />
                    </div>
                    <div className="conv-info">
                      <div className="conv-row">
                        <div className="conv-name">
                          {g.name}
                          <span className="group-icon">groupe</span>
                        </div>
                        <div className="conv-time">{timeStr}</div>
                      </div>
                      <div className="conv-preview">{preview}</div>
                    </div>
                  </div>
                </SwipeableConv>
              );
            }

            const p = c.profile!;
            const initial = (p.pseudo || '?')[0]?.toUpperCase() || '?';
            const isOnline = p.status === 'online';
            const rawBadges = p.ownedBadges;
            const badgeIds: string[] = Array.isArray(rawBadges) ? rawBadges : rawBadges ? Object.values(rawBadges) : [];
            return (
              <SwipeableConv
                key={c.id}
                actions={[
                  {
                    label: 'Supprimer',
                    icon: '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>',
                    type: 'danger',
                    onClick: () => handleDeleteConv(c.id),
                  },
                ]}
              >
                <div
                  className={`conv-item${isActive ? ' active' : ''}`}
                  onClick={() => onOpenChat(c.id, p.pseudo || '?')}
                  onContextMenu={(e) => handleCtxMenu(e, c)}
                >
                  <div
                    className="conv-avatar"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenUserProfile?.(c.id);
                    }}
                  >
                    {p.avatar ? (
                      <img src={p.avatar} alt={p.pseudo} loading="lazy" decoding="async" />
                    ) : (
                      <span>{initial}</span>
                    )}
                    <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                  </div>
                  <div className="conv-info">
                    <div className="conv-row">
                      <div className="conv-name">
                        {p.pseudo}
                        {badgeIds.map((id: string) => {
                          const def = badgeDefs[id];
                          if (!def?.icon) return null;
                          return (
                            <img
                              key={id}
                              className="inline-badge"
                              src={def.icon}
                              alt={def.name || id}
                              title={def.name || id}
                              loading="lazy"
                              decoding="async"
                            />
                          );
                        })}
                      </div>
                      <div className="conv-time">{timeStr}</div>
                    </div>
                    <div className="conv-preview">{preview}</div>
                  </div>
                </div>
              </SwipeableConv>
            );
          })
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ConvContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          isPinned={pinned.includes(ctxMenu.conv.id)}
          onClose={() => setCtxMenu(null)}
          onDelete={() => handleCtxDelete(ctxMenu.conv)}
          onBlock={() => handleCtxBlock(ctxMenu.conv)}
          onReport={() => handleCtxReport(ctxMenu.conv)}
          onTogglePin={() => togglePin(ctxMenu.conv.id)}
        />
      )}

      {/* Bottom user area */}
      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={onToggleProfile} role="button" tabIndex={0} aria-label="Profil">
          <div className="sidebar-user-avatar">
            {myAvatar ? <img src={myAvatar} alt="" loading="lazy" decoding="async" /> : <span>{myInitial}</span>}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" id="sidebarPseudo">
              {myProfile?.pseudo || 'Utilisateur'}
            </div>
          </div>
        </div>
        <div className="sidebar-actions">
          <button className="sidebar-icon-btn" onClick={onOpenAddContact} title="Ajouter un contact">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </button>
          <button className="sidebar-icon-btn" onClick={onOpenNewGroup} title="Nouveau groupe">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </button>
          <button
            className="sidebar-icon-btn"
            onClick={() => (window.location.href = '/explore')}
            title="Explorer les groupes"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z" />
            </svg>
          </button>
          <button className="sidebar-icon-btn" onClick={() => (window.location.href = '/feed')} title="Feed vidéo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 3H3v18h18V3zm-6 6h-2v2h2v2h-2v2h-2v-2H9v-2h2V9H9V7h2V5h2v2h2v2zm2 10H7v-2h10v2z" />
            </svg>
          </button>
          <button className="sidebar-icon-btn" onClick={onOpenSettings} title="Paramètres">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
