import { getOne, query } from '../config/database.js';
import {
  createSystemNotification,
  deleteAccount,
  deletePostAsModerator,
  deleteUserSessions,
  findUserByUid,
  updateUser,
} from './rtdb.js';

/* Modération : traitement des signalements, sanctions et journal d'actions.
   Chaque décision est notifiée à l'auteur avec son motif (exposé des motifs du DSA, art. 17) et au signaleur
   (retour sur la suite donnée). Le texte juridique exact reste à valider avec un juriste. */

const CONTACT = process.env.CONTACT_EMAIL || 'contact@wouaff.app';
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_SUSPENSION_DAYS = 365;

export type ReportAction = 'dismiss' | 'delete_post' | 'warn' | 'suspend' | 'ban';
export type UserAction = 'suspend' | 'unsuspend' | 'ban' | 'unban' | 'delete_account' | 'set_role';
export type Role = 'user' | 'moderator' | 'admin';

export class ModerationError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Actor {
  uid: string;
  role: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  spam: 'spam',
  harassment: 'harcèlement',
  hate: 'haine ou discrimination',
  violence: 'violence ou menaces',
  illegal: 'contenu illégal',
  sexual: 'contenu sexuel',
  other: 'autre',
};

/* ── Journal ────────────────────────────────────────────────────────────────── */

export async function logModAction(entry: {
  actorUid: string;
  action: string;
  targetUid?: string | null;
  targetPostId?: number | null;
  reportId?: number | null;
  reason?: string | null;
}) {
  await query(
    'INSERT INTO mod_actions (actor_uid, action, target_uid, target_post_id, report_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      entry.actorUid,
      entry.action,
      entry.targetUid ?? null,
      entry.targetPostId ?? null,
      entry.reportId ?? null,
      entry.reason ? entry.reason.slice(0, 500) : null,
      Date.now(),
    ],
  );
}

export async function listModLog(limit: number, offset: number) {
  const lim = Math.max(1, Math.min(100, Math.trunc(limit)));
  const off = Math.max(0, Math.trunc(offset));
  return query<
    {
      id: number;
      action: string;
      reason: string | null;
      created_at: number;
      report_id: number | null;
      target_post_id: number | null;
      actor_pseudo: string | null;
      target_uid: string | null;
      target_pseudo: string | null;
    }[]
  >(
    `SELECT m.id, m.action, m.reason, m.created_at, m.report_id, m.target_post_id,
            a.pseudo AS actor_pseudo, m.target_uid, t.pseudo AS target_pseudo
     FROM mod_actions m
     LEFT JOIN users a ON a.uid = m.actor_uid
     LEFT JOIN users t ON t.uid = m.target_uid
     ORDER BY m.id DESC LIMIT ${lim} OFFSET ${off}`,
  );
}

/* ── Signalements ───────────────────────────────────────────────────────────── */

export async function countOpenReports(): Promise<number> {
  const row = await getOne<{ n: number }>("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'");
  return Number(row?.n ?? 0);
}

export async function listReports(status: string, limit: number, offset: number) {
  const lim = Math.max(1, Math.min(100, Math.trunc(limit)));
  const off = Math.max(0, Math.trunc(offset));
  const where = status === 'all' ? '1=1' : 'r.status = ?';
  return query<
    {
      id: number;
      category: string;
      reason: string | null;
      status: string;
      created_at: string;
      post_id: number | null;
      post_excerpt: string | null;
      post_text: string | null;
      post_image: string | null;
      post_video: string | null;
      post_exists: number;
      resolution: string | null;
      handled_at: number | null;
      reporter_pseudo: string | null;
      target_uid: string | null;
      target_pseudo: string | null;
      target_status: string | null;
      target_role: string | null;
      open_count: number;
    }[]
  >(
    `SELECT r.id, r.category, r.reason, r.status, r.created_at, r.post_id, r.post_excerpt,
            p.text AS post_text, p.image AS post_image, p.video AS post_video, (p.id IS NOT NULL) AS post_exists,
            r.resolution, r.handled_at, rp.pseudo AS reporter_pseudo,
            tu.uid AS target_uid, tu.pseudo AS target_pseudo, tu.status AS target_status, tu.role AS target_role,
            (SELECT COUNT(*) FROM reports r2 WHERE r2.post_id <=> r.post_id AND r2.status = 'open') AS open_count
     FROM reports r
     LEFT JOIN users rp ON rp.uid = r.reporter_uid
     LEFT JOIN users tu ON tu.uid = r.reported_uid
     LEFT JOIN posts p ON p.id = r.post_id
     WHERE ${where}
     ORDER BY r.created_at ${status === 'open' ? 'ASC' : 'DESC'}, r.id ASC
     LIMIT ${lim} OFFSET ${off}`,
    status === 'all' ? [] : [status],
  );
}

