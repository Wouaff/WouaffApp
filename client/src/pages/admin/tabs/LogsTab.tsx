import {
  Activity,
  Award,
  Ban,
  Edit3,
  Film,
  Link2,
  MessageCircle,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { admin as adminApi, profiles } from '../../../services/api';
import type { UserProfile } from '../../../types';
import { Avatar, Button, Card, EmptyState, formatDate, PageHeader, timeAgo, useToast } from '../ui';

interface LogRow {
  id: number;
  adminUid: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  createdAt: number;
}

const LABELS: Record<string, string> = {
  staff_add: 'Ajout staff',
  staff_remove: 'Retrait staff',
  staff_role: 'Changement rôle staff',
  profile_update: 'Modification profil',
  badge_update: 'Mise à jour badges',
  account_delete: 'Suppression compte',
  wouaffid_reset: 'Réinitialisation ID',
  migrate_wouaff_ids: 'Migration IDs',
  maintenance_on: 'Maintenance activée',
  maintenance_off: 'Maintenance désactivée',
  post_delete: 'Suppression post',
  comment_delete: 'Suppression commentaire',
  video_delete: 'Suppression vidéo',
  group_delete: 'Suppression groupe',
  group_update: 'Modification groupe',
  user_ban: 'Bannissement',
  user_unban: 'Débannissement',
};

const ICONS: Record<string, ReactNode> = {
  staff_add: <UserPlus size={14} />,
  staff_remove: <UserMinus size={14} />,
  staff_role: <Shield size={14} />,
  profile_update: <Edit3 size={14} />,
  badge_update: <Award size={14} />,
  account_delete: <Trash2 size={14} />,
  wouaffid_reset: <RefreshCw size={14} />,
  migrate_wouaff_ids: <Link2 size={14} />,
  maintenance_on: <ShieldAlert size={14} />,
  maintenance_off: <ShieldAlert size={14} />,
  post_delete: <Trash2 size={14} />,
  comment_delete: <MessageCircle size={14} />,
  video_delete: <Film size={14} />,
  group_delete: <Trash2 size={14} />,
  group_update: <Edit3 size={14} />,
  user_ban: <Ban size={14} />,
  user_unban: <ShieldCheck size={14} />,
};

export function LogsTab() {
  const toast = useToast();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [profilesMap, setProfilesMap] = useState<Record<string, { pseudo: string; avatar?: string }>>({});

  const load = async () => {
    setLoading(true);
    try {
      const l = await adminApi.logs();
      setLogs(l as unknown as LogRow[]);
      const map: Record<string, { pseudo: string; avatar?: string }> = {};
      const seen = new Set<string>();
      for (const log of l) {
        if (seen.has(log.adminUid)) continue;
        seen.add(log.adminUid);
        try {
          const p = (await profiles.get(log.adminUid)) as unknown as UserProfile;
          map[log.adminUid] = { pseudo: p.pseudo || log.adminUid.slice(0, 8), avatar: p.avatar };
        } catch {
          map[log.adminUid] = { pseudo: log.adminUid.slice(0, 8) };
        }
      }
      setProfilesMap(map);
    } catch {
      toast('Erreur de chargement de l’activité', 'error');
    }
    setLoading(false);
  };

  return (
    <div>
      <PageHeader
        title="Activité du staff"
        subtitle="Dernières actions de modération des administrateurs."
        actions={
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load} loading={loading}>
            Charger l'activité
          </Button>
        }
      />

      {logs.length === 0 && !loading && (
        <EmptyState icon={<Activity size={26} />} title="Aucune activité enregistrée" />
      )}

      <Card>
        <div className="wa-log-list">
          {logs.map((log) => (
            <div key={log.id} className="wa-log-item">
              <span className="wa-log-icon">{ICONS[log.action] || <Activity size={14} />}</span>
              <div className="wa-log-info">
                <div className="wa-log-action">
                  {LABELS[log.action] || log.action}
                  {log.details && <span className="wa-log-details"> · {log.details}</span>}
                </div>
                <div className="wa-log-meta">
                  <Avatar src={profilesMap[log.adminUid]?.avatar} name={profilesMap[log.adminUid]?.pseudo} size={18} />
                  {profilesMap[log.adminUid]?.pseudo || log.adminUid.slice(0, 8)}
                  {log.targetId && (
                    <>
                      {' '}
                      · <code>{log.targetId.slice(0, 12)}…</code>
                    </>
                  )}
                </div>
              </div>
              <span className="wa-log-time" title={formatDate(log.createdAt)}>
                {timeAgo(log.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
