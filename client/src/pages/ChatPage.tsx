import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatView from '../components/Chat/ChatView';
import ProfilePanel from '../components/Chat/ProfilePanel';
import GroupInfoModal from '../components/Common/GroupInfoModal';
import Toast from '../components/Common/Toast';
import Sidebar from '../components/Sidebar/Sidebar';
import StoryCreator from '../components/Stories/StoryCreator';
import StoryViewer from '../components/Stories/StoryViewer';
import { useAuth } from '../hooks/useAuth';
import {
  badges as badgesAPI,
  contacts as contactsAPI,
  groups as groupsAPI,
  profiles as profilesAPI,
} from '../services/api';

export default function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chatWith, setChatWith] = useState<string | null>(null);
  const [chatWithPseudo, setChatWithPseudo] = useState<string>('');
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileUid, setProfileUid] = useState<string | undefined>();

  /* Modals */
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalUid, setProfileModalUid] = useState('');
  const [showDeleteConvModal, setShowDeleteConvModal] = useState(false);
  const [deleteConvIsGroup, setDeleteConvIsGroup] = useState(false);
  const [showFileWarningModal, setShowFileWarningModal] = useState(false);
  const [pendingFileData, setPendingFileData] = useState<{ fileData: string; fileName: string; from: string } | null>(
    null,
  );
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [joinGroupData, setJoinGroupData] = useState<{
    inviteId: string;
    gid: string;
    group: Record<string, unknown>;
  } | null>(null);

  /* Stories */
  const [showStoryViewer, setShowStoryViewer] = useState<string | null>(null);
  const [showStoryCreator, setShowStoryCreator] = useState(false);

  /* Form states */
  const [contactInput, setContactInput] = useState('');
  const [addFeedback, setAddFeedback] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupIcon, setGroupIcon] = useState('');
  const [groupFeedback, setGroupFeedback] = useState('');

  const openChat = useCallback((uid: string, pseudo: string) => {
    setChatWith(uid);
    setChatWithPseudo(pseudo);
    setCurrentGroupId(null);
    setShowProfile(false);
  }, []);

  const openGroup = useCallback((gid: string) => {
    setCurrentGroupId(gid);
    setChatWith(null);
    setChatWithPseudo('');
    setShowProfile(false);
  }, []);

  const openUserProfile = useCallback((uid: string) => {
    setProfileModalUid(uid);
    setShowProfileModal(true);
  }, []);

  const handleInvite = useCallback(
    async (inviteId: string) => {
      try {
        const res = await groupsAPI.join(inviteId);
        if (res.alreadyMember) {
          openGroup(res.gid);
          return;
        }
        const g = await groupsAPI.get(res.gid);
        setJoinGroupData({ inviteId, gid: res.gid, group: g as unknown as Record<string, unknown> });
        setShowJoinGroup(true);
      } catch (e) {
        console.error(e);
      }
    },
    [openGroup],
  );

  const handleVipInvite = useCallback(async (_vipId: string) => {
    /* VIP invite handled by Cloud Functions */
  }, []);

  /* Invite link + group direct link check */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteId = params.get('invite');
    if (inviteId) handleInvite(inviteId);
    const vipId = params.get('vipInvite');
    if (vipId) handleVipInvite(vipId);
    const groupId = params.get('group');
    if (groupId) setTimeout(() => openGroup(groupId), 100);
  }, [handleVipInvite, openGroup, handleInvite]);

  const confirmJoinGroup = async () => {
    if (!joinGroupData) return;
    try {
      await groupsAPI.join(joinGroupData.inviteId);
      setShowJoinGroup(false);
      openGroup(joinGroupData.gid);
    } catch (e) {
      console.error(e);
    }
  };

  const addTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleAddContact = async () => {
    setAddFeedback('');
    const trimmed = contactInput.trim();
    if (!trimmed.startsWith('@')) {
      setAddFeedback("L'identifiant doit commencer par @");
      return;
    }
    try {
      const result = await contactsAPI.add(trimmed);
      setAddFeedback('✅ Contact ajouté !');
      if (addTimerRef.current) clearTimeout(addTimerRef.current);
      addTimerRef.current = setTimeout(() => {
        setShowAddModal(false);
        setContactInput('');
        openChat(result.uid, result.profile?.pseudo || 'Contact');
      }, 600);
    } catch (err: unknown) {
      setAddFeedback(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleCreateGroup = async () => {
    setGroupFeedback('');
    if (!groupName.trim()) {
      setGroupFeedback('Nom du groupe requis.');
      return;
    }
    try {
      const result = await groupsAPI.create({ name: groupName, description: groupDesc, icon: groupIcon });
      setShowNewGroupModal(false);
      setGroupName('');
      setGroupDesc('');
      setGroupIcon('');
      openGroup(result.gid);
    } catch (err: unknown) {
      setGroupFeedback(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDeleteConv = async () => {
    if (deleteConvIsGroup && currentGroupId) {
      try {
        await groupsAPI.removeMember(currentGroupId, user!.uid);
      } catch (e) {
        console.error(e);
      }
    } else if (chatWith) {
      try {
        await contactsAPI.remove(chatWith);
      } catch (e) {
        console.error(e);
      }
    }
    setChatWith(null);
    setCurrentGroupId(null);
    setShowDeleteConvModal(false);
  };

  const downloadFile = (fileData: string, fileName: string, fromUid: string) => {
    if (!fromUid || fromUid === user?.uid) {
      const a = document.createElement('a');
      a.href = fileData;
      a.download = fileName || 'fichier';
      a.click();
      return;
    }
    setPendingFileData({ fileData, fileName, from: fromUid });
    setShowFileWarningModal(true);
  };

  const confirmDownload = () => {
    if (!pendingFileData) return;
    const a = document.createElement('a');
    a.href = pendingFileData.fileData;
    a.download = pendingFileData.fileName || 'fichier';
    a.click();
    setShowFileWarningModal(false);
    setPendingFileData(null);
  };

  const renderProfileModal = () => {
    if (!showProfileModal || !profileModalUid) return null;
    return (
      <div
        id="profileModal"
        className="modal-overlay active"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowProfileModal(false);
          }
        }}
      >
        <ProfileModalContent uid={profileModalUid} onClose={() => setShowProfileModal(false)} onChat={openChat} />
      </div>
    );
  };

  return (
    <div id="app">
      <Sidebar
        chatWith={chatWith}
        currentGroupId={currentGroupId}
        onOpenChat={openChat}
        onOpenGroup={openGroup}
        onToggleProfile={() => {
          setProfileUid(undefined);
          setShowProfile(!showProfile);
        }}
        onOpenSettings={() => navigate('/settings')}
        onOpenAddContact={() => setShowAddModal(true)}
        onOpenNewGroup={() => setShowNewGroupModal(true)}
        onOpenStoryViewer={(uid) => setShowStoryViewer(uid)}
        onOpenStoryCreator={() => setShowStoryCreator(true)}
        onOpenUserProfile={openUserProfile}
      />
      <div id="chatArea" className={`chat-area ${chatWith || currentGroupId ? 'visible' : ''}`}>
        <ChatView
          chatWith={chatWith}
          chatWithPseudo={chatWithPseudo}
          currentGroupId={currentGroupId}
          onOpenGroupInfo={() => setShowGroupInfo(true)}
          onOpenUserProfile={openUserProfile}
          onDeleteConv={() => {
            setDeleteConvIsGroup(!!currentGroupId);
            setShowDeleteConvModal(true);
          }}
          onDownloadFile={downloadFile}
          onGroupKicked={() => {
            setCurrentGroupId(null);
            setShowGroupInfo(false);
          }}
        />
      </div>
      {showProfile && <ProfilePanel onClose={() => setShowProfile(false)} targetUid={profileUid} />}

      <Toast />

      {showGroupInfo && currentGroupId && (
        <GroupInfoModal gid={currentGroupId} onClose={() => setShowGroupInfo(false)} />
      )}

      {renderProfileModal()}

      {showStoryViewer && <StoryViewer startUid={showStoryViewer} onClose={() => setShowStoryViewer(null)} />}

      {showStoryCreator && <StoryCreator onClose={() => setShowStoryCreator(false)} onPublished={() => {}} />}

      {showAddModal && (
        <div
          className="modal-overlay active"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (addTimerRef.current) clearTimeout(addTimerRef.current);
              setShowAddModal(false);
              setContactInput('');
              setAddFeedback('');
            }
          }}
        >
          <div className="modal-box">
            <h3>Ajouter un contact</h3>
            <label htmlFor="addContactInput" className="sr-only">
              Pseudo ou Wouaff ID
            </label>
            <input
              id="addContactInput"
              className="modal-input"
              type="text"
              placeholder="@wouaffId"
              value={contactInput}
              onChange={(e) => setContactInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddContact()}
            />
            <div
              className={`modal-feedback ${addFeedback.includes('✅') ? 'success' : addFeedback ? 'error' : ''}`}
              role="alert"
            >
              {addFeedback}
            </div>
            <button
              className="bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm border-none cursor-pointer font-sans w-full"
              onClick={handleAddContact}
              aria-label="Ajouter un contact"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      {showNewGroupModal && (
        <div
          className="modal-overlay active"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewGroupModal(false);
              setGroupName('');
              setGroupDesc('');
              setGroupIcon('');
              setGroupFeedback('');
            }
          }}
        >
          <div className="modal-box">
            <h3>Nouveau groupe</h3>
            <label htmlFor="groupNameInput" className="sr-only">
              Nom du groupe
            </label>
            <input
              id="groupNameInput"
              className="modal-input"
              type="text"
              placeholder="Nom du groupe"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <label htmlFor="groupDescInput" className="sr-only">
              Description du groupe
            </label>
            <input
              id="groupDescInput"
              className="modal-input"
              type="text"
              placeholder="Description (optionnel)"
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
            />
            <label htmlFor="groupIconInput" className="sr-only">
              URL de l'icône du groupe
            </label>
            <input
              id="groupIconInput"
              className="modal-input"
              type="text"
              placeholder="URL de l'icône (optionnel)"
              value={groupIcon}
              onChange={(e) => setGroupIcon(e.target.value)}
            />
            <div className={`modal-feedback ${groupFeedback ? 'error' : ''}`} role="alert">
              {groupFeedback}
            </div>
            <button
              className="bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm border-none cursor-pointer font-sans w-full"
              onClick={handleCreateGroup}
              aria-label="Créer le groupe"
            >
              Créer le groupe
            </button>
          </div>
        </div>
      )}

      {showDeleteConvModal && (
        <div
          className="modal-overlay active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteConvModal(false);
          }}
        >
          <div className="modal-box">
            <h3>Supprimer la conversation</h3>
            <p className="modal-subtitle">
              {deleteConvIsGroup
                ? 'Le groupe sera masqué de votre liste. Vous en serez retiré.'
                : 'Cette discussion sera masquée de votre liste.'}
            </p>
            <div className="modal-actions">
              <button
                className="bg-transparent text-text-primary px-6 py-3 rounded-xl font-bold text-sm border border-border cursor-pointer font-sans"
                onClick={() => setShowDeleteConvModal(false)}
                aria-label="Annuler"
              >
                Annuler
              </button>
              <button
                className="bg-red-500 text-white px-6 py-3 rounded-xl font-bold text-sm border-none cursor-pointer font-sans"
                onClick={handleDeleteConv}
                aria-label="Supprimer"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {showFileWarningModal && (
        <div
          className="modal-overlay active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFileWarningModal(false);
          }}
        >
          <div className="modal-box">
            <h3>⚠️ Fichier reçu</h3>
            <p className="modal-subtitle">Voulez-vous télécharger ce fichier ?</p>
            <div className="modal-file-info">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z" />
              </svg>
              <span>{pendingFileData?.fileName || 'Fichier'}</span>
            </div>
            <div className="modal-actions">
              <button
                className="bg-transparent text-text-primary px-6 py-3 rounded-xl font-bold text-sm border border-border cursor-pointer font-sans"
                onClick={() => {
                  setShowFileWarningModal(false);
                  setPendingFileData(null);
                }}
              >
                Annuler
              </button>
              <button
                className="bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm border-none cursor-pointer font-sans"
                onClick={confirmDownload}
              >
                Télécharger
              </button>
            </div>
          </div>
        </div>
      )}

      {showJoinGroup && joinGroupData && (
        <div id="joinGroupOverlay" className="modal-overlay active flex">
          <div className="join-card">
            <div className="join-group-banner">
              <img
                src={(joinGroupData.group.icon as string) || 'https://cdn-icons-png.flaticon.com/512/4128/4128199.png'}
                alt=""
                loading="lazy"
                decoding="async"
              />
            </div>
            <h3 className="mb-1">{(joinGroupData.group.name as string) || 'Groupe'}</h3>
            <p className="text-text-muted text-xs mb-4">{(joinGroupData.group.description as string) || ''}</p>
            <p className="text-text-secondary text-xs mb-5">
              {joinGroupData.group.members
                ? Object.keys(joinGroupData.group.members as Record<string, unknown>).length
                : 0}{' '}
              membre(s)
            </p>
            <div className="modal-actions">
              <button
                className="bg-transparent text-text-primary px-6 py-3 rounded-xl font-bold text-sm border border-border cursor-pointer font-sans"
                onClick={() => {
                  setShowJoinGroup(false);
                  setJoinGroupData(null);
                }}
              >
                Annuler
              </button>
              <button
                className="bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm border-none cursor-pointer font-sans"
                onClick={confirmJoinGroup}
              >
                Rejoindre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Profile Modal Component ── */
type BadgeDef = { name?: string; icon?: string };

function ProfileModalContent({
  uid,
  onClose,
  onChat,
}: {
  uid: string;
  onClose: () => void;
  onChat: (uid: string, pseudo: string) => void;
}) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [_croqData, setCroqData] = useState<Record<string, unknown> | null>(null);
  const [badgeDefs, setBadgeDefs] = useState<Record<string, BadgeDef>>({});

  const loadProfile = useCallback(async () => {
    try {
      const p = (await profilesAPI.get(uid)) as Record<string, unknown>;
      setProfile(p);
      try {
        const res = await fetch(`/api/profiles/${uid}`);
        const full = (await res.json()) as Record<string, unknown>;
        if (full.croquettes) setCroqData(full.croquettes as Record<string, unknown>);
      } catch (e) {
        console.error(e);
      }
    } catch (e) {
      console.error(e);
    }
  }, [uid]);

  useEffect(() => {
    loadProfile();
    badgesAPI
      .list()
      .then(setBadgeDefs)
      .catch((e) => {
        console.error(e);
      });
  }, [loadProfile]);

  if (!profile) return null;
  const p = profile;
  const isOnline = p.status === 'online';
  const isMe = uid === user?.uid;
  const initial = ((p.pseudo as string) || '?')[0]?.toUpperCase() || '?';
  const rawBadges = p.ownedBadges as string[] | Record<string, string> | undefined;
  const badgeIds = Array.isArray(rawBadges) ? rawBadges : rawBadges ? Object.values(rawBadges) : [];

  return (
    <div className="profile-box" onClick={(e) => e.stopPropagation()}>
      <div className="profile-banner" style={p.banner ? { backgroundImage: `url(${p.banner})` } : {}}>
        <button className="profile-close-btn" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="profile-avatar-wrap">
        <div className="profile-avatar-lg">
          {p.avatar ? <img src={p.avatar as string} alt="" loading="lazy" decoding="async" /> : <span>{initial}</span>}
        </div>
      </div>
      <div className="profile-body-content">
        <div className="profile-name-row">{(p.pseudo as string) || 'Utilisateur'}</div>
        <div className="profile-wouaff-id">{(p.wouaffId as string) || ''}</div>
        <div className="text-xs mb-3">
          <span className={`profile-status-dot ${isOnline ? 'bg-[#43b581]' : 'bg-[#74777e]'}`} />
          {isOnline ? 'En ligne' : 'Hors ligne'}
        </div>
        {badgeIds.length > 0 && (
          <div className="profile-badges-row">
            {badgeIds.map((id) => {
              const def = badgeDefs[id];
              return (
                <span key={id} className="badge-chip">
                  {def?.icon && <img src={def.icon} alt="" loading="lazy" decoding="async" />}
                  {def?.name || id}
                </span>
              );
            })}
          </div>
        )}
        {(p.bio as string) && (
          <div className="profile-section">
            <div className="profile-section-label">Bio</div>
            <div className="profile-section-val">{p.bio as string}</div>
          </div>
        )}
        <div className="profile-action-row justify-center">
          {isMe ? (
            <button
              className="bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm border-none cursor-pointer font-sans"
              onClick={() => {
                onClose();
                window.location.href = '/settings';
              }}
            >
              Modifier le profil
            </button>
          ) : (
            <button
              className="bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm border-none cursor-pointer font-sans"
              onClick={() => {
                onClose();
                onChat(uid, (p.pseudo as string) || 'Utilisateur');
              }}
            >
              Message
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