function assertCanSanction(actor: Actor, target: { uid: string; role: string }, needsAdmin: boolean) {
  if (needsAdmin && actor.role !== 'admin') throw new ModerationError(403, 'Action réservée aux administrateurs');
  if (target.uid === actor.uid)
    throw new ModerationError(400, 'Tu ne peux pas appliquer cette action à ton propre compte');
  if (target.role === 'admin') throw new ModerationError(403, 'Un administrateur ne peut pas être sanctionné ici');
  if (target.role === 'moderator' && actor.role !== 'admin') {
    throw new ModerationError(403, 'Seul un administrateur peut sanctionner un modérateur');
  }
}

function suspensionUntil(days: unknown): number {
  const n = Number(days);
  if (!Number.isInteger(n) || n < 1 || n > MAX_SUSPENSION_DAYS) {
    throw new ModerationError(400, `La suspension doit durer de 1 à ${MAX_SUSPENSION_DAYS} jours`);
  }
  return Date.now() + n * DAY_MS;
}

function cleanReason(reason: unknown, required: boolean): string | null {
  const text = typeof reason === 'string' ? reason.trim().slice(0, 400) : '';
  if (required && !text) throw new ModerationError(400, 'Un motif est obligatoire pour cette décision');
  return text || null;
}

const SANCTION_TEXT: Record<string, string> = {
  warn: 'Un avertissement',
  delete_post: 'Un de tes posts a été supprimé',
  suspend: 'Ton compte a été suspendu',
  ban: 'Ton compte a été banni',
};

export async function resolveReport(
  actor: Actor,
  reportId: number,
  input: { action: ReportAction; reason?: unknown; days?: unknown; deleteContent?: unknown },
) {
  const report = await getOne<{
    id: number;
    status: string;
    post_id: number | null;
    reported_uid: string | null;
    category: string;
  }>('SELECT id, status, post_id, reported_uid, category FROM reports WHERE id = ?', [reportId]);
  if (!report) throw new ModerationError(404, 'Signalement introuvable');
  if (report.status !== 'open') throw new ModerationError(409, 'Ce signalement a déjà été traité');

  const action = input.action;
  if (!['dismiss', 'delete_post', 'warn', 'suspend', 'ban'].includes(action)) {
    throw new ModerationError(400, 'Action inconnue');
  }
  const reason = cleanReason(input.reason, action !== 'dismiss');
  const target = report.reported_uid ? await findUserByUid(report.reported_uid) : null;
  const deleteContent = action === 'delete_post' || input.deleteContent === true;

  if (action !== 'dismiss') {
    if (!target) throw new ModerationError(409, "L'auteur n'existe plus : rien à sanctionner, classe le signalement");
    assertCanSanction(actor, target, action === 'ban');
  }
  const until = action === 'suspend' ? suspensionUntil(input.days) : null;

  /* 1. Effets sur le contenu et le compte. */
  let postDeleted = false;
  if (deleteContent && report.post_id) postDeleted = await deletePostAsModerator(report.post_id);
  if (action === 'suspend' && target) {
    await updateUser(target.uid, { status: 'suspended', suspended_until: until, status_reason: reason });
  }
  if (action === 'ban' && target) {
    await updateUser(target.uid, { status: 'banned', suspended_until: null, status_reason: reason });
    await deleteUserSessions(target.uid);
  }

  /* 2. Tous les signalements ouverts sur le même contenu sont clos d'un coup. */
  const resolution = action === 'dismiss' ? 'Aucune infraction constatée' : (reason ?? '');
  const newStatus = action === 'dismiss' ? 'dismissed' : 'actioned';
  const siblings = await query<{ id: number; reporter_uid: string }[]>(
    `SELECT id, reporter_uid FROM reports WHERE status = 'open' AND (id = ? OR (post_id IS NOT NULL AND post_id <=> ?))`,
    [report.id, report.post_id],
  );
  const ids = siblings.map((s) => s.id);
  await query(
    `UPDATE reports SET status = ?, handled_by = ?, handled_at = ?, resolution = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
    [newStatus, actor.uid, Date.now(), resolution.slice(0, 500), ...ids],
  );

  /* 3. Information de l'auteur (avec motif et voie de contestation) et des signaleurs. */
  if (action !== 'dismiss' && target) {
    const label = CATEGORY_LABELS[report.category] ?? 'autre';
    const lead = SANCTION_TEXT[action] + (postDeleted && action !== 'delete_post' ? ' (post supprimé)' : '');
    const duration = until ? ` jusqu'au ${new Date(until).toLocaleDateString('fr-FR')}` : '';
    await createSystemNotification(
      target.uid,
      'moderation',
      `${lead}${duration}. Motif : ${reason} (signalement : ${label}). Tu peux contester cette décision en écrivant à ${CONTACT}.`,
    );
  }
  const outcome =
    action === 'dismiss'
      ? "Après examen, ton signalement n'a pas conduit à une action de modération. Merci de ta vigilance."
      : 'Merci : ton signalement a conduit à une mesure de modération.';
  for (const reporter of new Set(siblings.map((s) => s.reporter_uid))) {
    await createSystemNotification(reporter, 'report_outcome', outcome);
  }

  await logModAction({
    actorUid: actor.uid,
    action: `report:${action}`,
    targetUid: target?.uid ?? report.reported_uid,
    targetPostId: report.post_id,
    reportId: report.id,
    reason: reason ?? resolution,
  });
  return { closed: ids.length, postDeleted };
}

