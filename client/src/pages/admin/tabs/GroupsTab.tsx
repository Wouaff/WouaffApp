import { Crown, Edit3, Shield, ShieldAlert, Trash2, UserMinus, Users, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { admin as adminApi } from '../../../services/api';
import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  formatDate,
  IconButton,
  Input,
  PageHeader,
  SearchInput,
  SectionTitle,
  Select,
  SkeletonRows,
  Textarea,
  timeAgo,
  useConfirm,
  useToast,
} from '../ui';

export interface GroupRequest {
  gid: string;
  nonce: number;
}

interface GroupRow {
  gid: string;
  name: string;
  description?: string;
  icon?: string;
  privacy: string;
  createdAt: number;
  createdBy: string;
  reported: number;
  memberCount: number;
}

interface GroupDetail {
  gid: string;
  name: string;
  description?: string;
  icon?: string;
  privacy: string;
  createdBy?: string;
  members?: Record<string, { role: string; joinedAt: number }>;
  [key: string]: unknown;
}

export function GroupsTab({ request, onClearRequest }: { request: GroupRequest | null; onClearRequest: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [edit, setEdit] = useState({ name: '', description: '', privacy: 'public' });

  const loadGroups = useCallback(
    async (query?: string) => {
      setLoading(true);
      try {
        setGroups(await adminApi.groups.list(50, query || undefined));
      } catch {
        toast('Erreur de chargement des groupes', 'error');
      }
      setLoading(false);
    },
    [toast],
  );

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const openDetail = useCallback(
    async (gid: string) => {
      setDetail(null);
      try {
        const g = (await adminApi.groups.detail(gid)) as unknown as GroupDetail;
        setDetail(g);
        setEdit({
          name: (g.name as string) || '',
          description: (g.description as string) || '',
          privacy: (g.privacy as string) || 'public',
        });
      } catch {
        toast('Erreur de chargement du groupe', 'error');
      }
    },
    [toast],
  );

  useEffect(() => {
    if (request) {
      openDetail(request.gid);
      onClearRequest();
    }
  }, [request, openDetail, onClearRequest]);

  const saveGroup = async () => {
    if (!detail) return;
    try {
      await adminApi.groups.update(detail.gid, {
        name: edit.name,
        description: edit.description,
        privacy: edit.privacy,
      });
      toast('Groupe mis à jour', 'success');
      openDetail(detail.gid);
      loadGroups(q.trim() || undefined);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const changeRole = async (gid: string, uid: string, role: string) => {
    const ok = await confirm({
      title: `Changer le rôle de ce membre en « ${role} » ?`,
      confirmLabel: 'Changer',
    });
    if (!ok) return;
    try {
      await adminApi.groups.setMemberRole(gid, uid, role);
      toast('Rôle mis à jour', 'success');
      openDetail(gid);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const kickMember = async (gid: string, uid: string, name?: string) => {
    const ok = await confirm({
      title: 'Exclure ce membre ?',
      message: name ? `${name} sera exclu du groupe.` : 'Ce membre sera exclu du groupe.',
      confirmLabel: 'Exclure',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.groups.kickMember(gid, uid);
      toast('Membre exclu', 'success');
      openDetail(gid);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const deleteGroup = async (gid: string, name?: string) => {
    const ok = await confirm({
      title: 'Supprimer ce groupe ?',
      message: `Le groupe « ${name || gid} » sera définitivement supprimé.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.groups.delete(gid);
      setGroups((prev) => prev.filter((g) => g.gid !== gid));
      setDetail(null);
      toast('Groupe supprimé', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const members = detail?.members ? Object.entries(detail.members) : [];
  const roleIcon = (role: string) =>
    role === 'owner' ? <Crown size={14} /> : role === 'admin' ? <Shield size={14} /> : <Users size={14} />;

  return (
    <div>
      <PageHeader title="Groupes" subtitle="Gestion de tous les groupes : membres, rôles, confidentialité." />

      <div style={{ marginBottom: 16 }}>
        <SearchInput
          value={q}
          onChange={setQ}
          onEnter={() => loadGroups(q.trim() || undefined)}
          onClear={() => loadGroups()}
          placeholder="Rechercher un groupe par nom…"
        />
      </div>

      {detail && (
        <Card
          title={
            <span className="wa-card-title-inline">
              {detail.icon ? <img src={detail.icon} alt="" className="wa-card-icon-img" /> : <Users size={16} />}
              {detail.name}
            </span>
          }
          action={
            <IconButton label="Fermer" onClick={() => setDetail(null)}>
              <X size={15} />
            </IconButton>
          }
        >
          <div className="wa-form-grid">
            <Field label="Nom">
              <Input value={edit.name} onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))} />
            </Field>
            <Field label="Confidentialité">
              <Select value={edit.privacy} onChange={(e) => setEdit((p) => ({ ...p, privacy: e.target.value }))}>
                <option value="public">Public</option>
                <option value="private">Privé</option>
              </Select>
            </Field>
            <Field label="Description" hint={`Créé le ${formatDate(detail.createdAt as number)}`}>
              <Textarea
                rows={2}
                value={edit.description}
                onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))}
              />
            </Field>
          </div>
          <div className="wa-inline-actions">
            <Button variant="primary" size="sm" icon={<Edit3 size={14} />} onClick={saveGroup}>
              Enregistrer
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={14} />}
              onClick={() => deleteGroup(detail.gid, detail.name)}
            >
              Supprimer le groupe
            </Button>
          </div>

          <SectionTitle>Membres ({members.length})</SectionTitle>
          <div className="wa-item-list">
            {members.length === 0 && <p className="wa-muted">Aucun membre.</p>}
            {members.map(([uid, m]) => (
              <div key={uid} className="wa-item">
                <span className="wa-role-avatar">{roleIcon(m.role)}</span>
                <div className="wa-item-body">
                  <div className="wa-item-head">
                    <span className="wa-item-author wa-mono">{uid}</span>
                    <Chip tone={m.role === 'owner' ? 'brand' : 'neutral'}>{m.role}</Chip>
                  </div>
                  <div className="wa-item-meta">
                    <span>Rejoint {timeAgo(m.joinedAt)}</span>
                  </div>
                </div>
                <div className="wa-item-actions wa-item-actions-row">
                  {m.role !== 'owner' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Crown size={12} />}
                      onClick={() => changeRole(detail.gid, uid, 'owner')}
                    >
                      Owner
                    </Button>
                  )}
                  {m.role !== 'admin' && m.role !== 'owner' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Shield size={12} />}
                      onClick={() => changeRole(detail.gid, uid, 'admin')}
                    >
                      Admin
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<UserMinus size={12} />}
                    onClick={() => kickMember(detail.gid, uid, uid)}
                  >
                    Exclure
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading && <SkeletonRows count={5} />}

      {!loading && (
        <div className="wa-item-list">
          {groups.length === 0 && <EmptyState icon={<Users size={26} />} title="Aucun groupe" />}
          {groups.map((g) => (
            <div key={g.gid} className="wa-item">
              <Avatar src={g.icon} name={g.name} size={40} />
              <div className="wa-item-body">
                <div className="wa-item-head">
                  <span className="wa-item-author">{g.name || 'Groupe sans nom'}</span>
                  {g.reported === 1 && (
                    <span className="wa-flag-inline">
                      <ShieldAlert size={13} /> signalé
                    </span>
                  )}
                  <Chip tone={g.privacy === 'public' ? 'success' : 'neutral'}>{g.privacy}</Chip>
                  <span className="wa-item-time">{timeAgo(g.createdAt)}</span>
                </div>
                <div className="wa-item-meta">
                  <span>
                    <Users size={12} /> {g.memberCount} membres
                  </span>
                </div>
              </div>
              <div className="wa-item-actions">
                <Button variant="secondary" size="sm" icon={<Edit3 size={13} />} onClick={() => openDetail(g.gid)}>
                  Gérer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
