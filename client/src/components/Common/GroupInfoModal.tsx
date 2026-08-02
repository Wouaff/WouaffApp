import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Crown,
  Edit3,
  Flag,
  Globe,
  Link2,
  Lock,
  LogOut,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { groups as groupsAPI } from '../../services/api';
import {
  offGroupMemberAdded,
  offGroupMemberRemoved,
  offGroupRoleChanged,
  offGroupUpdated,
  onGroupMemberAdded,
  onGroupMemberRemoved,
  onGroupRoleChanged,
  onGroupUpdated,
} from '../../services/socket';
import { showToast } from './Toast';

interface GroupInfoModalProps {
  gid: string;
  onClose: () => void;
}

interface MemberInfo {
  uid: string;
  pseudo: string;
  avatar?: string;
  role: string;
}

export default function GroupInfoModal({ gid, onClose }: GroupInfoModalProps) {
  const { user } = useAuth();
  const [group, setGroup] = useState<Record<string, unknown> | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [myRole, setMyRole] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [privacy, setPrivacy] = useState('public');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editBanner, setEditBanner] = useState('');
  const [saving, setSaving] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const loadGroupInfo = useCallback(async () => {
    try {
      const g = await groupsAPI.get(gid);
      setGroup(g);
      setPrivacy((g.privacy as string) || 'public');
      setEditName((g.name as string) || '');
      setEditDesc((g.description as string) || '');
      setEditIcon((g.icon as string) || '');
      setEditBanner((g.banner as string) || '');
      const membersData = (g.members as Record<string, { role: string; joinedAt: number }>) || {};
      setMyRole(membersData[user?.uid || '']?.role || '');
      const memberList: MemberInfo[] = [];
      for (const [uid, m] of Object.entries(membersData)) {
        let pseudo = uid;
        let avatar = '';
        try {
          const res = await fetch(`/api/profiles/${uid}`);
          const p = await res.json();
          pseudo = p.pseudo || uid;
          avatar = p.avatar || '';
        } catch (e) {
          console.error(e);
        }
        memberList.push({ uid, pseudo, avatar, role: m.role });
      }
      setMembers(memberList);
      if (g.inviteId) {
        setInviteLink(`${window.location.origin}/?invite=${g.inviteId}`);
      }
    } catch {
      showToast('Erreur chargement groupe', 'error');
    }
  }, [gid, user?.uid]);

  useEffect(() => {
    loadGroupInfo();
  }, [loadGroupInfo]);

  useEffect(() => {
    if (!gid) return;
    const reload = () => loadGroupInfo();
    onGroupMemberAdded(reload);
    onGroupMemberRemoved(reload);
    onGroupRoleChanged(reload);
    onGroupUpdated(reload);
    return () => {
      offGroupMemberAdded(reload);
      offGroupMemberRemoved(reload);
      offGroupRoleChanged(reload);
      offGroupUpdated(reload);
    };
  }, [gid, loadGroupInfo]);

  const isAdmin = myRole === 'admin' || myRole === 'owner';
  const isOwner = myRole === 'owner';

  const handleSave = async () => {
    setSaving(true);
    try {
      await groupsAPI.update(gid, {
        name: editName.trim(),
        description: editDesc.trim(),
        icon: editIcon.trim(),
        banner: editBanner.trim(),
      });
      setEditing(false);
      showToast('Groupe mis à jour !', 'success');
      loadGroupInfo();
    } catch {
      showToast('Erreur lors de la sauvegarde', 'error');
    }
    setSaving(false);
  };

  const handleRegenerateInvite = async () => {
    try {
      const res = await groupsAPI.newInvite(gid);
      setInviteLink(`${window.location.origin}/?invite=${res.inviteId}`);
      showToast('Nouveau lien généré !', 'success');
    } catch {
      showToast('Erreur', 'error');
    }
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      showToast('Lien copié !', 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleKick = async (uid: string) => {
    if (!confirm('Exclure ce membre ?')) return;
    try {
      await groupsAPI.removeMember(gid, uid);
      showToast('Membre exclu.', '');
      loadGroupInfo();
    } catch {
      showToast('Erreur', 'error');
    }
  };

  const handleSetRole = async (uid: string, role: string) => {
    try {
      await groupsAPI.setRole(gid, uid, role);
      showToast('Rôle mis à jour.', 'success');
      loadGroupInfo();
    } catch {
      showToast('Erreur', 'error');
    }
  };

  const handleTransfer = async (uid: string) => {
    if (!confirm('Transférer la propriété à ce membre ?')) return;
    try {
      await groupsAPI.setRole(gid, uid, 'owner');
      showToast('Propriété transférée.', 'success');
      loadGroupInfo();
    } catch {
      showToast('Erreur', 'error');
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('Supprimer définitivement le groupe ?')) return;
    try {
      await groupsAPI.delete(gid);
      showToast('Groupe supprimé.', '');
      onClose();
    } catch {
      showToast('Erreur', 'error');
    }
  };

  const handleLeave = async () => {
    if (!confirm('Quitter le groupe ?')) return;
    try {
      await groupsAPI.removeMember(gid, user!.uid);
      showToast('Vous avez quitté le groupe.', '');
      onClose();
    } catch {
      showToast('Erreur', 'error');
    }
  };

  const togglePrivacy = async () => {
    const newPrivacy = privacy === 'public' ? 'private' : 'public';
    try {
      await groupsAPI.update(gid, { privacy: newPrivacy });
      setPrivacy(newPrivacy);
      showToast(`Groupe passé en ${newPrivacy === 'public' ? 'public' : 'privé'}`, 'success');
    } catch {
      showToast('Erreur', 'error');
    }
  };

  const handleReport = async () => {
    try {
      await groupsAPI.report(gid);
      showToast('Groupe signalé. Merci !', 'success');
    } catch {
      showToast('Erreur', 'error');
    }
  };

  const groupIcon = group?.icon as string | undefined;
  const groupBanner = group?.banner as string | undefined;
  const groupName = (group?.name as string) || 'Groupe';
  const memberCount = members.length;

  const sortedMembers = [...members].sort((a, b) => {
    const rank = (r: string) => (r === 'owner' ? 0 : r === 'admin' ? 1 : 2);
    return rank(a.role) - rank(b.role);
  });

  const roleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Propriétaire';
      case 'admin':
        return 'Admin';
      default:
        return 'Membre';
    }
  };

  const RoleIcon = ({ role }: { role: string }) => {
    switch (role) {
      case 'owner':
        return <Crown size={12} className="mr-0.5" />;
      case 'admin':
        return <Shield size={12} className="mr-0.5" />;
      default:
        return null;
    }
  };

  const bannerStyle =
    editBanner || groupBanner
      ? { backgroundImage: `url(${editing ? editBanner || groupBanner : groupBanner || editBanner})` }
      : {};

  return (
    <div
      className="modal-overlay active"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="grp-modal">
        <div className="grp-banner" style={bannerStyle}>
          <div className="grp-banner-overlay" />
          <div className="grp-banner-content">
            <div className={`grp-avatar ${editing ? 'grp-avatar-editable' : ''}`}>
              {editIcon || groupIcon ? (
                <img src={editing ? editIcon || groupIcon : groupIcon || editIcon} alt="" />
              ) : (
                <Users size={28} />
              )}
            </div>
            <div className="grp-banner-info">
              {editing ? (
                <input
                  className="grp-edit-input grp-edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nom du groupe"
                />
              ) : (
                <div className="grp-name">{groupName}</div>
              )}
              <div className="grp-meta">
                {memberCount} membre{memberCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <button className="grp-close" onClick={onClose} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <div className="grp-body">
          {editing ? (
            <div className="grp-edit-section">
              <label className="grp-edit-label" htmlFor="grpDesc">
                Description
              </label>
              <textarea
                id="grpDesc"
                className="grp-edit-textarea"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Description du groupe"
                rows={3}
                maxLength={500}
              />
              <label className="grp-edit-label" htmlFor="grpIcon">
                Icône (URL)
              </label>
              <input
                id="grpIcon"
                className="grp-edit-input"
                value={editIcon}
                onChange={(e) => setEditIcon(e.target.value)}
                placeholder="https://..."
              />
              <label className="grp-edit-label" htmlFor="grpBanner">
                Bannière (URL)
              </label>
              <input
                id="grpBanner"
                className="grp-edit-input"
                value={editBanner}
                onChange={(e) => setEditBanner(e.target.value)}
                placeholder="https://..."
              />
              <div className="grp-edit-actions">
                <button
                  className="grp-btn grp-btn-secondary"
                  onClick={() => {
                    setEditing(false);
                    loadGroupInfo();
                  }}
                >
                  Annuler
                </button>
                <button className="grp-btn grp-btn-primary" onClick={handleSave} disabled={saving}>
                  <Save size={14} /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {(group?.description as string) && <div className="grp-desc">{group?.description as string}</div>}

              {inviteLink && (
                <div className="grp-invite">
                  <div className="grp-invite-input">
                    <Link2 size={14} className="grp-invite-icon" />
                    <span className="grp-invite-text">{window.location.host}/?invite=...</span>
                  </div>
                  <button className="grp-btn grp-btn-icon" onClick={copyInvite} title="Copier le lien">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                  {isAdmin && (
                    <button className="grp-btn grp-btn-icon" onClick={handleRegenerateInvite} title="Nouveau lien">
                      <RefreshCw size={16} />
                    </button>
                  )}
                </div>
              )}

              {isAdmin && (
                <button className="grp-privacy-btn" onClick={togglePrivacy}>
                  {privacy === 'public' ? <Globe size={14} /> : <Lock size={14} />}
                  {privacy === 'public'
                    ? 'Groupe public — visible dans Explorer'
                    : 'Groupe privé — uniquement sur invitation'}
                </button>
              )}
            </>
          )}

          <div className="grp-section-header">
            <span>Membres</span>
            <span className="grp-count">{memberCount}</span>
          </div>

          <div className="grp-members" ref={listRef}>
            {sortedMembers.map((m) => (
              <div key={m.uid} className={`grp-member ${m.uid === user?.uid ? 'is-me' : ''}`}>
                <div className="grp-member-avatar">
                  {m.avatar ? <img src={m.avatar} alt="" /> : <span>{m.pseudo[0]?.toUpperCase() || '?'}</span>}
                </div>
                <div className="grp-member-info">
                  <div className="grp-member-name">
                    {m.pseudo}
                    {m.uid === user?.uid && <span className="grp-me-tag">moi</span>}
                  </div>
                  <div className={`grp-member-role ${m.role}`}>
                    <RoleIcon role={m.role} /> {roleLabel(m.role)}
                  </div>
                </div>
                {isOwner && m.uid !== user?.uid && (
                  <div className="grp-member-actions">
                    {m.role !== 'owner' && (
                      <>
                        {m.role === 'admin' ? (
                          <button
                            className="grp-act grp-act-demote"
                            onClick={() => handleSetRole(m.uid, 'member')}
                            title="Rétrograder"
                          >
                            <ArrowDown size={14} />
                          </button>
                        ) : (
                          <button
                            className="grp-act grp-act-promote"
                            onClick={() => handleSetRole(m.uid, 'admin')}
                            title="Promouvoir admin"
                          >
                            <ArrowUp size={14} />
                          </button>
                        )}
                        <button
                          className="grp-act grp-act-transfer"
                          onClick={() => handleTransfer(m.uid)}
                          title="Transférer la propriété"
                        >
                          <Crown size={14} />
                        </button>
                        <button className="grp-act grp-act-kick" onClick={() => handleKick(m.uid)} title="Exclure">
                          <UserX size={14} />
                        </button>
                      </>
                    )}
                  </div>
                )}
                {isAdmin && m.uid !== user?.uid && m.role === 'member' && !isOwner && (
                  <div className="grp-member-actions">
                    <button className="grp-act grp-act-kick" onClick={() => handleKick(m.uid)} title="Exclure">
                      <UserX size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {!editing && (
            <div className="grp-actions">
              {isAdmin && (
                <button className="grp-btn grp-btn-secondary flex-[2]" onClick={() => setEditing(true)}>
                  <Edit3 size={14} /> Modifier
                </button>
              )}
              {isAdmin && !isOwner && (
                <button className="grp-btn grp-btn-secondary" onClick={handleRegenerateInvite}>
                  <RefreshCw size={14} />
                </button>
              )}
              <button className="grp-btn grp-btn-secondary" onClick={handleReport}>
                <Flag size={14} />
              </button>
              {isOwner && (
                <button className="grp-btn grp-btn-danger" onClick={handleDeleteGroup}>
                  <Trash2 size={14} /> Supprimer
                </button>
              )}
              {!isOwner && (
                <button className="grp-btn grp-btn-secondary" onClick={handleLeave}>
                  <LogOut size={14} /> Quitter
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
