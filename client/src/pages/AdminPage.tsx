import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { inputClass, outlineBtn, primaryBtn } from '../components/formStyles';
import PageHeader, { Tabs } from '../components/PageHeader';
import { REPORT_CATEGORIES } from '../components/ReportDialog';
import { useAuth } from '../hooks/useAuth';
import { fullDate, timeAgo } from '../lib/time';
import { api, errorMessage } from '../services/api';

/* Outils de modération : file de signalements, sanctions, journal. Réservé aux rôles moderator et admin. */

const TABS = ['reports', 'users', 'log'] as const;
const LABELS = { reports: 'Signalements', users: 'Utilisateurs', log: 'Journal' };

type Status = 'open' | 'actioned' | 'dismissed' | 'all';

interface AdminReport {
  id: number;
  category: string;
  reason: string | null;
  status: string;
  createdAt: string;
  reporter: string | null;
  openReportsOnPost: number;
  post: { id: number; exists: boolean; text: string | null; image: string | null; video: string | null } | null;
  target: { uid: string; pseudo: string; status: string; role: string } | null;
  resolution: string | null;
  handledAt: number | null;
}

interface AdminUser {
  uid: string;
  pseudo: string;
  role: string;
  status: string;
  suspendedUntil: number | null;
  statusReason: string | null;
  createdAt: number;
  reportsAgainst: number;
}

interface LogEntry {
  id: number;
  action: string;
  reason: string | null;
  createdAt: number;
  actor: string | null;
  target: string | null;
  postId: number | null;
  reportId: number | null;
}

const categoryLabel = (id: string) => REPORT_CATEGORIES.find((c) => c.id === id)?.label ?? id;

const ACTION_LABELS: Record<string, string> = {
  'report:dismiss': 'Signalement classé sans suite',
  'report:delete_post': 'Post supprimé',
  'report:warn': 'Avertissement',
  'report:suspend': 'Suspension (signalement)',
  'report:ban': 'Bannissement (signalement)',
  'user:suspend': 'Suspension',
  'user:unsuspend': 'Suspension levée',
  'user:ban': 'Bannissement',
  'user:unban': 'Bannissement levé',
  'user:delete_account': 'Compte supprimé',
  'user:set_role:moderator': 'Promu modérateur',
  'user:set_role:user': 'Rôle retiré',
};

