import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  Ban,
  BarChart3,
  ChevronRight,
  Circle,
  Edit3,
  Film,
  Flag,
  Globe,
  Heart,
  History,
  Key,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Repeat2,
  Save,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingUp,
  User,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type {
  AdminCommentRow,
  AdminLoginHistoryRow,
  AdminPostReportRow,
  AdminPostRow,
  AdminReportActionRow,
  AdminReportedGroupRow,
  AdminUserReportRow,
  AdminVideoRow,
} from '../services/api';
import { admin as adminAPI, profiles } from '../services/api';
import type { UserProfile } from '../types';
import { compressImage } from '../utils/audio';

type Tab = 'dashboard' | 'moderation' | 'groups' | 'reports' | 'users' | 'staff' | 'logs';
type ModSubTab = 'posts' | 'comments' | 'videos';
type ReportSubTab = 'users' | 'groups' | 'posts' | 'history';
type ToastItem = { id: number; msg: string; type: 'success' | 'error' | 'info' };

interface AdminStat {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  online?: boolean;
  group: 'general' | 'social' | 'moderation';
}

interface GroupMember {
  role: string;
  joinedAt: number;
}

let toastId = 0;

const ACTIONS_LABELS: Record<string, string> = {
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

const ACTION_ICONS: Record<string, React.ReactNode> = {
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
  group_delete: <Users size={14} />,
  group_update: <Edit3 size={14} />,
  user_ban: <Ban size={14} />,
  user_unban: <ShieldCheck size={14} />,
};

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <BarChart3 size={18} /> },
  { id: 'moderation', label: 'Modération', icon: <ShieldCheck size={18} /> },
  { id: 'groups', label: 'Groupes', icon: <Users size={18} /> },
  { id: 'reports', label: 'Signalements', icon: <Flag size={18} /> },
  { id: 'users', label: 'Utilisateurs', icon: <User size={18} /> },
  { id: 'staff', label: 'Staff', icon: <Shield size={18} /> },
  { id: 'logs', label: 'Activité', icon: <Activity size={18} /> },
];

const STAT_CARDS: AdminStat[] = [
  { key: 'users', label: 'Utilisateurs', icon: <User size={18} />, color: 'var(--brand)', group: 'general' },
  { key: 'online', label: 'En ligne', icon: <Circle size={18} />, color: '#22c55e', online: true, group: 'general' },
  { key: 'chats', label: 'Conversations', icon: <MessageSquare size={18} />, color: '#8b5cf6', group: 'general' },
  { key: 'messages', label: 'Messages', icon: <Mail size={18} />, color: '#06b6d4', group: 'general' },
  { key: 'posts', label: 'Posts', icon: <Edit3 size={18} />, color: '#3b82f6', group: 'social' },
  { key: 'postLikes', label: "J'aime (posts)", icon: <Heart size={18} />, color: '#ef4444', group: 'social' },
  { key: 'postReposts', label: 'Reposts', icon: <Repeat2 size={18} />, color: '#10b981', group: 'social' },
  { key: 'postComments', label: 'Commentaires', icon: <MessageCircle size={18} />, color: '#f59e0b', group: 'social' },
  { key: 'follows', label: 'Abonnements', icon: <UserPlus size={18} />, color: '#ec4899', group: 'social' },
  { key: 'videos', label: 'Vidéos', icon: <Film size={18} />, color: '#a855f7', group: 'social' },
  { key: 'videoLikes', label: "J'aime (vidéos)", icon: <Heart size={18} />, color: '#fb7185', group: 'social' },
  {
    key: 'videoComments',
    label: 'Commentaires vidéos',
    icon: <MessageCircle size={18} />,
    color: '#f97316',
    group: 'social',
  },
  { key: 'userReports', label: 'Signalements users', icon: <Flag size={18} />, color: '#f43f5e', group: 'moderation' },
  { key: 'postReports', label: 'Posts signalés', icon: <Flag size={18} />, color: '#fb7185', group: 'moderation' },
  {
    key: 'reportedGroups',
    label: 'Groupes signalés',
    icon: <ShieldAlert size={18} />,
    color: '#e11d48',
    group: 'moderation',
  },
  { key: 'logins', label: 'Connexions (IP)', icon: <Globe size={18} />, color: '#6366f1', group: 'moderation' },
  { key: 'badges', label: 'Badges', icon: <Award size={18} />, color: '#f59e0b', group: 'general' },
  { key: 'wouaffIds', label: 'Identifiants', icon: <Link2 size={18} />, color: '#ec4899', group: 'general' },
];

