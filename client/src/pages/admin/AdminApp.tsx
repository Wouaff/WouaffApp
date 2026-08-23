import {
  Activity,
  ArrowLeft,
  Ban,
  Flag,
  Key,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { admin as adminApi, profiles } from '../../services/api';
import type { UserProfile } from '../../types';
import { BansTab } from './tabs/BansTab';
import { DashboardTab } from './tabs/DashboardTab';
import { type GroupRequest, GroupsTab } from './tabs/GroupsTab';
import { LogsTab } from './tabs/LogsTab';
import { ModerationTab } from './tabs/ModerationTab';
import { ReportsTab } from './tabs/ReportsTab';
import { SettingsTab } from './tabs/SettingsTab';
import { StaffTab } from './tabs/StaffTab';
import { type UserRequest, UsersTab } from './tabs/UsersTab';
import { Avatar, Button, Chip, ConfirmProvider, Spinner, ToastProvider, useToast } from './ui';

export type TabId =
  | 'dashboard'
  | 'moderation'
  | 'groups'
  | 'reports'
  | 'users'
  | 'bans'
  | 'staff'
  | 'logs'
  | 'settings';

export const TABS: Array<{ id: TabId; label: string; icon: ReactNode }> = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={18} /> },
  { id: 'moderation', label: 'Modération', icon: <ShieldCheck size={18} /> },
  { id: 'groups', label: 'Groupes', icon: <Users size={18} /> },
  { id: 'reports', label: 'Signalements', icon: <Flag size={18} /> },
  { id: 'users', label: 'Utilisateurs', icon: <User size={18} /> },
  { id: 'bans', label: 'Bans', icon: <Ban size={18} /> },
  { id: 'staff', label: 'Staff', icon: <Shield size={18} /> },
  { id: 'logs', label: 'Activité', icon: <Activity size={18} /> },
  { id: 'settings', label: 'Paramètres', icon: <Settings size={18} /> },
];

interface PaletteResult {
  users: Array<{ uid: string; pseudo: string; avatar?: string; wouaffId?: string }>;
  posts: Array<{ id: string; text: string; uid: string; pseudo: string; createdAt: number }>;
  videos: Array<{ id: string; caption?: string; uid: string; pseudo: string }>;
  groups: Array<{ gid: string; name: string; privacy: string }>;
  messages: Array<{ text: string; fromUid: string; time: number }>;
}

