import {
  Activity,
  Award,
  Circle,
  Edit3,
  Film,
  Flag,
  Globe,
  Heart,
  Link2,
  Mail,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Repeat2,
  ShieldAlert,
  TrendingUp,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { admin as adminApi } from '../../../services/api';
import {
  Avatar,
  BarChart,
  Button,
  Card,
  Chip,
  formatNumber,
  PageHeader,
  SectionTitle,
  SegTabs,
  StatCard,
  useNow,
  useToast,
} from '../ui';

interface StatDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  online?: boolean;
  group: 'general' | 'social' | 'moderation';
}

const STAT_CARDS: StatDef[] = [
  { key: 'users', label: 'Utilisateurs', icon: <User size={18} />, color: 'var(--brand)', group: 'general' },
  { key: 'online', label: 'En ligne', icon: <Circle size={18} />, color: '#22c55e', online: true, group: 'general' },
  { key: 'chats', label: 'Conversations', icon: <MessageSquare size={18} />, color: '#8b5cf6', group: 'general' },
  { key: 'messages', label: 'Messages', icon: <Mail size={18} />, color: '#06b6d4', group: 'general' },
  { key: 'badges', label: 'Badges', icon: <Award size={18} />, color: '#f59e0b', group: 'general' },
  { key: 'wouaffIds', label: 'Identifiants', icon: <Link2 size={18} />, color: '#ec4899', group: 'general' },
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
];

const GROUPS: Array<{ id: 'general' | 'social' | 'moderation'; label: string }> = [
  { id: 'general', label: 'Général' },
  { id: 'social', label: 'Réseau social' },
  { id: 'moderation', label: 'Modération' },
];

interface AnalyticsData {
  registrations: Array<{ date: string; count: number }>;
  posts: Array<{ date: string; count: number }>;
  messages: Array<{ date: string; count: number }>;
  topPosts: Array<Record<string, unknown>>;
  topUsers: Array<Record<string, unknown>>;
}