/* ── Utilisateurs ───────────────────────────────────────────────────────────── */

/* Recherche par pseudo uniquement : l'adresse e-mail ne sort jamais de la base, même pour la modération. */
export async function searchUsers(q: string, limit = 30) {
  const like = `%${q.replace(/[!%_]/g, (c) => `!${c}`)}%`;
  return query<
    {
      uid: string;
      pseudo: string;
      role: string;
      status: string;
      suspended_until: number | null;
      status_reason: string | null;
      createdAt: number;
      reports_against: number;
    }[]
  >(
    `SELECT u.uid, u.pseudo, u.role, u.status, u.suspended_until, u.status_reason, u.createdAt,
            (SELECT COUNT(*) FROM reports r WHERE r.reported_uid = u.uid) AS reports_against
     FROM users u
     WHERE u.pseudo LIKE ? ESCAPE '!'
     ORDER BY u.createdAt DESC LIMIT ${Math.max(1, Math.min(100, Math.trunc(limit)))}`,
    [like],
  );
}

export async function sanctionUser(
  actor: Actor,
  uid: string,
  input: { action: UserAction; reason?: unknown; days?: unknown; role?: unknown },
) {
  const target = await findUserByUid(uid);
  if (!target) throw new ModerationError(404, 'Utilisateur introuvable');
  const action = input.action;
  const needsAdmin = ['ban', 'unban', 'delete_account', 'set_role'].includes(action);
  if (!['suspend', 'unsuspend', 'ban', 'unban', 'delete_account', 'set_role'].includes(action)) {
    throw new ModerationError(400, 'Action inconnue');
  }
  /* Rôles : un administrateur peut promouvoir/rétrograder un utilisateur ou un modérateur (jamais lui-même). */
  if (action === 'set_role') {
    if (actor.role !== 'admin') throw new ModerationError(403, 'Action réservée aux administrateurs');
    if (target.uid === actor.uid) throw new ModerationError(400, 'Tu ne peux pas modifier ton propre rôle');
    if (target.role === 'admin')
      throw new ModerationError(403, 'Le rôle d’un administrateur se change en ligne de commande');
    if (input.role !== 'user' && input.role !== 'moderator') throw new ModerationError(400, 'Rôle invalide');
    await updateUser(target.uid, { role: input.role });
    await logModAction({ actorUid: actor.uid, action: `user:set_role:${input.role}`, targetUid: target.uid });
    return { ok: true };
  }
  assertCanSanction(actor, target, needsAdmin);
  const reason = cleanReason(input.reason, action !== 'unsuspend' && action !== 'unban');

  switch (action) {
    case 'suspend': {
      const until = suspensionUntil(input.days);
      await updateUser(target.uid, { status: 'suspended', suspended_until: until, status_reason: reason });
      await createSystemNotification(
        target.uid,
        'moderation',
        `Ton compte a été suspendu jusqu'au ${new Date(until).toLocaleDateString('fr-FR')}. Motif : ${reason}. Tu peux contester cette décision en écrivant à ${CONTACT}.`,
      );
      break;
    }
    case 'unsuspend':
    case 'unban':
      await updateUser(target.uid, { status: 'active', suspended_until: null, status_reason: null });
      break;
    case 'ban':
      await updateUser(target.uid, { status: 'banned', suspended_until: null, status_reason: reason });
      await deleteUserSessions(target.uid);
      break;
    case 'delete_account':
      await deleteAccount(target.uid);
      break;
  }
  await logModAction({ actorUid: actor.uid, action: `user:${action}`, targetUid: target.uid, reason });
  return { ok: true };
}