function Chip({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'danger' | 'ok' }) {
  const color =
    tone === 'danger'
      ? 'text-[var(--danger)] border-[var(--danger)]/40'
      : tone === 'ok'
        ? 'text-[var(--repost-color)] border-[var(--repost-color)]/40'
        : 'text-[var(--text-secondary)] border-[var(--border-color)]';
  return <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${color}`}>{children}</span>;
}

function Alert({ error }: { error: string }) {
  return error ? (
    <p role="alert" className="text-sm text-[var(--danger)]">
      {error}
    </p>
  ) : null;
}

/* ── Signalements ───────────────────────────────────────────────────────────── */

function ReportCard({ report, isAdmin, onDone }: { report: AdminReport; isAdmin: boolean; onDone: () => void }) {
  const open = report.status === 'open';
  const [action, setAction] = useState('delete_post');
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(3);
  const [alsoDelete, setAlsoDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const needsReason = action !== 'dismiss';
  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (action === 'ban' && !window.confirm(`Bannir @${report.target?.pseudo} ?`)) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/admin/reports/${report.id}/resolve`, {
        action,
        reason,
        days: action === 'suspend' ? days : undefined,
        deleteContent: alsoDelete && action !== 'dismiss' && action !== 'delete_post',
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <article className="px-4 py-4 border-b border-[var(--border-color)] space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Chip tone="danger">{categoryLabel(report.category)}</Chip>
        {report.openReportsOnPost > 1 && open && <Chip>{report.openReportsOnPost} signalements</Chip>}
        {!open && (
          <Chip tone={report.status === 'actioned' ? 'ok' : 'neutral'}>
            {report.status === 'actioned' ? 'Traité' : 'Classé'}
          </Chip>
        )}
        <span className="text-[var(--text-secondary)]">
          par @{report.reporter ?? 'compte supprimé'} · {timeAgo(report.createdAt)}
        </span>
      </div>

      <div className="border border-[var(--border-color)] rounded-lg p-3">
        {report.target && (
          <p className="text-sm text-[var(--text-secondary)] mb-1">
            Auteur : <Link to={`/${report.target.pseudo}`}>@{report.target.pseudo}</Link>
            {report.target.status !== 'active' && <> · {report.target.status === 'banned' ? 'banni' : 'suspendu'}</>}
          </p>
        )}
        {report.post ? (
          <>
            {report.post.text && (
              <p className="text-[var(--text-primary)] break-words whitespace-pre-wrap">{report.post.text}</p>
            )}
            {report.post.image && (
              <img src={report.post.image} alt="" className="mt-2 max-h-48 rounded-lg" loading="lazy" />
            )}
            {report.post.video && (
              // biome-ignore lint/a11y/useMediaCaption: média utilisateur signalé, sans piste de sous-titres
              <video src={report.post.video} controls preload="none" className="mt-2 max-h-48 rounded-lg" />
            )}
            {!report.post.exists && (
              <p className="text-xs text-[var(--text-secondary)] mt-1">Post déjà supprimé (extrait conservé).</p>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">Aucun contenu associé.</p>
        )}
      </div>
      {report.reason && <p className="text-sm text-[var(--text-primary)]">« {report.reason} »</p>}

      {open ? (
        <form onSubmit={apply} className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Décision"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className={`${inputClass} !w-auto !py-2`}
            >
              <option value="dismiss">Classer sans suite</option>
              <option value="delete_post" disabled={!report.post?.exists}>
                Supprimer le post
              </option>
              <option value="warn">Avertir l'auteur</option>
              <option value="suspend">Suspendre l'auteur</option>
              {isAdmin && <option value="ban">Bannir l'auteur</option>}
            </select>
            {action === 'suspend' && (
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                Durée (jours)
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className={`${inputClass} !w-24 !py-2`}
                />
              </label>
            )}
          </div>
          {needsReason && (
            <textarea
              aria-label="Motif communiqué à l'auteur"
              placeholder="Motif (communiqué à l'auteur)"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 400))}
              rows={2}
              required
              className="w-full bg-transparent border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none resize-none"
            />
          )}
          {['warn', 'suspend', 'ban'].includes(action) && report.post?.exists && (
            <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={alsoDelete}
                onChange={(e) => setAlsoDelete(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              Supprimer aussi le post
            </label>
          )}
          <Alert error={error} />
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? '…' : 'Appliquer'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">
          Décision{report.handledAt ? ` du ${fullDate(report.handledAt)}` : ''} : {report.resolution || '—'}
        </p>
      )}
    </article>
  );
}

function ReportsPanel({ isAdmin }: { isAdmin: boolean }) {
  const [status, setStatus] = useState<Status>('open');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReports(await api.get<AdminReport[]>(`/admin/reports?status=${status}`));
    } catch (err) {
      setError(errorMessage(err));
    }
    setLoading(false);
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex gap-2 px-4 py-3 border-b border-[var(--border-color)]">
        {(['open', 'actioned', 'dismissed', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={`${outlineBtn} ${status === s ? '!bg-[var(--bg-tertiary)]' : ''}`}
          >
            {{ open: 'Ouverts', actioned: 'Traités', dismissed: 'Classés', all: 'Tous' }[s]}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : error ? (
        <p className="p-4 text-[var(--danger)]">{error}</p>
      ) : reports.length === 0 ? (
        <p className="text-center py-12 text-[var(--text-secondary)]">Aucun signalement</p>
      ) : (
        reports.map((r) => <ReportCard key={r.id} report={r} isAdmin={isAdmin} onDone={load} />)
      )}
    </div>
  );
}

/* ── Utilisateurs ───────────────────────────────────────────────────────────── */

function UserCard({ u, isAdmin, onDone }: { u: AdminUser; isAdmin: boolean; onDone: () => void }) {
  const [action, setAction] = useState(
    u.status === 'banned' ? 'unban' : u.status === 'suspended' ? 'unsuspend' : 'suspend',
  );
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const protectedAccount = u.role === 'admin';

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (action === 'delete_account' && !window.confirm(`Supprimer définitivement le compte @${u.pseudo} ?`)) return;
    if (action === 'ban' && !window.confirm(`Bannir @${u.pseudo} ?`)) return;
    setBusy(true);
    setError('');
    try {
      const isRole = action === 'set_role_moderator' || action === 'set_role_user';
      await api.post(`/admin/users/${u.uid}/sanction`, {
        action: isRole ? 'set_role' : action,
        role: isRole ? action.replace('set_role_', '') : undefined,
        reason,
        days: action === 'suspend' ? days : undefined,
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const needsReason = ['suspend', 'ban', 'delete_account'].includes(action);
  return (
    <article className="px-4 py-4 border-b border-[var(--border-color)] space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/${u.pseudo}`} className="font-bold">
          @{u.pseudo}
        </Link>
        {u.role !== 'user' && <Chip tone="ok">{u.role === 'admin' ? 'admin' : 'modérateur'}</Chip>}
        {u.status === 'suspended' && (
          <Chip tone="danger">
            suspendu{u.suspendedUntil ? ` jusqu'au ${new Date(u.suspendedUntil).toLocaleDateString('fr-FR')}` : ''}
          </Chip>
        )}
        {u.status === 'banned' && <Chip tone="danger">banni</Chip>}
        {u.reportsAgainst > 0 && <Chip>{u.reportsAgainst} signalement(s)</Chip>}
      </div>
      <p className="text-xs text-[var(--text-secondary)]">
        Inscrit le {new Date(u.createdAt).toLocaleDateString('fr-FR')}
        {u.statusReason ? ` · motif : ${u.statusReason}` : ''}
      </p>
      {protectedAccount ? (
        <p className="text-xs text-[var(--text-secondary)]">Compte administrateur : non sanctionnable ici.</p>
      ) : (
        <form onSubmit={apply} className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className={`${inputClass} !w-auto !py-2`}
            >
              {u.status === 'suspended' && <option value="unsuspend">Lever la suspension</option>}
              <option value="suspend">Suspendre</option>
              {isAdmin &&
                (u.status === 'banned' ? (
                  <option value="unban">Lever le bannissement</option>
                ) : (
                  <option value="ban">Bannir</option>
                ))}
              {isAdmin && u.role === 'user' && <option value="set_role_moderator">Nommer modérateur</option>}
              {isAdmin && u.role === 'moderator' && (
                <option value="set_role_user">Retirer le rôle de modérateur</option>
              )}
              {isAdmin && <option value="delete_account">Supprimer le compte</option>}
            </select>
            {action === 'suspend' && (
              <input
                type="number"
                min={1}
                max={365}
                aria-label="Durée en jours"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className={`${inputClass} !w-24 !py-2`}
              />
            )}
          </div>
          {needsReason && (
            <input
              type="text"
              aria-label="Motif"
              placeholder="Motif (communiqué à l'utilisateur)"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 400))}
              required
              className={inputClass}
            />
          )}
          <Alert error={error} />
          <button type="submit" disabled={busy} className={outlineBtn}>
            {busy ? '…' : 'Appliquer'}
          </button>
        </form>
      )}
    </article>
  );
}

function UsersPanel({ isAdmin }: { isAdmin: boolean }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState('');

  const search = useCallback(async () => {
    if (q.trim().length < 2) {
      setUsers([]);
      return;
    }
    try {
      setUsers(await api.get<AdminUser[]>(`/admin/users?q=${encodeURIComponent(q.trim())}`));
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [q]);

  useEffect(() => {
    const t = window.setTimeout(search, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  return (
    <div>
      <div className="p-4 border-b border-[var(--border-color)]">
        <input
          type="search"
          aria-label="Rechercher un utilisateur"
          placeholder="Pseudo"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={inputClass}
        />
      </div>
      {error && <p className="p-4 text-[var(--danger)]">{error}</p>}
      {users.map((u) => (
        <UserCard key={u.uid} u={u} isAdmin={isAdmin} onDone={search} />
      ))}
      {q.trim().length >= 2 && users.length === 0 && !error && (
        <p className="text-center py-12 text-[var(--text-secondary)]">Aucun résultat</p>
      )}
    </div>
  );
}

/* ── Journal ────────────────────────────────────────────────────────────────── */

function LogPanel() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .get<LogEntry[]>('/admin/log?limit=100')
      .then(setLog)
      .catch((err) => setError(errorMessage(err)));
  }, []);
  if (error) return <p className="p-4 text-[var(--danger)]">{error}</p>;
  if (log.length === 0) return <p className="text-center py-12 text-[var(--text-secondary)]">Journal vide</p>;
  return (
    <div>
      {log.map((m) => (
        <div key={m.id} className="px-4 py-3 border-b border-[var(--border-color)] text-sm">
          <p className="text-[var(--text-primary)]">
            <span className="font-bold">{ACTION_LABELS[m.action] ?? m.action}</span>
            {m.target && <> · @{m.target}</>}
            {m.postId && <> · post #{m.postId}</>}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            par @{m.actor ?? 'compte supprimé'} · {fullDate(m.createdAt)}
            {m.reason ? ` · ${m.reason}` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>('reports');
  if (!user || (user.role !== 'moderator' && user.role !== 'admin')) return <Navigate to="/" replace />;
  return (
    <AppShell>
      <PageHeader title="Modération" subtitle={user.role === 'admin' ? 'Administrateur' : 'Modérateur'} back="/">
        <Tabs tabs={TABS} value={tab} onChange={setTab} labels={LABELS} />
      </PageHeader>
      {tab === 'reports' && <ReportsPanel isAdmin={user.role === 'admin'} />}
      {tab === 'users' && <UsersPanel isAdmin={user.role === 'admin'} />}
      {tab === 'log' && <LogPanel />}
    </AppShell>
  );
}