function timeAgo(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days}j`;
}

function formatDate(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function avatar(avatar?: string | null, pseudo?: string | null, size = 36): React.ReactNode {
  return (
    <div className="admin-user-avatar" style={size !== 36 ? { width: size, height: size } : undefined}>
      {avatar ? <img src={avatar} alt="" /> : <span>{(pseudo || '?')[0]?.toUpperCase() || '?'}</span>}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="admin-empty">
      <div className="admin-empty-icon">{icon}</div>
      <p className="admin-muted">{text}</p>
    </div>
  );
}

function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="admin-skeleton-list">
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lignes statiques de skeleton
        <div key={i} className="admin-skeleton-row">
          <div className="admin-skeleton-avatar" />
          <div className="admin-skeleton-lines">
            <div className="admin-skeleton-line" style={{ width: '40%' }} />
            <div className="admin-skeleton-line" style={{ width: '85%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

interface BarChartProps {
  data: Array<{ date: string; count: number }>;
  color?: string;
}

function BarChart({ data, color = 'var(--brand)' }: BarChartProps) {
  if (data.length === 0) return <p className="admin-muted">Aucune donnée sur cette période.</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="admin-chart">
      {data.map((d) => (
        <div key={d.date} className="admin-chart-col">
          <div className="admin-chart-value">{d.count}</div>
          <div className="admin-chart-bar-wrap">
            <div
              className="admin-chart-bar"
              style={{ height: `${Math.max(6, Math.round((d.count / max) * 100))}%`, background: color }}
              title={`${d.date} : ${d.count}`}
            />
          </div>
          <div className="admin-chart-date">{d.date.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isStaff, setIsStaff] = useState(false);
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isOwner = user?.staffRole === 'owner';

  /* Dashboard state */
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [analytics, setAnalytics] = useState<{
    registrations: Array<{ date: string; count: number }>;
    posts: Array<{ date: string; count: number }>;
    messages: Array<{ date: string; count: number }>;
    topPosts: Array<Record<string, unknown>>;
    topUsers: Array<Record<string, unknown>>;
  } | null>(null);

  /* Recherche globale */
  const [globalQ, setGlobalQ] = useState('');
  const [globalResults, setGlobalResults] = useState<{
    users: Array<Record<string, unknown>>;
    posts: Array<Record<string, unknown>>;
    videos: Array<Record<string, unknown>>;
    groups: Array<Record<string, unknown>>;
    messages: Array<Record<string, unknown>>;
  } | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);

  /* Users state */
  const [recentUsers, setRecentUsers] = useState<Record<string, UserProfile>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResult, setSearchResult] = useState<{ uid: string; profile: UserProfile } | null>(null);
  const [editData, setEditData] = useState({ pseudo: '', bio: '', avatar: '', banner: '', wouaffId: '' });
  const [editMsg, setEditMsg] = useState('');
  const [adminImgLoading, setAdminImgLoading] = useState<'avatar' | 'banner' | null>(null);
  const adminAvatarFileRef = useRef<HTMLInputElement>(null);
  const adminBannerFileRef = useRef<HTMLInputElement>(null);
  const [badgeDefs, setBadgeDefs] = useState<Record<string, { name?: string; icon?: string }>>({});
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [badgeMsg, setBadgeMsg] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [loginHistory, setLoginHistory] = useState<AdminLoginHistoryRow[]>([]);
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);

  /* Staff state */
  const [staffList, setStaffList] = useState<Record<string, { role: string; addedAt: number; profile?: UserProfile }>>(
    {},
  );
  const [staffUidInput, setStaffUidInput] = useState('');
  const [staffMsg, setStaffMsg] = useState('');

  /* Logs state */
  const [logs, setLogs] = useState<
    Array<{
      id: number;
      adminUid: string;
      action: string;
      targetType: string | null;
      targetId: string | null;
      details: string | null;
      createdAt: number;
    }>
  >([]);
  const [logProfiles, setLogProfiles] = useState<Record<string, { pseudo: string; avatar?: string }>>({});
  const [logsLoading, setLogsLoading] = useState(false);

  /* Modération state */
  const [modSubTab, setModSubTab] = useState<ModSubTab>('posts');
  const [modPosts, setModPosts] = useState<AdminPostRow[]>([]);
  const [modComments, setModComments] = useState<AdminCommentRow[]>([]);
  const [modVideos, setModVideos] = useState<AdminVideoRow[]>([]);
  const [modLoading, setModLoading] = useState(false);
  const [postFilter, setPostFilter] = useState('');

  /* Groupes state */
  const [groups, setGroups] = useState<Array<Record<string, unknown>>>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupQ, setGroupQ] = useState('');
  const [groupDetail, setGroupDetail] = useState<Record<string, unknown> | null>(null);
  const [groupEdit, setGroupEdit] = useState({ name: '', description: '', privacy: '' });

  /* Reports state */
  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>('users');
  const [userReports, setUserReports] = useState<AdminUserReportRow[]>([]);
  const [postReports, setPostReports] = useState<AdminPostReportRow[]>([]);
  const [groupReports, setGroupReports] = useState<AdminReportedGroupRow[]>([]);
  const [reportHistory, setReportHistory] = useState<AdminReportActionRow[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  /* Bans state */
  const [activeBans, setActiveBans] = useState<Array<Record<string, unknown>>>([]);
  const [bansLoading, setBansLoading] = useState(false);
  const [banTarget, setBanTarget] = useState<{ uid: string; pseudo: string } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('permanent');
  const [banSending, setBanSending] = useState(false);

  /* Maintenance state */
  const [maintenanceOn, setMaintenanceOn] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const toast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: chargement initial au montage
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const p = (await profiles.get(user!.uid)) as unknown as UserProfile;
        setProfile(p);
        const staffRes = await adminAPI.staff
          .list()
          .then(() => true)
          .catch(() => false);
        setIsStaff(staffRes);
        if (staffRes) {
          adminAPI
            .stats()
            .then(setStats)
            .catch(() => {});
          adminAPI.users
            .recent()
            .then(setRecentUsers)
            .catch(() => {});
          adminAPI.badges
            .list()
            .then((data) => setBadgeDefs(data as Record<string, { name?: string; icon?: string }>))
            .catch(() => {});
          adminAPI.maintenance
            .get()
            .then((m) => {
              setMaintenanceOn(m.enabled);
              setMaintenanceMsg(m.message ?? '');
            })
            .catch(() => {});
          loadModeration('posts');
          loadReports('users');
          loadAnalytics(7);
        }
      } catch (e) {
        console.error(e);
      }
      setChecking(false);
    })();
  }, [user]);

  const loadStats = async () => {
    const s = await adminAPI.stats().catch(() => null);
    if (s) setStats(s);
  };

  const loadAnalytics = async (days: number) => {
    setAnalyticsDays(days);
    const a = await adminAPI.analytics(days).catch(() => null);
    if (a) setAnalytics(a);
  };

  const runGlobalSearch = async (qOverride?: string) => {
    const q = (qOverride ?? globalQ).trim();
    if (!q) {
      setGlobalResults(null);
      return;
    }
    setGlobalLoading(true);
    try {
      setGlobalResults(await adminAPI.search(q));
    } catch {
      setGlobalResults(null);
      toast('Erreur de recherche', 'error');
    }
    setGlobalLoading(false);
  };

  const toggleMaintenance = async () => {
    setMaintenanceLoading(true);
    try {
      const newState = !maintenanceOn;
      await adminAPI.maintenance.set(newState, maintenanceMsg || undefined);
      setMaintenanceOn(newState);
      toast(newState ? 'Mode maintenance activé' : 'Mode maintenance désactivé', 'success');
    } catch {
      toast("Erreur lors du changement d'état", 'error');
    }
    setMaintenanceLoading(false);
  };

  const loadRecentUsers = async () => {
    const u = await adminAPI.users.recent().catch(() => ({}));
    setRecentUsers(u);
  };

  const loadStaff = async () => {
    const s = await adminAPI.staff.list().catch(() => ({}));
    setStaffList(s);
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const l = await adminAPI.logs();
      setLogs(l);
      const pMap: Record<string, { pseudo: string; avatar?: string }> = {};
      const seen = new Set<string>();
      for (const log of l) {
        if (seen.has(log.adminUid)) continue;
        seen.add(log.adminUid);
        try {
          const p = (await profiles.get(log.adminUid)) as unknown as UserProfile;
          pMap[log.adminUid] = { pseudo: p.pseudo || log.adminUid.slice(0, 8), avatar: p.avatar };
        } catch {
          pMap[log.adminUid] = { pseudo: log.adminUid.slice(0, 8) };
        }
      }
      setLogProfiles(pMap);
    } catch (e) {
      console.error(e);
    }
    setLogsLoading(false);
  };

  const loadModeration = async (sub: ModSubTab, uid?: string) => {
    setModLoading(true);
    try {
      if (sub === 'posts') {
        setModPosts(await adminAPI.posts.list(30, uid || undefined));
      } else if (sub === 'comments') {
        setModComments(await adminAPI.comments.list(30));
      } else {
        setModVideos(await adminAPI.videos.list(30));
      }
    } catch (e) {
      console.error(e);
      toast('Erreur de chargement de la modération', 'error');
    }
    setModLoading(false);
  };

  const deletePost = async (id: string, authorPseudo?: string) => {
    if (!confirm(`Supprimer définitivement ce post${authorPseudo ? ` de ${authorPseudo}` : ''} ?`)) return;
    try {
      await adminAPI.posts.delete(id);
      setModPosts((prev) => prev.filter((p) => p.id !== id));
      setPostReports((prev) => prev.filter((r) => r.postId !== id));
      toast('Post supprimé', 'success');
      loadStats();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const deleteComment = async (id: number) => {
    if (!confirm('Supprimer définitivement ce commentaire ?')) return;
    try {
      await adminAPI.comments.delete(id);
      setModComments((prev) => prev.filter((c) => c.id !== id));
      toast('Commentaire supprimé', 'success');
      loadStats();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const deleteVideo = async (id: string, authorPseudo?: string) => {
    if (!confirm(`Supprimer définitivement cette vidéo${authorPseudo ? ` de ${authorPseudo}` : ''} ?`)) return;
    try {
      await adminAPI.videos.delete(id);
      setModVideos((prev) => prev.filter((v) => v.id !== id));
      toast('Vidéo supprimée', 'success');
      loadStats();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const loadGroups = async (q?: string) => {
    setGroupsLoading(true);
    try {
      setGroups(await adminAPI.groups.list(50, q || undefined));
    } catch {
      toast('Erreur de chargement des groupes', 'error');
    }
    setGroupsLoading(false);
  };

  const openGroupDetail = async (gid: string) => {
    setGroupDetail(null);
    try {
      const g = await adminAPI.groups.detail(gid);
      setGroupDetail(g);
      setGroupEdit({
        name: (g.name as string) || '',
        description: (g.description as string) || '',
        privacy: (g.privacy as string) || 'public',
      });
    } catch {
      toast('Erreur de chargement du groupe', 'error');
    }
  };

  const saveGroup = async () => {
    if (!groupDetail) return;
    const gid = groupDetail.gid as string;
    try {
      await adminAPI.groups.update(gid, {
        name: groupEdit.name,
        description: groupEdit.description,
        privacy: groupEdit.privacy,
      });
      toast('Groupe mis à jour', 'success');
      openGroupDetail(gid);
      loadGroups(groupQ || undefined);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const changeGroupMemberRole = async (gid: string, uid: string, role: string) => {
    if (!confirm(`Changer le rôle de ce membre en « ${role} » ?`)) return;
    try {
      await adminAPI.groups.setMemberRole(gid, uid, role);
      toast('Rôle mis à jour', 'success');
      openGroupDetail(gid);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const kickGroupMember = async (gid: string, uid: string, name?: string) => {
    if (!confirm(`Exclure ${name || uid} du groupe ?`)) return;
    try {
      await adminAPI.groups.kickMember(gid, uid);
      toast('Membre exclu', 'success');
      openGroupDetail(gid);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const deleteGroupAdmin = async (gid: string, name?: string) => {
    if (!confirm(`Supprimer définitivement le groupe « ${name || gid} » ?`)) return;
    try {
      await adminAPI.groups.delete(gid);
      setGroups((prev) => prev.filter((g) => g.gid !== gid));
      setGroupReports((prev) => prev.filter((r) => r.gid !== gid));
      setGroupDetail(null);
      toast('Groupe supprimé', 'success');
      loadStats();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const loadReports = async (sub: ReportSubTab) => {
    setReportsLoading(true);
    try {
      if (sub === 'users') setUserReports(await adminAPI.reports.users());
      else if (sub === 'posts') setPostReports(await adminAPI.reports.posts());
      else if (sub === 'groups') setGroupReports(await adminAPI.reports.groups());
      else setReportHistory(await adminAPI.reports.history());
    } catch (e) {
      console.error(e);
      toast('Erreur de chargement des signalements', 'error');
    }
    setReportsLoading(false);
  };

  const clearUserReport = async (id: number) => {
    try {
      await adminAPI.reports.clearUser(id);
      setUserReports((prev) => prev.filter((r) => r.id !== id));
      toast('Signalement clôturé', 'success');
      loadStats();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const clearPostReport = async (id: number) => {
    try {
      await adminAPI.reports.clearPost(id);
      setPostReports((prev) => prev.filter((r) => r.id !== id));
      toast('Signalement clôturé', 'success');
      loadStats();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const clearGroupReport = async (gid: string) => {
    try {
      await adminAPI.reports.clearGroup(gid);
      setGroupReports((prev) => prev.filter((r) => r.gid !== gid));
      toast('Signalement levé', 'success');
      loadStats();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const loadBans = async () => {
    setBansLoading(true);
    try {
      setActiveBans(await adminAPI.bans.list());
    } catch {
      toast('Erreur de chargement des bannissements', 'error');
    }
    setBansLoading(false);
  };

  const submitBan = async () => {
    if (!banTarget || banSending) return;
    setBanSending(true);
    try {
      const durationHours = banDuration === 'permanent' ? undefined : Number(banDuration);
      await adminAPI.bans.ban(banTarget.uid, banReason.trim() || undefined, durationHours);
      toast('Utilisateur banni', 'success');
      setBanTarget(null);
      setBanReason('');
      setBanDuration('permanent');
      loadBans();
      loadStats();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
    setBanSending(false);
  };

  const unban = async (uid: string) => {
    if (!confirm('Débannir cet utilisateur ?')) return;
    try {
      await adminAPI.bans.unban(uid);
      setActiveBans((prev) => prev.filter((b) => b.uid !== uid));
      toast('Utilisateur débanni', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const searchProfile = async (qOverride?: string) => {
    const q = (qOverride ?? searchQuery).trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchError('');
    setSearchResult(null);
    setEditMsg('');
    setBadgeMsg('');
    setActionMsg('');
    setLoginHistory([]);
    try {
      let uid: string;
      let prof: UserProfile;
      if (q.startsWith('@')) {
        const res = await fetch(`/api/search/users/${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error('Utilisateur introuvable');
        const data = (await res.json()) as { uid: string; profile: UserProfile };
        uid = data.uid;
        prof = data.profile;
      } else {
        const res = await fetch(`/api/profiles/${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error('Utilisateur introuvable');
        prof = (await res.json()) as UserProfile;
        uid = q;
      }
      if (!prof?.pseudo) throw new Error('Profil introuvable');
      setSearchResult({ uid, profile: prof });
      setEditData({
        pseudo: prof.pseudo || '',
        bio: prof.bio || '',
        avatar: prof.avatar || '',
        banner: prof.banner || '',
        wouaffId: prof.wouaffId || '',
      });
      const rawBadges = prof.ownedBadges;
      let ids: string[] = [];
      if (rawBadges) {
        if (Array.isArray(rawBadges)) ids = rawBadges.filter(Boolean) as string[];
        else if (typeof rawBadges === 'object')
          ids = Object.values(rawBadges as Record<string, string>).filter(Boolean);
      }
      setSelectedBadges(ids);
      loadLoginHistory(uid);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Erreur');
    }
    setSearchLoading(false);
  };

  const loadLoginHistory = async (uid: string) => {
    setLoginHistoryLoading(true);
    try {
      setLoginHistory(await adminAPI.loginHistory(uid));
    } catch (e) {
      console.error(e);
      setLoginHistory([]);
    }
    setLoginHistoryLoading(false);
  };

  const pickAdminImage = async (file: File, kind: 'avatar' | 'banner') => {
    if (!file.type.startsWith('image/')) {
      toast('Le fichier sélectionné doit être une image.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('Image trop volumineuse (10 Mo maximum).', 'error');
      return;
    }
    setAdminImgLoading(kind);
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (!e.target?.result) {
        setAdminImgLoading(null);
        return;
      }
      try {
        const compressed = await compressImage(e.target.result as string, kind === 'avatar' ? 600 : 1200, 0.78);
        setEditData((p) => ({ ...p, [kind]: compressed }));
        toast(kind === 'avatar' ? 'Photo de profil chargée' : 'Bannière chargée', 'success');
      } catch {
        toast("Impossible de traiter l'image.", 'error');
      } finally {
        setAdminImgLoading(null);
      }
    };
    reader.onerror = () => {
      setAdminImgLoading(null);
      toast("Impossible de lire l'image.", 'error');
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    if (!searchResult) return;
    const { uid } = searchResult;
    const data: Record<string, string> = {};
    if (editData.pseudo !== searchResult.profile.pseudo) data.pseudo = editData.pseudo;
    if (editData.bio !== (searchResult.profile.bio || '')) data.bio = editData.bio;
    if (editData.avatar !== (searchResult.profile.avatar || '')) data.avatar = editData.avatar;
    if (editData.banner !== (searchResult.profile.banner || '')) data.banner = editData.banner;
    if (editData.wouaffId !== (searchResult.profile.wouaffId || '')) {
      if (!editData.wouaffId.startsWith('@')) {
        setEditMsg("L'identifiant doit commencer par @");
        return;
      }
      data.wouaffId = editData.wouaffId;
    }
    if (Object.keys(data).length === 0) {
      setEditMsg('Aucune modification');
      return;
    }
    try {
      await adminAPI.profile.update(uid, data);
      adminAPI.logAction('profile_update', 'user', uid, Object.keys(data).join(', '));
      setEditMsg('✓ Profil mis à jour');
      toast('Profil mis à jour', 'success');
      setSearchResult({ ...searchResult, profile: { ...searchResult.profile, ...data } });
    } catch (e) {
      setEditMsg(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const toggleBadge = (id: string) => {
    setSelectedBadges((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  const saveBadges = async () => {
    if (!searchResult) return;
    try {
      await adminAPI.badges.set(searchResult.uid, selectedBadges);
      adminAPI.logAction('badge_update', 'user', searchResult.uid, selectedBadges.join(', '));
      setBadgeMsg('✓ Badges mis à jour');
      toast('Badges mis à jour', 'success');
    } catch (e) {
      setBadgeMsg(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const resetWouaffId = async () => {
    if (!searchResult || !confirm('Réinitialiser le Wouaff ID de cet utilisateur ?')) return;
    try {
      await adminAPI.profile.resetWouaffId(searchResult.uid);
      adminAPI.logAction('wouaffid_reset', 'user', searchResult.uid);
      setActionMsg('✓ Wouaff ID réinitialisé');
      toast('Wouaff ID réinitialisé', 'success');
      setEditData((prev) => ({ ...prev, wouaffId: '' }));
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const deleteAccount = async () => {
    if (!searchResult) return;
    if (!confirm('⚠️ Supprimer définitivement ce compte ?')) return;
    if (!confirm('⚠️ Confirmer la suppression définitive ? Cette action est irréversible.')) return;
    try {
      await adminAPI.profile.delete(searchResult.uid);
      adminAPI.logAction('account_delete', 'user', searchResult.uid, searchResult.profile.pseudo);
      toast('Compte supprimé', 'success');
      setSearchResult(null);
      setSearchQuery('');
      setLoginHistory([]);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const seedBadges = async () => {
    const res = await adminAPI.badges.seed().catch(() => null);
    if (res) {
      if (res.created.length > 0) toast(`Badges créés : ${res.created.join(', ')}`, 'success');
      else toast('Tous les badges existent déjà', 'info');
      adminAPI.badges
        .list()
        .then((data) => setBadgeDefs(data as Record<string, { name?: string; icon?: string }>))
        .catch(() => {});
    } else {
      toast('Erreur lors du seed des badges', 'error');
    }
  };

  const addStaff = async () => {
    const uid = staffUidInput.trim();
    if (!uid) return;
    try {
      await adminAPI.staff.add(uid);
      setStaffMsg(`✓ ${uid} ajouté au staff (modérateur)`);
      toast('Membre ajouté au staff', 'success');
      setStaffUidInput('');
      loadStaff();
    } catch (e) {
      setStaffMsg(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const setStaffRole = async (uid: string, role: string) => {
    try {
      await adminAPI.staff.setRole(uid, role);
      toast(`Rôle mis à jour : ${role === 'owner' ? 'propriétaire' : 'modérateur'}`, 'success');
      loadStaff();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const removeStaff = async (uid: string) => {
    if (!confirm(`Retirer ${uid} du staff ?`)) return;
    try {
      await adminAPI.staff.remove(uid);
      toast('Membre retiré du staff', 'success');
      loadStaff();
    } catch {
      toast('Erreur', 'error');
    }
  };

  const clickUser = (uid: string) => {
    setSearchQuery(uid);
    setActiveTab('users');
    setSearchResult(null);
    setTimeout(() => {
      searchProfile(uid);
    }, 100);
  };

  const openReportedUser = (uid: string) => {
    setSearchQuery(uid);
    setActiveTab('users');
    setTimeout(() => {
      searchProfile(uid);
    }, 100);
  };

  if (checking) {
    return (
      <div className="admin-page">
        <div className="admin-center">
          <div className="admin-spinner" />
          <p className="admin-muted">Vérification...</p>
        </div>
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="admin-page">
        <div className="admin-center">
          <div className="admin-forbidden-icon">
            <Lock size={48} />
          </div>
          <h2 className="admin-forbidden-title">Accès refusé</h2>
          <p className="admin-muted">Vous n'avez pas les permissions nécessaires.</p>
          <button className="admin-btn admin-btn-primary mt-3" onClick={() => navigate('/')}>
            Retour au chat
          </button>
          <button
            className="admin-btn admin-btn-secondary mt-2"
            onClick={async () => {
              try {
                const r = await adminAPI.bootstrap();
                if (r.success) {
                  setIsStaff(true);
                  toast('Vous êtes maintenant propriétaire !', 'success');
                }
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Erreur', 'error');
              }
            }}
          >
            <Key size={16} /> Devenir premier admin
          </button>
        </div>
      </div>
    );
  }

  const statGroups: { id: 'general' | 'social' | 'moderation'; label: string }[] = [
    { id: 'general', label: 'Général' },
    { id: 'social', label: 'Réseau social' },
    { id: 'moderation', label: 'Modération' },
  ];

  const memberMap = (groupDetail?.members as Record<string, GroupMember>) || {};

  return (
    <div className={`admin-page${mobileOpen ? ' drawer-open' : ''}`}>
      <div className="admin-mobile-header">
        <button
          type="button"
          className="admin-mobile-hamburger"
          onClick={() => setMobileOpen(true)}
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>
        <span className="admin-mobile-title">Panneau d'administration</span>
        <button type="button" className="admin-mobile-back" onClick={() => navigate('/')} aria-label="Retour">
          <ArrowLeft size={18} />
        </button>
      </div>

      <div className="admin-backdrop" onClick={() => setMobileOpen(false)} />

      <div className="admin-layout">
        <aside className={`admin-sidebar${mobileOpen ? ' open' : ''}`}>
          <button
            type="button"
            className="admin-drawer-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
          <div className="admin-sidebar-brand">
            <div className="admin-brand-icon">
              <Shield size={20} />
            </div>
            <div className="admin-brand-text">
              <span className="admin-brand-name">Panneau d'administration</span>
              <span className="admin-brand-sub">Wouaff Social</span>
            </div>
          </div>

          {profile && (
            <div className="admin-self-card">
              <div className="admin-self-avatar">
                {profile.avatar ? <img src={profile.avatar} alt="" /> : <span>{(profile.pseudo || '?')[0]}</span>}
              </div>
              <div className="admin-self-info">
                <div className="admin-self-name">{profile.pseudo || 'Staff'}</div>
                <div className="admin-self-badge">
                  <Shield size={10} /> {isOwner ? 'Propriétaire' : 'Modérateur'}
                </div>
              </div>
            </div>
          )}

          <nav className="admin-menu">
            {TABS.map((t) => (
              <div
                key={t.id}
                className={`admin-menu-item${activeTab === t.id ? ' active' : ''}`}
                onClick={() => {
                  setActiveTab(t.id);
                  setMobileOpen(false);
                }}
              >
                <span className="admin-menu-icon">{t.icon}</span>
                {t.label}
              </div>
            ))}
          </nav>

          <div className="admin-sidebar-footer">
            <button className="admin-back-btn" onClick={() => navigate('/')}>
              <ArrowLeft size={14} /> Retour
            </button>
            <button className="admin-logout-btn" onClick={logout}>
              <LogOut size={14} /> Déconnexion
            </button>
          </div>
        </aside>

        <div className="admin-mobile-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`admin-mobile-tab${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <main className="admin-main">
          {/* ── DASHBOARD ── */}
          {activeTab === 'dashboard' && (
            <div className="admin-panel active">
              <div className="admin-panel-header">
                <h2>Tableau de bord</h2>
                <p>Vue d'ensemble de la plateforme Wouaff et du réseau social.</p>
              </div>

              <div className="admin-global-search">
                <Search size={18} className="admin-global-search-icon" />
                <input
                  className="admin-input"
                  placeholder="Recherche globale : utilisateur, post, vidéo, groupe, message..."
                  value={globalQ}
                  onChange={(e) => setGlobalQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runGlobalSearch()}
                />
                <button
                  className="admin-btn admin-btn-primary"
                  onClick={() => runGlobalSearch()}
                  disabled={globalLoading}
                >
                  {globalLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
                {globalResults && (
                  <button
                    className="admin-btn admin-btn-secondary"
                    onClick={() => {
                      setGlobalResults(null);
                      setGlobalQ('');
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {globalResults && (
                <div className="admin-card">
                  <div className="admin-card-title">
                    <Search size={16} /> Résultats pour « {globalQ} »
                  </div>
                  {globalResults.users.length > 0 && (
                    <>
                      <div className="admin-section-divider">
                        <span>Utilisateurs</span>
                      </div>
                      <div className="admin-user-list">
                        {globalResults.users.map((u) => (
                          <div
                            key={u.uid as string}
                            className="admin-user-item"
                            onClick={() => clickUser(u.uid as string)}
                          >
                            <div className="admin-user-avatar">
                              {u.avatar ? (
                                <img src={u.avatar as string} alt="" />
                              ) : (
                                <span>{(u.pseudo as string)?.[0]?.toUpperCase() || '?'}</span>
                              )}
                            </div>
                            <div className="admin-user-info">
                              <div className="admin-user-name">{(u.pseudo as string) || 'Utilisateur'}</div>
                              <div className="admin-user-id">{(u.wouaffId as string) || (u.uid as string)}</div>
                            </div>
                            <ChevronRight size={14} className="admin-user-chevron" />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {globalResults.posts.length > 0 && (
                    <>
                      <div className="admin-section-divider">
                        <span>Posts</span>
                      </div>
                      <div className="admin-mod-list">
                        {globalResults.posts.map((p) => (
                          <div key={p.id as string} className="admin-mod-item">
                            {avatar(p.avatar as string, p.pseudo as string)}
                            <div className="admin-mod-body">
                              <div className="admin-mod-head">
                                <span className="admin-mod-author">{(p.pseudo as string) || 'Utilisateur'}</span>
                                <span className="admin-mod-time">{timeAgo(p.createdAt as number)}</span>
                              </div>
                              <p className="admin-mod-text">{(p.text as string) || '(sans texte)'}</p>
                            </div>
                            <button
                              className="admin-btn admin-btn-danger px-2.5 py-1.5 text-[11px]"
                              onClick={() => deletePost(p.id as string)}
                            >
                              <Trash2 size={12} /> Supprimer
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {globalResults.groups.length > 0 && (
                    <>
                      <div className="admin-section-divider">
                        <span>Groupes</span>
                      </div>
                      <div className="admin-user-list">
                        {globalResults.groups.map((g) => (
                          <div
                            key={g.gid as string}
                            className="admin-user-item"
                            onClick={() => {
                              setActiveTab('groups');
                              openGroupDetail(g.gid as string);
                            }}
                          >
                            <div className="admin-user-avatar">
                              <Users size={16} />
                            </div>
                            <div className="admin-user-info">
                              <div className="admin-user-name">{(g.name as string) || 'Groupe'}</div>
                              <div className="admin-user-id">{g.privacy as string}</div>
                            </div>
                            <ChevronRight size={14} className="admin-user-chevron" />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {globalResults.videos.length > 0 && (
                    <>
                      <div className="admin-section-divider">
                        <span>Vidéos</span>
                      </div>
                      <div className="admin-mod-list">
                        {globalResults.videos.map((v) => (
                          <div key={v.id as string} className="admin-mod-item">
                            <div className="admin-user-avatar">
                              <Film size={16} />
                            </div>
                            <div className="admin-mod-body">
                              <div className="admin-mod-head">
                                <span className="admin-mod-author">{(v.pseudo as string) || 'Utilisateur'}</span>
                                <span className="admin-mod-time">{timeAgo(v.createdAt as number)}</span>
                              </div>
                              <p className="admin-mod-text">{(v.caption as string) || '(sans description)'}</p>
                            </div>
                            <button
                              className="admin-btn admin-btn-danger px-2.5 py-1.5 text-[11px]"
                              onClick={() => deleteVideo(v.id as string)}
                            >
                              <Trash2 size={12} /> Supprimer
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {globalResults.messages.length > 0 && (
                    <>
                      <div className="admin-section-divider">
                        <span>Messages</span>
                      </div>
                      <div className="admin-mod-list">
                        {globalResults.messages.map((m, i) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: identifiants de message non uniques côté client
                          <div key={`${m.msgKey}-${i}`} className="admin-mod-item">
                            <div className="admin-user-avatar">
                              <MessageSquare size={16} />
                            </div>
                            <div className="admin-mod-body">
                              <div className="admin-mod-head">
                                <span className="admin-mod-author">{(m.fromUid as string).slice(0, 8)}...</span>
                                <span className="admin-mod-time">{timeAgo(m.time as number)}</span>
                              </div>
                              <p className="admin-mod-text">{(m.text as string) || '(sans texte)'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {globalResults.users.length +
                    globalResults.posts.length +
                    globalResults.videos.length +
                    globalResults.groups.length +
                    globalResults.messages.length ===
                    0 && <EmptyState icon={<Search size={26} />} text="Aucun résultat." />}
                </div>
              )}

              {stats &&
                statGroups.map((g) => (
                  <div key={g.id}>
                    <div className="admin-section-divider">
                      <span>{g.label}</span>
                    </div>
                    <div className="admin-stats-grid">
                      {STAT_CARDS.filter((s) => s.group === g.id).map((s) => (
                        <div
                          key={s.key}
                          className="admin-stat-card"
                          style={{ '--stat-color': s.color } as React.CSSProperties}
                        >
                          <div className="admin-stat-icon" style={{ background: `${s.color}20`, color: s.color }}>
                            {s.icon}
                          </div>
                          <div className={`admin-stat-value${s.online ? ' admin-stat-online' : ''}`}>
                            {stats[s.key] ?? 0}
                          </div>
                          <div className="admin-stat-label">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              <div className="admin-actions-row">
                <button className="admin-btn admin-btn-primary" onClick={loadStats}>
                  <RefreshCw size={16} /> Actualiser
                </button>
                <button className="admin-btn admin-btn-accent" onClick={seedBadges}>
                  <Award size={16} /> Seed badges
                </button>
                {isOwner && (
                  <button
                    className="admin-btn admin-btn-secondary"
                    onClick={async () => {
                      const r = await adminAPI.migrate.wouaffIds();
                      toast(`${r.migrated} identifiants indexés`, 'success');
                    }}
                  >
                    <Link2 size={16} /> Migrer wouaffIds
                  </button>
                )}
                <button
                  className="admin-btn admin-btn-secondary"
                  onClick={() => {
                    setActiveTab('reports');
                    loadReports('users');
                  }}
                >
                  <Flag size={16} /> Signalements
                </button>
                {isOwner && (
                  <button
                    className={`admin-btn ${maintenanceOn ? 'admin-btn-danger' : 'admin-btn-secondary'}`}
                    onClick={toggleMaintenance}
                    disabled={maintenanceLoading}
                  >
                    <ShieldAlert size={16} /> {maintenanceOn ? 'Désactiver maintenance' : 'Activer maintenance'}
                  </button>
                )}
              </div>

              {maintenanceOn && isOwner && (
                <div className="admin-card mt-1">
                  <div className="admin-card-title">
                    <ShieldAlert size={16} /> Message de maintenance
                  </div>
                  <textarea
                    className="admin-input admin-textarea mt-1"
                    rows={2}
                    value={maintenanceMsg}
                    onChange={(e) => setMaintenanceMsg(e.target.value)}
                    placeholder="Message optionnel affiché aux utilisateurs..."
                  />
                  <button
                    className="admin-btn admin-btn-primary mt-1"
                    onClick={toggleMaintenance}
                    disabled={maintenanceLoading}
                  >
                    <Save size={16} /> Appliquer
                  </button>
                </div>
              )}

              <div className="admin-section-divider">
                <span>Analytics</span>
                <div className="admin-analytics-toggle">
                  <button
                    type="button"
                    className={`admin-subtab${analyticsDays === 7 ? ' active' : ''}`}
                    onClick={() => loadAnalytics(7)}
                  >
                    7 jours
                  </button>
                  <button
                    type="button"
                    className={`admin-subtab${analyticsDays === 30 ? ' active' : ''}`}
                    onClick={() => loadAnalytics(30)}
                  >
                    30 jours
                  </button>
                </div>
              </div>

              {analytics && (
                <div className="admin-analytics-grid">
                  <div className="admin-card admin-analytics-card">
                    <div className="admin-card-title">
                      <TrendingUp size={16} /> Inscriptions / jour
                    </div>
                    <BarChart data={analytics.registrations} color="var(--brand)" />
                  </div>
                  <div className="admin-card admin-analytics-card">
                    <div className="admin-card-title">
                      <Edit3 size={16} /> Posts / jour
                    </div>
                    <BarChart data={analytics.posts} color="#3b82f6" />
                  </div>
                  <div className="admin-card admin-analytics-card">
                    <div className="admin-card-title">
                      <MessageSquare size={16} /> Messages / jour
                    </div>
                    <BarChart data={analytics.messages} color="#06b6d4" />
                  </div>
                  <div className="admin-card admin-analytics-card">
                    <div className="admin-card-title">
                      <Heart size={16} /> Top posts
                    </div>
                    <div className="admin-mod-list">
                      {analytics.topPosts.length === 0 && <p className="admin-muted">Aucun post.</p>}
                      {analytics.topPosts.slice(0, 5).map((p) => (
                        <div key={p.id as string} className="admin-mod-item">
                          {avatar(p.avatar as string, p.pseudo as string)}
                          <div className="admin-mod-body">
                            <div className="admin-mod-head">
                              <span className="admin-mod-author">{(p.pseudo as string) || 'Utilisateur'}</span>
                              <span className="admin-mod-time">{timeAgo(p.createdAt as number)}</span>
                            </div>
                            <p className="admin-mod-text">{(p.text as string) || '(sans texte)'}</p>
                            <div className="admin-mod-meta">
                              <span>
                                <Heart size={12} /> {p.likesCount as number}
                              </span>
                              <span>
                                <MessageCircle size={12} /> {p.commentsCount as number}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="admin-card admin-analytics-card">
                    <div className="admin-card-title">
                      <Users size={16} /> Utilisateurs actifs
                    </div>
                    <div className="admin-mod-list">
                      {analytics.topUsers.length === 0 && <p className="admin-muted">Aucun utilisateur.</p>}
                      {analytics.topUsers.slice(0, 5).map((u) => (
                        <div
                          key={u.uid as string}
                          className="admin-mod-item"
                          onClick={() => clickUser(u.uid as string)}
                        >
                          {avatar(u.avatar as string, u.pseudo as string)}
                          <div className="admin-mod-body">
                            <div className="admin-mod-head">
                              <span className="admin-mod-author">{(u.pseudo as string) || 'Utilisateur'}</span>
                              <span className="admin-mod-time">{u.postCount as number} posts</span>
                            </div>
                            <div className="admin-mod-meta">
                              <span>
                                <UserPlus size={12} /> {u.followersCount as number} abonnés
                              </span>
                              <span>
                                <Repeat2 size={12} /> {u.followingCount as number} abonnements
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MODÉRATION ── */}
          {activeTab === 'moderation' && (
            <div className="admin-panel active">
              <div className="admin-panel-header">
                <h2>Modération du réseau social</h2>
                <p>Posts, commentaires et vidéos : consultez et supprimez le contenu.</p>
              </div>

              <div className="admin-subtabs">
                <button
                  type="button"
                  className={`admin-subtab${modSubTab === 'posts' ? ' active' : ''}`}
                  onClick={() => {
                    setModSubTab('posts');
                    loadModeration('posts', postFilter || undefined);
                  }}
                >
                  <Edit3 size={15} /> Posts
                </button>
                <button
                  type="button"
                  className={`admin-subtab${modSubTab === 'comments' ? ' active' : ''}`}
                  onClick={() => {
                    setModSubTab('comments');
                    loadModeration('comments');
                  }}
                >
                  <MessageCircle size={15} /> Commentaires
                </button>
                <button
                  type="button"
                  className={`admin-subtab${modSubTab === 'videos' ? ' active' : ''}`}
                  onClick={() => {
                    setModSubTab('videos');
                    loadModeration('videos');
                  }}
                >
                  <Film size={15} /> Vidéos
                </button>
              </div>

              {modLoading && <SkeletonRows count={5} />}

              {!modLoading && modSubTab === 'posts' && (
                <>
                  <div className="admin-search-row">
                    <input
                      className="admin-input"
                      placeholder="Filtrer par UID utilisateur..."
                      value={postFilter}
                      onChange={(e) => setPostFilter(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && loadModeration('posts', postFilter.trim() || undefined)}
                    />
                    <button
                      className="admin-btn admin-btn-primary"
                      onClick={() => loadModeration('posts', postFilter.trim() || undefined)}
                      disabled={modLoading}
                    >
                      <Search size={16} />
                    </button>
                    <button
                      className="admin-btn admin-btn-secondary"
                      onClick={() => loadModeration('posts')}
                      title="Réinitialiser"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>

                  <div className="admin-mod-list">
                    {modPosts.length === 0 && <EmptyState icon={<Edit3 size={26} />} text="Aucun post à modérer." />}
                    {modPosts.map((p) => (
                      <div key={p.id} className="admin-mod-item">
                        {avatar(p.avatar, p.pseudo)}
                        <div className="admin-mod-body">
                          <div className="admin-mod-head">
                            <span className="admin-mod-author">{p.pseudo || 'Utilisateur'}</span>
                            {p.staffUid && <ShieldCheck size={13} className="admin-mod-verified" />}
                            <span className="admin-mod-handle">
                              @{((p.wouaffId as string) || p.uid).replace(/^@/, '')}
                            </span>
                            <span className="admin-mod-time">{timeAgo(p.createdAt)}</span>
                          </div>
                          <p className="admin-mod-text">{p.text}</p>
                          {p.image && (
                            <img
                              src={p.image}
                              alt=""
                              className="admin-mod-thumb"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          )}
                          <div className="admin-mod-meta">
                            <span>
                              <Heart size={12} /> {p.likesCount}
                            </span>
                            <span>
                              <Repeat2 size={12} /> {p.repostsCount}
                            </span>
                            <span>
                              <MessageCircle size={12} /> {p.commentsCount}
                            </span>
                          </div>
                        </div>
                        <button
                          className="admin-btn admin-btn-danger px-2.5 py-1.5 text-[11px]"
                          onClick={() => deletePost(p.id, p.pseudo)}
                        >
                          <Trash2 size={12} /> Supprimer
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!modLoading && modSubTab === 'comments' && (
                <div className="admin-mod-list">
                  {modComments.length === 0 && (
                    <EmptyState icon={<MessageCircle size={26} />} text="Aucun commentaire." />
                  )}
                  {modComments.map((c) => (
                    <div key={c.id} className="admin-mod-item">
                      {avatar(c.avatar, c.pseudo)}
                      <div className="admin-mod-body">
                        <div className="admin-mod-head">
                          <span className="admin-mod-author">{c.pseudo || 'Utilisateur'}</span>
                          <span className="admin-mod-time">{timeAgo(c.createdAt)}</span>
                        </div>
                        <p className="admin-mod-text">{c.text}</p>
                        {c.postText && <div className="admin-mod-reply">sur : « {c.postText} »</div>}
                      </div>
                      <button
                        className="admin-btn admin-btn-danger px-2.5 py-1.5 text-[11px]"
                        onClick={() => deleteComment(c.id)}
                      >
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!modLoading && modSubTab === 'videos' && (
                <div className="admin-mod-grid">
                  {modVideos.length === 0 && <EmptyState icon={<Film size={26} />} text="Aucune vidéo." />}
                  {modVideos.map((v) => (
                    <div key={v.id} className="admin-video-card">
                      <div className="admin-video-preview">
                        <video src={v.videoPath} preload="metadata" muted playsInline />
                        <div className="admin-video-overlay">
                          <Film size={28} />
                        </div>
                      </div>
                      <div className="admin-video-info">
                        <div className="admin-mod-head">
                          <span className="admin-mod-author">{v.pseudo || 'Utilisateur'}</span>
                          <span className="admin-mod-time">{timeAgo(v.createdAt)}</span>
                        </div>
                        {v.caption && <p className="admin-mod-text">{v.caption}</p>}
                        <div className="admin-mod-meta">
                          <span>
                            <Heart size={12} /> {v.likesCount}
                          </span>
                          <span>
                            <MessageCircle size={12} /> {v.commentsCount}
                          </span>
                        </div>
                      </div>
                      <button
                        className="admin-btn admin-btn-danger px-2.5 py-1.5 text-[11px]"
                        onClick={() => deleteVideo(v.id, v.pseudo || undefined)}
                      >
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── GROUPES ── */}
          {activeTab === 'groups' && (
            <div className="admin-panel active">
              <div className="admin-panel-header">
                <h2>Groupes</h2>
                <p>Gestion de tous les groupes : membres, rôles, confidentialité.</p>
              </div>

              <div className="admin-search-row">
                <input
                  className="admin-input"
                  placeholder="Rechercher un groupe par nom..."
                  value={groupQ}
                  onChange={(e) => setGroupQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadGroups(groupQ.trim() || undefined)}
                />
                <button
                  className="admin-btn admin-btn-primary"
                  onClick={() => loadGroups(groupQ.trim() || undefined)}
                  disabled={groupsLoading}
                >
                  <Search size={16} />
                </button>
                <button className="admin-btn admin-btn-secondary" onClick={() => loadGroups()}>
                  <RefreshCw size={16} />
                </button>
              </div>

              {groupsLoading && <SkeletonRows count={5} />}

              {!groupsLoading && groupDetail && (
                <div className="admin-card">
                  <div className="admin-card-title">
                    <Users size={16} /> {groupDetail.name as string}
                    <button className="admin-card-close" onClick={() => setGroupDetail(null)}>
                      <X size={14} />
                    </button>
                  </div>
                  <div className="admin-field">
                    <label htmlFor="groupName">Nom</label>
                    <input
                      id="groupName"
                      className="admin-input"
                      value={groupEdit.name}
                      onChange={(e) => setGroupEdit((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label htmlFor="groupDesc">Description</label>
                    <textarea
                      id="groupDesc"
                      className="admin-input admin-textarea"
                      value={groupEdit.description}
                      onChange={(e) => setGroupEdit((p) => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label htmlFor="groupPrivacy">Confidentialité</label>
                    <select
                      id="groupPrivacy"
                      className="admin-input"
                      value={groupEdit.privacy}
                      onChange={(e) => setGroupEdit((p) => ({ ...p, privacy: e.target.value }))}
                    >
                      <option value="public">Public</option>
                      <option value="private">Privé</option>
                    </select>
                  </div>
                  <button className="admin-btn admin-btn-primary" onClick={saveGroup}>
                    <Save size={16} /> Enregistrer
                  </button>
                  <button
                    className="admin-btn admin-btn-danger mr-2"
                    onClick={() => deleteGroupAdmin(groupDetail.gid as string, groupDetail.name as string)}
                  >
                    <Trash2 size={16} /> Supprimer le groupe
                  </button>

                  <div className="admin-section-divider">
                    <span>Membres ({Object.keys(memberMap).length})</span>
                  </div>
                  <div className="admin-user-list">
                    {Object.entries(memberMap).map(([uid, m]) => (
                      <div key={uid} className="admin-user-item">
                        <div className="admin-user-avatar">
                          <span>{m.role === 'owner' ? '👑' : m.role === 'admin' ? '🛡' : '👤'}</span>
                        </div>
                        <div className="admin-user-info">
                          <div className="admin-user-name">{uid.slice(0, 12)}...</div>
                          <div className="admin-user-id">Rôle : {m.role}</div>
                        </div>
                        <div className="admin-mod-actions">
                          {m.role !== 'owner' && (
                            <button
                              className="admin-btn admin-btn-secondary px-2.5 py-1.5 text-[11px]"
                              onClick={() => changeGroupMemberRole(groupDetail.gid as string, uid, 'owner')}
                            >
                              <Shield size={12} /> Rendre owner
                            </button>
                          )}
                          {m.role !== 'admin' && m.role !== 'owner' && (
                            <button
                              className="admin-btn admin-btn-secondary px-2.5 py-1.5 text-[11px]"
                              onClick={() => changeGroupMemberRole(groupDetail.gid as string, uid, 'admin')}
                            >
                              <Shield size={12} /> Rendre admin
                            </button>
                          )}
                          <button
                            className="admin-btn admin-btn-danger px-2.5 py-1.5 text-[11px]"
                            onClick={() => kickGroupMember(groupDetail.gid as string, uid, uid.slice(0, 12))}
                          >
                            <UserMinus size={12} /> Exclure
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="admin-mod-list">
                {groups.length === 0 && !groupsLoading && (
                  <EmptyState icon={<Users size={26} />} text="Aucun groupe." />
                )}
                {groups.map((g) => (
                  <div key={g.gid as string} className="admin-mod-item">
                    <div className="admin-user-avatar">
                      {g.icon ? <img src={g.icon as string} alt="" /> : <Users size={16} />}
                    </div>
                    <div className="admin-mod-body">
                      <div className="admin-mod-head">
                        <span className="admin-mod-author">{(g.name as string) || 'Groupe'}</span>
                        {g.reported === 1 && (
                          <ShieldAlert size={13} className="admin-mod-verified" style={{ color: 'var(--danger)' }} />
                        )}
                        <span className="admin-mod-handle">{g.privacy as string}</span>
                        <span className="admin-mod-time">{timeAgo(g.createdAt as number)}</span>
                      </div>
                      <div className="admin-mod-meta">
                        <span>
                          <Users size={12} /> {g.memberCount as number} membres
                        </span>
                      </div>
                    </div>
                    <button
                      className="admin-btn admin-btn-secondary px-2.5 py-1.5 text-[11px]"
                      onClick={() => openGroupDetail(g.gid as string)}
                    >
                      <Edit3 size={12} /> Gérer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SIGNALEMENTS ── */}
          {activeTab === 'reports' && (
            <div className="admin-panel active">
              <div className="admin-panel-header">
                <h2>Signalements</h2>
                <p>Contenus et comptes signalés par la communauté.</p>
              </div>

              <div className="admin-subtabs">
                <button
                  type="button"
                  className={`admin-subtab${reportSubTab === 'users' ? ' active' : ''}`}
                  onClick={() => {
                    setReportSubTab('users');
                    loadReports('users');
                  }}
                >
                  <Flag size={15} /> Utilisateurs ({userReports.length})
                </button>
                <button
                  type="button"
                  className={`admin-subtab${reportSubTab === 'posts' ? ' active' : ''}`}
                  onClick={() => {
                    setReportSubTab('posts');
                    loadReports('posts');
                  }}
                >
                  <Edit3 size={15} /> Posts ({postReports.length})
                </button>
                <button
                  type="button"
                  className={`admin-subtab${reportSubTab === 'groups' ? ' active' : ''}`}
                  onClick={() => {
                    setReportSubTab('groups');
                    loadReports('groups');
                  }}
                >
                  <Users size={15} /> Groupes ({groupReports.length})
                </button>
                <button
                  type="button"
                  className={`admin-subtab${reportSubTab === 'history' ? ' active' : ''}`}
                  onClick={() => {
                    setReportSubTab('history');
                    loadReports('history');
                  }}
                >
                  <History size={15} /> Traités
                </button>
              </div>

              <div className="admin-actions-row">
                <button
                  className="admin-btn admin-btn-secondary"
                  onClick={() => loadReports(reportSubTab)}
                  disabled={reportsLoading}
                >
                  {reportsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Recharger
                </button>
              </div>

              {reportsLoading && <SkeletonRows count={4} />}

              {!reportsLoading && reportSubTab === 'users' && (
                <div className="admin-mod-list">
                  {userReports.length === 0 && (
                    <EmptyState icon={<Flag size={26} />} text="Aucun signalement utilisateur." />
                  )}
                  {userReports.map((r) => (
                    <div key={r.id} className="admin-mod-item">
                      {avatar(r.reportedAvatar, r.reportedPseudo)}
                      <div className="admin-mod-body">
                        <div className="admin-mod-head">
                          <span className="admin-mod-author">{r.reportedPseudo || 'Compte'}</span>
                          <span className="admin-mod-handle">
                            @{((r.reportedWouaffId as string) || r.reportedUid).replace(/^@/, '')}
                          </span>
                          <span className="admin-mod-time">{timeAgo(r.createdAt)}</span>
                        </div>
                        {r.reason && <p className="admin-mod-text">« {r.reason} »</p>}
                        <div className="admin-mod-reply">Signalé par {r.reporterPseudo || 'inconnu'}</div>
                      </div>
                      <div className="admin-mod-actions">
                        <button
                          className="admin-btn admin-btn-secondary px-2.5 py-1.5 text-[11px]"
                          onClick={() => openReportedUser(r.reportedUid)}
                        >
                          <Search size={12} /> Voir
                        </button>
                        <button
                          className="admin-btn admin-btn-primary px-2.5 py-1.5 text-[11px]"
                          onClick={() => clearUserReport(r.id)}
                        >
                          <X size={12} /> Clôturer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!reportsLoading && reportSubTab === 'posts' && (
                <div className="admin-mod-list">
                  {postReports.length === 0 && <EmptyState icon={<Edit3 size={26} />} text="Aucun post signalé." />}
                  {postReports.map((r) => (
                    <div key={r.id} className="admin-mod-item">
                      {avatar(r.postAvatar, r.postPseudo)}
                      <div className="admin-mod-body">
                        <div className="admin-mod-head">
                          <span className="admin-mod-author">{r.postPseudo || 'Utilisateur'}</span>
                          <span className="admin-mod-handle">
                            @{((r.postWouaffId as string) || r.postAuthorUid).replace(/^@/, '')}
                          </span>
                          <span className="admin-mod-time">{timeAgo(r.createdAt)}</span>
                        </div>
                        <p className="admin-mod-text">{r.postText || '(post supprimé)'}</p>
                        {r.postImage && (
                          <img
                            src={r.postImage}
                            alt=""
                            className="admin-mod-thumb"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                        {r.reason && (
                          <div className="admin-mod-reply">
                            Motif : « {r.reason} » · signalé par {r.reporterPseudo || 'inconnu'}
                          </div>
                        )}
                      </div>
                      <div className="admin-mod-actions">
                        <button
                          className="admin-btn admin-btn-secondary px-2.5 py-1.5 text-[11px]"
                          onClick={() => openReportedUser(r.postAuthorUid)}
                        >
                          <Search size={12} /> Auteur
                        </button>
                        <button
                          className="admin-btn admin-btn-primary px-2.5 py-1.5 text-[11px]"
                          onClick={() => clearPostReport(r.id)}
                        >
                          <X size={12} /> Clôturer
                        </button>
                        <button
                          className="admin-btn admin-btn-danger px-2.5 py-1.5 text-[11px]"
                          onClick={() => deletePost(r.postId, r.postPseudo)}
                        >
                          <Trash2 size={12} /> Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!reportsLoading && reportSubTab === 'groups' && (
                <div className="admin-mod-list">
                  {groupReports.length === 0 && <EmptyState icon={<Users size={26} />} text="Aucun groupe signalé." />}
                  {groupReports.map((r) => (
                    <div key={r.gid} className="admin-mod-item">
                      <div className="admin-user-avatar">
                        <Flag size={16} />
                      </div>
                      <div className="admin-mod-body">
                        <div className="admin-mod-head">
                          <span className="admin-mod-author">{r.name || 'Groupe sans nom'}</span>
                          <span className="admin-mod-time">{timeAgo(r.reportedAt)}</span>
                        </div>
                        <div className="admin-mod-reply">Signalé par {r.reportedBy.slice(0, 10)}...</div>
                      </div>
                      <div className="admin-mod-actions">
                        <button
                          className="admin-btn admin-btn-secondary px-2.5 py-1.5 text-[11px]"
                          onClick={() => {
                            setActiveTab('groups');
                            openGroupDetail(r.gid);
                          }}
                        >
                          <Search size={12} /> Voir
                        </button>
                        <button
                          className="admin-btn admin-btn-primary px-2.5 py-1.5 text-[11px]"
                          onClick={() => clearGroupReport(r.gid)}
                        >
                          <X size={12} /> Lever
                        </button>
                        <button
                          className="admin-btn admin-btn-danger px-2.5 py-1.5 text-[11px]"
                          onClick={() => deleteGroupAdmin(r.gid, r.name)}
                        >
                          <Trash2 size={12} /> Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!reportsLoading && reportSubTab === 'history' && (
                <div className="admin-log-list">
                  {reportHistory.length === 0 && (
                    <EmptyState icon={<History size={26} />} text="Aucune action de modération enregistrée." />
                  )}
                  {reportHistory.map((h) => (
                    <div key={h.id} className="admin-log-item">
                      <div className="admin-log-icon">
                        <History size={14} />
                      </div>
                      <div className="admin-log-info">
                        <div className="admin-log-action">
                          {h.action === 'deleted' ? 'Suppression' : 'Clôture'} · {h.reportType}
                          {h.reportId && (
                            <>
                              {' '}
                              · <code>{h.reportId.slice(0, 12)}...</code>
                            </>
                          )}
                        </div>
                        <div className="admin-log-meta">par {h.adminPseudo || 'staff'}</div>
                      </div>
                      <div className="admin-log-time">{formatDate(h.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── UTILISATEURS ── */}
          {activeTab === 'users' && (
            <div className="admin-panel active">
              <div className="admin-panel-header">
                <h2>Utilisateurs</h2>
                <p>Recherche, édition, badges, bannissements et historique de connexion.</p>
              </div>

              <div className="admin-search-row">
                <input
                  className="admin-input"
                  placeholder="@wouaff_id, UID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchProfile()}
                />
                <button
                  className="admin-btn admin-btn-primary"
                  onClick={() => searchProfile()}
                  disabled={searchLoading}
                >
                  {searchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
                <button
                  className="admin-btn admin-btn-secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResult(null);
                    setLoginHistory([]);
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {searchError && <div className="admin-msg admin-msg-error">{searchError}</div>}

              {searchResult && (
                <div className="admin-profile-section">
                  <div className="admin-profile-card">
                    {searchResult.profile.banner && (
                      <div
                        className="admin-profile-banner"
                        style={{ backgroundImage: `url(${searchResult.profile.banner})` }}
                      />
                    )}
                    <div className="admin-profile-card-body">
                      <div className="admin-profile-avatar-wrap">
                        {searchResult.profile.avatar ? (
                          <img
                            className="admin-profile-avatar-img"
                            src={searchResult.profile.avatar}
                            alt=""
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="admin-profile-avatar-fallback">{(searchResult.profile.pseudo || '?')[0]}</div>
                        )}
                      </div>
                      <div className="admin-profile-name">{searchResult.profile.pseudo || 'Utilisateur'}</div>
                      <div className="admin-profile-handle">{searchResult.profile.wouaffId || '(aucun)'}</div>
                      <div className="admin-profile-uid">{searchResult.uid}</div>
                      {searchResult.profile.bio && <div className="admin-profile-bio">{searchResult.profile.bio}</div>}
                      <div className="admin-profile-badges">
                        {selectedBadges.length > 0 ? (
                          selectedBadges.map((id) =>
                            badgeDefs[id] ? (
                              <span key={id} className={`admin-badge-chip${id === 'staff' ? ' staff-chip' : ''}`}>
                                {badgeDefs[id].icon && <img src={badgeDefs[id].icon} alt="" />}
                                {badgeDefs[id].name || id}
                              </span>
                            ) : null,
                          )
                        ) : (
                          <span className="admin-muted">Aucun badge</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="admin-card">
                    <div className="admin-card-title">
                      <Edit3 size={16} /> Modifier le profil
                    </div>
                    <div className="admin-field">
                      <label htmlFor="adminPseudo">Pseudo</label>
                      <input
                        id="adminPseudo"
                        className="admin-input"
                        value={editData.pseudo}
                        onChange={(e) => setEditData((p) => ({ ...p, pseudo: e.target.value }))}
                      />
                    </div>
                    <div className="admin-field">
                      <label htmlFor="adminBio">Bio</label>
                      <textarea
                        id="adminBio"
                        className="admin-input admin-textarea"
                        value={editData.bio}
                        onChange={(e) => setEditData((p) => ({ ...p, bio: e.target.value }))}
                      />
                    </div>
                    <div className="admin-field">
                      <label htmlFor="adminAvatar">Avatar</label>
                      <div className="admin-search-row">
                        <input
                          id="adminAvatar"
                          className="admin-input"
                          value={editData.avatar}
                          placeholder="https://... ou importez un fichier"
                          onChange={(e) => setEditData((p) => ({ ...p, avatar: e.target.value }))}
                        />
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          onClick={() => adminAvatarFileRef.current?.click()}
                          disabled={adminImgLoading === 'avatar'}
                        >
                          {adminImgLoading === 'avatar' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                          {adminImgLoading === 'avatar' ? '...' : 'Fichier'}
                        </button>
                        <input
                          ref={adminAvatarFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) pickAdminImage(file, 'avatar');
                            e.target.value = '';
                          }}
                        />
                      </div>
                    </div>
                    <div className="admin-field">
                      <label htmlFor="adminBanner">Bannière</label>
                      <div className="admin-search-row">
                        <input
                          id="adminBanner"
                          className="admin-input"
                          value={editData.banner}
                          placeholder="https://... ou importez un fichier"
                          onChange={(e) => setEditData((p) => ({ ...p, banner: e.target.value }))}
                        />
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          onClick={() => adminBannerFileRef.current?.click()}
                          disabled={adminImgLoading === 'banner'}
                        >
                          {adminImgLoading === 'banner' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                          {adminImgLoading === 'banner' ? '...' : 'Fichier'}
                        </button>
                        <input
                          ref={adminBannerFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) pickAdminImage(file, 'banner');
                            e.target.value = '';
                          }}
                        />
                      </div>
                    </div>
                    <div className="admin-field">
                      <label htmlFor="adminWouaffId">Identifiant Wouaff</label>
                      <input
                        id="adminWouaffId"
                        className="admin-input"
                        value={editData.wouaffId}
                        onChange={(e) => setEditData((p) => ({ ...p, wouaffId: e.target.value }))}
                        placeholder="@identifiant"
                      />
                    </div>
                    <button className="admin-btn admin-btn-primary" onClick={saveProfile}>
                      <Save size={16} /> Enregistrer
                    </button>
                    {editMsg && <div className="admin-msg">{editMsg}</div>}
                  </div>

                  <div className="admin-card">
                    <div className="admin-card-title">
                      <Award size={16} /> Gestion des badges
                    </div>
                    <div className="admin-badge-grid">
                      {Object.entries(badgeDefs).map(([id, b]) => (
                        <div
                          key={id}
                          className={`admin-badge-opt${selectedBadges.includes(id) ? ' selected' : ''}`}
                          onClick={() => toggleBadge(id)}
                        >
                          {b.icon && <img src={b.icon} alt="" />}
                          <span>{b.name || id}</span>
                        </div>
                      ))}
                    </div>
                    <button className="admin-btn admin-btn-primary mt-3" onClick={saveBadges}>
                      <Save size={16} /> Sauvegarder
                    </button>
                    {badgeMsg && <div className="admin-msg">{badgeMsg}</div>}
                  </div>

                  <div className="admin-card">
                    <div className="admin-card-title">
                      <Globe size={16} /> Historique de connexions
                      <button
                        className="admin-card-close"
                        onClick={() => loadLoginHistory(searchResult.uid)}
                        title="Recharger"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                    {loginHistoryLoading ? (
                      <p className="admin-muted">Chargement...</p>
                    ) : loginHistory.length === 0 ? (
                      <p className="admin-muted">Aucune connexion enregistrée.</p>
                    ) : (
                      <div className="admin-log-list">
                        {loginHistory.map((h) => (
                          <div key={h.id} className="admin-log-item">
                            <div className="admin-log-icon">
                              <KeyRound size={14} />
                            </div>
                            <div className="admin-log-info">
                              <div className="admin-log-action">
                                <code>{h.ip || 'IP inconnue'}</code>
                              </div>
                              {h.userAgent && (
                                <div className="admin-log-meta">
                                  {h.userAgent.length > 80 ? `${h.userAgent.slice(0, 80)}...` : h.userAgent}
                                </div>
                              )}
                            </div>
                            <div className="admin-log-time">{formatDate(h.createdAt)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {isOwner && (
                    <div className="admin-card admin-card-danger">
                      <div className="admin-card-title">
                        <Ban size={16} /> Bannissement
                      </div>
                      <button
                        className="admin-btn admin-btn-danger mr-2"
                        onClick={() =>
                          setBanTarget({ uid: searchResult.uid, pseudo: searchResult.profile.pseudo || 'Utilisateur' })
                        }
                      >
                        <Ban size={16} /> Bannir cet utilisateur
                      </button>
                      <div className="admin-msg">{actionMsg}</div>
                    </div>
                  )}

                  {isOwner && (
                    <div className="admin-card admin-card-danger">
                      <div className="admin-card-title">
                        <AlertTriangle size={16} /> Actions sur le compte
                      </div>
                      <button className="admin-btn admin-btn-warning mr-2" onClick={resetWouaffId}>
                        <RefreshCw size={16} /> Réinitialiser l'ID
                      </button>
                      <button className="admin-btn admin-btn-danger" onClick={deleteAccount}>
                        <Trash2 size={16} /> Supprimer le compte
                      </button>
                      {actionMsg && <div className="admin-msg">{actionMsg}</div>}
                    </div>
                  )}
                </div>
              )}

              <div className="admin-section-divider">
                <span>Bannissements actifs</span>
                <button className="admin-btn admin-btn-secondary px-3 py-1.5 text-xs" onClick={loadBans}>
                  {bansLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Charger
                </button>
              </div>
              <div className="admin-mod-list">
                {activeBans.length === 0 && <p className="admin-muted">Aucun bannissement actif.</p>}
                {activeBans.map((b) => (
                  <div key={b.uid as string} className="admin-mod-item">
                    {avatar(b.avatar as string, b.pseudo as string)}
                    <div className="admin-mod-body">
                      <div className="admin-mod-head">
                        <span className="admin-mod-author">{(b.pseudo as string) || (b.uid as string)}</span>
                        <span className="admin-mod-time">
                          {b.expiresAt ? `jusqu'au ${formatDate(b.expiresAt as number)}` : 'Permanent'}
                        </span>
                      </div>
                      {b.reason ? <p className="admin-mod-text">« {b.reason as string} »</p> : null}
                      <div className="admin-mod-reply">Banni le {formatDate(b.createdAt as number)}</div>
                    </div>
                    {isOwner && (
                      <button
                        className="admin-btn admin-btn-primary px-2.5 py-1.5 text-[11px]"
                        onClick={() => unban(b.uid as string)}
                      >
                        <ShieldCheck size={12} /> Débannir
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="admin-section-divider">
                <span>Utilisateurs récents</span>
                <button className="admin-btn admin-btn-secondary px-3 py-1.5 text-xs" onClick={loadRecentUsers}>
                  <RefreshCw size={12} /> Charger
                </button>
              </div>

              <div className="admin-user-list">
                {Object.entries(recentUsers).length === 0 && <p className="admin-muted">Aucun utilisateur</p>}
                {Object.entries(recentUsers)
                  .reverse()
                  .map(([uid, p]) => (
                    <div key={uid} className="admin-user-item" onClick={() => clickUser(uid)}>
                      <div className="admin-user-avatar">
                        {p.avatar ? <img src={p.avatar} alt="" /> : <span>{(p.pseudo || '?')[0]}</span>}
                      </div>
                      <div className="admin-user-info">
                        <div className="admin-user-name">{p.pseudo || '(sans pseudo)'}</div>
                        <div className="admin-user-id">{p.wouaffId || "pas d'ID"}</div>
                      </div>
                      <ChevronRight size={14} className="admin-user-chevron" />
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── STAFF ── */}
          {activeTab === 'staff' && (
            <div className="admin-panel active">
              <div className="admin-panel-header">
                <h2>Gestion du staff</h2>
                <p>Ajouter ou retirer des membres, gérer les rôles.</p>
              </div>

              {isOwner && (
                <div className="admin-card">
                  <div className="admin-card-title">
                    <UserPlus size={16} /> Ajouter un membre
                  </div>
                  <div className="admin-search-row">
                    <input
                      className="admin-input"
                      placeholder="UID..."
                      value={staffUidInput}
                      onChange={(e) => setStaffUidInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addStaff()}
                    />
                    <button className="admin-btn admin-btn-primary" onClick={addStaff}>
                      <UserPlus size={16} /> Ajouter (modérateur)
                    </button>
                  </div>
                  {staffMsg && <div className="admin-msg">{staffMsg}</div>}
                </div>
              )}

              <div className="admin-section-divider">
                <span>Membres du staff</span>
              </div>

              <div className="admin-user-list">
                {Object.keys(staffList).length === 0 && (
                  <p className="admin-muted p-3">Aucun membre. Cliquez sur "Charger".</p>
                )}
                <button className="admin-btn admin-btn-secondary mb-2" onClick={loadStaff}>
                  <RefreshCw size={14} /> Charger la liste
                </button>
                {Object.entries(staffList).map(([uid, s]) => (
                  <div key={uid} className="admin-user-item">
                    <div className="admin-user-avatar bg-gradient-to-br from-brand to-amber-500">
                      {s.profile?.avatar ? <img src={s.profile.avatar} alt="" /> : <Shield size={16} />}
                    </div>
                    <div className="admin-user-info">
                      <div className="admin-user-name">
                        {s.profile?.pseudo || uid.slice(0, 8)}
                        <span className={`admin-role-chip ${s.role === 'owner' ? ' owner' : ''}`}>
                          {s.role === 'owner' ? 'Propriétaire' : 'Modérateur'}
                        </span>
                      </div>
                      <div className="admin-user-id">{s.profile?.wouaffId || `${uid.slice(0, 12)}...`}</div>
                    </div>
                    {isOwner && uid !== user?.uid && (
                      <div className="admin-mod-actions">
                        {s.role === 'moderator' && (
                          <button
                            className="admin-btn admin-btn-secondary px-2.5 py-1.5 text-[11px]"
                            onClick={() => setStaffRole(uid, 'owner')}
                          >
                            <Shield size={12} /> Promouvoir
                          </button>
                        )}
                        {s.role === 'owner' && (
                          <button
                            className="admin-btn admin-btn-warning px-2.5 py-1.5 text-[11px]"
                            onClick={() => setStaffRole(uid, 'moderator')}
                          >
                            <UserMinus size={12} /> Rétrograder
                          </button>
                        )}
                        <button
                          className="admin-btn admin-btn-danger px-2.5 py-1.5 text-[11px]"
                          onClick={() => removeStaff(uid)}
                        >
                          <UserMinus size={12} /> Retirer
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ACTIVITÉ ── */}
          {activeTab === 'logs' && (
            <div className="admin-panel active">
              <div className="admin-panel-header">
                <h2>Activité du staff</h2>
                <p>Dernières actions de modération des administrateurs.</p>
              </div>

              <button className="admin-btn admin-btn-secondary mb-4" onClick={loadLogs}>
                {logsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Charger l'activité
              </button>

              {logs.length === 0 && !logsLoading && (
                <div className="admin-card text-center p-8">
                  <Activity size={32} className="opacity-30 mb-2" />
                  <p className="admin-muted">Aucune activité enregistrée</p>
                </div>
              )}

              <div className="admin-log-list">
                {logs.map((log) => (
                  <div key={log.id} className="admin-log-item">
                    <div className="admin-log-icon">{ACTION_ICONS[log.action] || <Activity size={14} />}</div>
                    <div className="admin-log-info">
                      <div className="admin-log-action">{ACTIONS_LABELS[log.action] || log.action}</div>
                      <div className="admin-log-meta">
                        {logProfiles[log.adminUid]?.pseudo || log.adminUid.slice(0, 8)}
                        {log.targetId && (
                          <>
                            {' '}
                            · <code>{log.targetId.slice(0, 12)}...</code>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="admin-log-time">{timeAgo(log.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {banTarget && (
        <div
          className="modal-overlay active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBanTarget(null);
          }}
        >
          <div className="flex flex-col w-full max-w-[440px] rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl">
            <div className="flex items-center gap-4 px-4 h-14 border-b border-[var(--border)]">
              <button
                type="button"
                onClick={() => setBanTarget(null)}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-primary)] border-none bg-transparent cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
              >
                <X size={18} />
              </button>
              <span className="font-bold text-[var(--text-primary)] text-[17px] m-0">Bannir {banTarget.pseudo}</span>
            </div>
            <div className="px-5 py-4">
              <div className="admin-field">
                <label htmlFor="banReason">Raison</label>
                <textarea
                  id="banReason"
                  className="admin-input admin-textarea"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Motif du bannissement..."
                />
              </div>
              <div className="admin-field">
                <label htmlFor="banDuration">Durée</label>
                <select
                  id="banDuration"
                  className="admin-input"
                  value={banDuration}
                  onChange={(e) => setBanDuration(e.target.value)}
                >
                  <option value="permanent">Permanent</option>
                  <option value="24">24 heures</option>
                  <option value="72">3 jours</option>
                  <option value="168">7 jours</option>
                  <option value="720">30 jours</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  type="button"
                  className="px-4 py-2 rounded-full text-sm font-bold text-[var(--text-secondary)] border border-[var(--border)] bg-transparent cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                  onClick={() => setBanTarget(null)}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={submitBan}
                  disabled={banSending}
                >
                  {banSending ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                  Bannir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="admin-toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`admin-toast admin-toast-${t.type}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