function Palette({
  open,
  onClose,
  onOpenUser,
  onOpenGroup,
  onOpenDashboard,
}: {
  open: boolean;
  onClose: () => void;
  onOpenUser: (uid: string) => void;
  onOpenGroup: (gid: string) => void;
  onOpenDashboard: () => void;
}) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PaletteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQ('');
      setResults(null);
      setActive(0);
      return;
    }
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const trimmed = q.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setResults(await adminApi.search(trimmed));
      } catch {
        toast('Erreur de recherche', 'error');
        setResults(null);
      }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, open, toast]);

  if (!open) return null;

  const flatten: Array<{ kind: string; id: string; label: string; sub: string; action: () => void }> = [];
  if (results) {
    for (const u of results.users)
      flatten.push({
        kind: 'Utilisateur',
        id: u.uid,
        label: u.pseudo || 'Utilisateur',
        sub: u.wouaffId || u.uid,
        action: () => onOpenUser(u.uid),
      });
    for (const p of results.posts)
      flatten.push({
        kind: 'Post',
        id: p.id,
        label: p.text?.slice(0, 60) || '(sans texte)',
        sub: p.pseudo || p.uid,
        action: () => onOpenUser(p.uid),
      });
    for (const v of results.videos)
      flatten.push({
        kind: 'Vidéo',
        id: v.id,
        label: v.caption?.slice(0, 60) || '(sans description)',
        sub: v.pseudo || v.uid,
        action: () => onOpenUser(v.uid),
      });
    for (const g of results.groups)
      flatten.push({ kind: 'Groupe', id: g.gid, label: g.name, sub: g.privacy, action: () => onOpenGroup(g.gid) });
    for (const m of results.messages)
      flatten.push({
        kind: 'Message',
        id: `${m.time}-${m.fromUid}`,
        label: m.text?.slice(0, 60) || '',
        sub: m.fromUid,
        action: () => {},
      });
  }

  const run = (i: number) => {
    const item = flatten[i];
    if (!item) return;
    onClose();
    item.action();
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flatten.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(active);
    }
  };

  return (
    <div className="wa-palette-overlay" onClick={onClose}>
      <div className="wa-palette" onClick={(e) => e.stopPropagation()}>
        <div className="wa-palette-input-row">
          <Search size={18} className="wa-palette-search-ic" />
          <input
            ref={inputRef}
            className="wa-palette-input"
            placeholder="Recherche globale : utilisateur, post, vidéo, groupe, message…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <kbd className="wa-kbd">ESC</kbd>
        </div>
        <div className="wa-palette-results">
          {loading && <div className="wa-palette-loading">Recherche…</div>}
          {!loading && !q.trim() && (
            <button type="button" className="wa-palette-hint" onClick={() => onOpenDashboard()}>
              <LayoutDashboard size={14} /> Ouvrir le tableau de bord
            </button>
          )}
          {!loading && q.trim() && flatten.length === 0 && <div className="wa-palette-loading">Aucun résultat.</div>}
          {flatten.map((item, i) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              className={`wa-palette-item${active === i ? ' active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(i)}
            >
              <span className="wa-palette-kind">{item.kind}</span>
              <span className="wa-palette-label">{item.label}</span>
              <span className="wa-palette-sub">{item.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="wa-center">
      <Spinner />
      <p className="wa-muted">Vérification…</p>
    </div>
  );
}

function ForbiddenView({ onBootstrap }: { onBootstrap: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="wa-center">
      <div className="wa-forbidden-icon">
        <Lock size={40} />
      </div>
      <h2 className="wa-forbidden-title">Accès refusé</h2>
      <p className="wa-muted">Vous n'avez pas les permissions nécessaires.</p>
      <div className="wa-center-actions">
        <Button
          variant="primary"
          onClick={async () => {
            setBusy(true);
            await onBootstrap();
            setBusy(false);
          }}
          loading={busy}
          icon={<Key size={16} />}
        >
          Devenir premier admin
        </Button>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [checking, setChecking] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [tab, setTab] = useState<TabId>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [userRequest, setUserRequest] = useState<UserRequest | null>(null);
  const [groupRequest, setGroupRequest] = useState<GroupRequest | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const isOwner = user?.staffRole === 'owner';

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const p = (await profiles.get(user.uid)) as unknown as UserProfile;
        setProfile(p);
        try {
          await adminApi.staff.list();
          setIsStaff(true);
        } catch {
          setIsStaff(false);
        }
      } catch {
        /* profil indisponible */
      }
      setChecking(false);
    })();
  }, [user]);

  /* Raccourci clavier Ctrl+K / Cmd+K */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openUser = useCallback((uid: string) => {
    setUserRequest({ uid, nonce: Date.now() });
    setTab('users');
  }, []);

  const openGroup = useCallback((gid: string) => {
    setGroupRequest({ gid, nonce: Date.now() });
    setTab('groups');
  }, []);

  const bootstrap = async () => {
    try {
      const r = await adminApi.bootstrap();
      if (r.success) {
        setIsStaff(true);
        toast('Vous êtes maintenant propriétaire !', 'success');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  if (checking) return <LoadingView />;
  if (!isStaff) return <ForbiddenView onBootstrap={bootstrap} />;

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className={`wa-shell${mobileOpen ? ' drawer-open' : ''}`}>
      <Palette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenUser={openUser}
        onOpenGroup={openGroup}
        onOpenDashboard={() => setTab('dashboard')}
      />

      <aside className="wa-sidebar">
        <button
          type="button"
          className="wa-drawer-close"
          onClick={() => setMobileOpen(false)}
          aria-label="Fermer le menu"
        >
          <X size={18} />
        </button>

        <div className="wa-brand">
          <div className="wa-brand-icon">
            <Shield size={22} />
          </div>
          <div className="wa-brand-text">
            <span className="wa-brand-name">Wouaff Admin</span>
            <span className="wa-brand-sub">Console d'administration</span>
          </div>
        </div>

        {profile && (
          <div className="wa-self">
            <Avatar src={profile.avatar} name={profile.pseudo} size={40} />
            <div className="wa-self-info">
              <div className="wa-self-name">{profile.pseudo || 'Staff'}</div>
              <Chip tone={isOwner ? 'brand' : 'neutral'}>{isOwner ? 'Propriétaire' : 'Modérateur'}</Chip>
            </div>
          </div>
        )}

        <nav className="wa-menu">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`wa-menu-item${tab === t.id ? ' active' : ''}`}
              onClick={() => {
                setTab(t.id);
                setMobileOpen(false);
              }}
            >
              <span className="wa-menu-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="wa-sidebar-footer">
          <Button
            variant="ghost"
            icon={<ArrowLeft size={15} />}
            onClick={() => navigate('/')}
            className="wa-footer-btn"
          >
            Retour à Wouaff
          </Button>
          <Button
            variant="ghost"
            icon={<LogOut size={15} />}
            onClick={logout}
            className="wa-footer-btn wa-footer-danger"
          >
            Déconnexion
          </Button>
        </div>
      </aside>

      <div className="wa-backdrop" onClick={() => setMobileOpen(false)} />

      <div className="wa-body">
        <header className="wa-topbar">
          <button
            type="button"
            className="wa-topbar-hamburger"
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu size={20} />
          </button>
          <div className="wa-topbar-title">
            <span className="wa-topbar-crumb">Administration</span>
            <strong>{current.label}</strong>
          </div>

          <button type="button" className="wa-topbar-search" onClick={() => setPaletteOpen(true)}>
            <Search size={16} />
            <span>Rechercher…</span>
            <kbd className="wa-kbd">Ctrl K</kbd>
          </button>

          <div className="wa-topbar-actions">
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={() => {
                setRefreshSignal((s) => s + 1);
                toast('Actualisation demandée', 'info');
              }}
            >
              Actualiser
            </Button>
            <div className="wa-topbar-avatar">
              <Avatar src={profile?.avatar} name={profile?.pseudo} size={34} />
            </div>
          </div>
        </header>

        <main className="wa-content">
          {tab === 'dashboard' && <DashboardTab refreshSignal={refreshSignal} isOwner={isOwner} />}
          {tab === 'moderation' && <ModerationTab />}
          {tab === 'groups' && <GroupsTab request={groupRequest} onClearRequest={() => setGroupRequest(null)} />}
          {tab === 'reports' && <ReportsTab onOpenUser={openUser} onOpenGroup={openGroup} />}
          {tab === 'users' && (
            <UsersTab request={userRequest} onClearRequest={() => setUserRequest(null)} isOwner={isOwner} />
          )}
          {tab === 'bans' && <BansTab isOwner={isOwner} />}
          {tab === 'staff' && <StaffTab isOwner={isOwner} />}
          {tab === 'logs' && <LogsTab />}
          {tab === 'settings' && <SettingsTab isOwner={isOwner} />}
        </main>
      </div>
    </div>
  );
}

export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