function timeAgoShort(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

export function DashboardTab({ refreshSignal, isOwner }: { refreshSignal: number; isOwner: boolean }) {
  const toast = useToast();
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [days, setDays] = useState<'7' | '30'>('7');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [seedBusy, setSeedBusy] = useState(false);
  const [migrateBusy, setMigrateBusy] = useState(false);

  const loadStats = useCallback(async () => {
    const s = await adminApi.stats().catch(() => null);
    if (s) {
      setStats(s as unknown as Record<string, number>);
      setLastUpdated(Date.now());
    }
  }, []);

  const loadAnalytics = useCallback(async (d: '7' | '30') => {
    setDays(d);
    const a = await adminApi.analytics(Number(d)).catch(() => null);
    if (a) setAnalytics(a as unknown as AnalyticsData);
  }, []);

  useEffect(() => {
    loadStats();
    loadAnalytics('7');
    /* Auto-refresh des stats toutes les 60s */
    const id = setInterval(loadStats, 60000);
    return () => clearInterval(id);
  }, [loadStats, loadAnalytics]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshSignal sert de déclencheur volontaire
  useEffect(() => {
    loadStats();
  }, [refreshSignal, loadStats]);

  useNow();

  const seedBadges = async () => {
    setSeedBusy(true);
    try {
      const res = await adminApi.badges.seed();
      toast(
        res.created.length > 0 ? `Badges créés : ${res.created.join(', ')}` : 'Tous les badges existent déjà',
        res.created.length > 0 ? 'success' : 'info',
      );
    } catch {
      toast('Erreur lors du seed des badges', 'error');
    }
    setSeedBusy(false);
  };

  const migrate = async () => {
    setMigrateBusy(true);
    try {
      const r = await adminApi.migrate.wouaffIds();
      toast(`${r.migrated} identifiants indexés`, 'success');
    } catch {
      toast('Erreur de migration', 'error');
    }
    setMigrateBusy(false);
  };

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle={
          lastUpdated
            ? `Vue d'ensemble de la plateforme · actualisé à ${new Date(lastUpdated).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
            : 'Vue d’ensemble de la plateforme Wouaff'
        }
        actions={
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={loadStats}>
            Actualiser
          </Button>
        }
      />

      {stats && (
        <div>
          {GROUPS.map((g) => (
            <div key={g.id} style={{ marginBottom: 20 }}>
              <SectionTitle>{g.label}</SectionTitle>
              <div className="wa-stats-grid">
                {STAT_CARDS.filter((s) => s.group === g.id).map((s) => (
                  <StatCard key={s.key} label={s.label} value={stats[s.key] ?? 0} icon={s.icon} color={s.color} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {!stats && (
        <div className="wa-grid-loading">
          <div className="wa-muted">Chargement des statistiques…</div>
        </div>
      )}

      <Card>
        <div className="wa-inline-actions">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={loadStats}>
            Actualiser les stats
          </Button>
          <Button variant="secondary" size="sm" icon={<Award size={14} />} onClick={seedBadges} loading={seedBusy}>
            Seed badges
          </Button>
          {isOwner && (
            <Button variant="secondary" size="sm" icon={<Link2 size={14} />} onClick={migrate} loading={migrateBusy}>
              Migrer wouaffIds
            </Button>
          )}
        </div>
      </Card>

      <SectionTitle
        action={
          <SegTabs<'7' | '30'>
            items={[
              { id: '7', label: '7 jours' },
              { id: '30', label: '30 jours' },
            ]}
            value={days}
            onChange={loadAnalytics}
          />
        }
      >
        <TrendingUp size={14} /> Analytics
      </SectionTitle>

      {analytics && (
        <div className="wa-analytics-grid">
          <Card title="Inscriptions / jour" icon={<User size={15} />}>
            <BarChart data={analytics.registrations} />
          </Card>
          <Card title="Posts / jour" icon={<Edit3 size={15} />}>
            <BarChart data={analytics.posts} color="#3b82f6" />
          </Card>
          <Card title="Messages / jour" icon={<MessageSquare size={15} />}>
            <BarChart data={analytics.messages} color="#06b6d4" />
          </Card>

          <Card title="Top posts" icon={<Heart size={15} />}>
            {analytics.topPosts.length === 0 && <p className="wa-muted">Aucun post.</p>}
            <div className="wa-item-list">
              {analytics.topPosts.slice(0, 5).map((p) => (
                <div key={p.id as string} className="wa-item">
                  <Avatar src={p.avatar as string} name={p.pseudo as string} size={36} />
                  <div className="wa-item-body">
                    <div className="wa-item-head">
                      <span className="wa-item-author">{(p.pseudo as string) || 'Utilisateur'}</span>
                      <span className="wa-item-time">{timeAgoShort(p.createdAt as number)}</span>
                    </div>
                    <p className="wa-item-text">{(p.text as string) || '(sans texte)'}</p>
                    <div className="wa-item-meta">
                      <span>
                        <Heart size={12} /> {formatNumber(p.likesCount as number)}
                      </span>
                      <span>
                        <MessageCircle size={12} /> {formatNumber(p.commentsCount as number)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Utilisateurs actifs" icon={<Users size={15} />}>
            {analytics.topUsers.length === 0 && <p className="wa-muted">Aucun utilisateur.</p>}
            <div className="wa-item-list">
              {analytics.topUsers.slice(0, 5).map((u) => (
                <div key={u.uid as string} className="wa-item">
                  <Avatar src={u.avatar as string} name={u.pseudo as string} size={36} />
                  <div className="wa-item-body">
                    <div className="wa-item-head">
                      <span className="wa-item-author">{(u.pseudo as string) || 'Utilisateur'}</span>
                      <span className="wa-item-time">{formatNumber(u.postCount as number)} posts</span>
                    </div>
                    <div className="wa-item-meta">
                      <span>
                        <UserPlus size={12} /> {formatNumber(u.followersCount as number)} abonnés
                      </span>
                      <span>
                        <Repeat2 size={12} /> {formatNumber(u.followingCount as number)} abonnements
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
      {!analytics && <div className="wa-muted">Chargement des analytics…</div>}

      <div className="wa-footnote">
        <Activity size={13} /> Données en temps réel · <Chip tone="brand">staff uniquement</Chip>
      </div>
    </div>
  );
}
