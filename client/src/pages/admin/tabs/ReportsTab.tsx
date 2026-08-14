import { Edit3, Flag, History, RefreshCw, Search, Trash2, Users, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type {
  AdminPostReportRow,
  AdminReportActionRow,
  AdminReportedGroupRow,
  AdminUserReportRow,
} from '../../../services/api';
import { admin as adminApi } from '../../../services/api';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  formatDate,
  PageHeader,
  SegTabs,
  SkeletonRows,
  timeAgo,
  useConfirm,
  useToast,
} from '../ui';

type ReportSub = 'users' | 'posts' | 'groups' | 'history';

export function ReportsTab({
  onOpenUser,
  onOpenGroup,
}: {
  onOpenUser: (uid: string) => void;
  onOpenGroup: (gid: string) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [sub, setSub] = useState<ReportSub>('users');
  const [userReports, setUserReports] = useState<AdminUserReportRow[]>([]);
  const [postReports, setPostReports] = useState<AdminPostReportRow[]>([]);
  const [groupReports, setGroupReports] = useState<AdminReportedGroupRow[]>([]);
  const [history, setHistory] = useState<AdminReportActionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (which: ReportSub) => {
      setLoading(true);
      try {
        if (which === 'users') setUserReports(await adminApi.reports.users());
        else if (which === 'posts') setPostReports(await adminApi.reports.posts());
        else if (which === 'groups') setGroupReports(await adminApi.reports.groups());
        else setHistory(await adminApi.reports.history());
      } catch {
        toast('Erreur de chargement des signalements', 'error');
      }
      setLoading(false);
    },
    [toast],
  );

  useEffect(() => {
    load(sub);
  }, [sub, load]);

  const clearUser = async (id: number) => {
    try {
      await adminApi.reports.clearUser(id);
      setUserReports((prev) => prev.filter((r) => r.id !== id));
      toast('Signalement clôturé', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const clearPost = async (id: number) => {
    try {
      await adminApi.reports.clearPost(id);
      setPostReports((prev) => prev.filter((r) => r.id !== id));
      toast('Signalement clôturé', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const clearGroup = async (gid: string) => {
    try {
      await adminApi.reports.clearGroup(gid);
      setGroupReports((prev) => prev.filter((r) => r.gid !== gid));
      toast('Signalement levé', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const deletePost = async (id: string, pseudo?: string) => {
    const ok = await confirm({
      title: 'Supprimer ce post signalé ?',
      message: pseudo ? `Le post de ${pseudo} sera supprimé.` : 'Le post sera supprimé.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.posts.delete(id);
      setPostReports((prev) => prev.filter((r) => r.postId !== id));
      toast('Post supprimé', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const deleteGroup = async (gid: string, name?: string) => {
    const ok = await confirm({
      title: 'Supprimer ce groupe signalé ?',
      message: `Le groupe « ${name || gid} » sera supprimé.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.groups.delete(gid);
      setGroupReports((prev) => prev.filter((r) => r.gid !== gid));
      toast('Groupe supprimé', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Signalements"
        subtitle="Contenus et comptes signalés par la communauté."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={() => load(sub)}
            loading={loading}
          >
            Recharger
          </Button>
        }
      />

      <SegTabs<ReportSub>
        value={sub}
        onChange={(s) => setSub(s)}
        items={[
          { id: 'users', label: 'Utilisateurs', icon: <Flag size={15} />, count: userReports.length },
          { id: 'posts', label: 'Posts', icon: <Edit3 size={15} />, count: postReports.length },
          { id: 'groups', label: 'Groupes', icon: <Users size={15} />, count: groupReports.length },
          { id: 'history', label: 'Traités', icon: <History size={15} /> },
        ]}
      />

      {loading && <SkeletonRows count={4} />}

      {!loading && sub === 'users' && (
        <div className="wa-item-list">
          {userReports.length === 0 && <EmptyState icon={<Flag size={26} />} title="Aucun signalement utilisateur" />}
          {userReports.map((r) => (
            <div key={r.id} className="wa-item">
              <Avatar src={r.reportedAvatar} name={r.reportedPseudo} size={40} />
              <div className="wa-item-body">
                <div className="wa-item-head">
                  <span className="wa-item-author">{r.reportedPseudo || 'Compte'}</span>
                  <span className="wa-item-handle">
                    @{((r.reportedWouaffId as string) || r.reportedUid).replace(/^@/, '')}
                  </span>
                  <span className="wa-item-time">{timeAgo(r.createdAt)}</span>
                </div>
                {r.reason && <p className="wa-item-text">« {r.reason} »</p>}
                <div className="wa-item-reply">Signalé par {r.reporterPseudo || 'inconnu'}</div>
              </div>
              <div className="wa-item-actions wa-item-actions-row">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Search size={12} />}
                  onClick={() => onOpenUser(r.reportedUid)}
                >
                  Voir
                </Button>
                <Button variant="primary" size="sm" icon={<X size={12} />} onClick={() => clearUser(r.id)}>
                  Clôturer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && sub === 'posts' && (
        <div className="wa-item-list">
          {postReports.length === 0 && <EmptyState icon={<Edit3 size={26} />} title="Aucun post signalé" />}
          {postReports.map((r) => (
            <div key={r.id} className="wa-item">
              <Avatar src={r.postAvatar} name={r.postPseudo} size={40} />
              <div className="wa-item-body">
                <div className="wa-item-head">
                  <span className="wa-item-author">{r.postPseudo || 'Utilisateur'}</span>
                  <span className="wa-item-handle">
                    @{((r.postWouaffId as string) || r.postAuthorUid).replace(/^@/, '')}
                  </span>
                  <span className="wa-item-time">{timeAgo(r.createdAt)}</span>
                </div>
                <p className="wa-item-text">{r.postText || '(post supprimé)'}</p>
                {r.postImage && (
                  <img
                    src={r.postImage}
                    alt=""
                    className="wa-item-thumb"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
                {r.reason && (
                  <div className="wa-item-reply">
                    Motif : « {r.reason} » · signalé par {r.reporterPseudo || 'inconnu'}
                  </div>
                )}
              </div>
              <div className="wa-item-actions wa-item-actions-row">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Search size={12} />}
                  onClick={() => onOpenUser(r.postAuthorUid)}
                >
                  Auteur
                </Button>
                <Button variant="primary" size="sm" icon={<X size={12} />} onClick={() => clearPost(r.id)}>
                  Clôturer
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 size={12} />}
                  onClick={() => deletePost(r.postId, r.postPseudo)}
                >
                  Supprimer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && sub === 'groups' && (
        <div className="wa-item-list">
          {groupReports.length === 0 && <EmptyState icon={<Users size={26} />} title="Aucun groupe signalé" />}
          {groupReports.map((r) => (
            <div key={r.gid} className="wa-item">
              <Avatar name={r.name} size={40} />
              <div className="wa-item-body">
                <div className="wa-item-head">
                  <span className="wa-item-author">{r.name || 'Groupe sans nom'}</span>
                  <span className="wa-item-time">{timeAgo(r.reportedAt)}</span>
                </div>
                <div className="wa-item-reply">Signalé par {r.reportedBy.slice(0, 10)}…</div>
              </div>
              <div className="wa-item-actions wa-item-actions-row">
                <Button variant="secondary" size="sm" icon={<Search size={12} />} onClick={() => onOpenGroup(r.gid)}>
                  Voir
                </Button>
                <Button variant="primary" size="sm" icon={<X size={12} />} onClick={() => clearGroup(r.gid)}>
                  Lever
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 size={12} />}
                  onClick={() => deleteGroup(r.gid, r.name)}
                >
                  Supprimer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && sub === 'history' && (
        <Card>
          {history.length === 0 && <EmptyState icon={<History size={26} />} title="Aucune action enregistrée" />}
          <div className="wa-log-list">
            {history.map((h) => (
              <div key={h.id} className="wa-log-item">
                <span className="wa-log-icon">
                  <History size={14} />
                </span>
                <div className="wa-log-info">
                  <div className="wa-log-action">
                    {h.action === 'deleted' ? 'Suppression' : 'Clôture'} · {h.reportType}
                    {h.reportId && (
                      <>
                        {' '}
                        · <code>{h.reportId.slice(0, 12)}…</code>
                      </>
                    )}
                  </div>
                  <div className="wa-log-meta">par {h.adminPseudo || 'staff'}</div>
                </div>
                <span className="wa-log-time">{formatDate(h.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
