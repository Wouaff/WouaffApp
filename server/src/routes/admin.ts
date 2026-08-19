import { isIP } from 'node:net';
import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Server } from 'socket.io';
import { getOne, query } from '../config/database.js';
import { clearBanCache, clearIpBanCache, verifyToken } from '../middleware/auth.js';
import {
  addBadgeToUser,
  banIp,
  banUser,
  clearGroupReport,
  clearPostReport,
  clearUserReport,
  deleteGroup,
  deletePostById,
  deletePostCommentById,
  deleteUserProfile,
  deleteVideoById,
  getActiveBans,
  getActiveIpBans,
  getAdminAnalytics,
  getAdminLogs,
  getAdminStats,
  getAllStaff,
  getBadges,
  getGroup,
  getLoginHistory,
  getMaintenanceMode,
  getProfiles,
  getRecentUsers,
  getReportActions,
  getReportedGroups,
  getStaffRole,
  getUserEmail,
  listAllGroups,
  listPostReports,
  listRecentPostComments,
  listRecentPosts,
  listRecentVideos,
  listUserReports,
  logAdminAction,
  logReportAction,
  migrateWouaffIds,
  removeGroupMember,
  resetUserWouaffId,
  seedBadges,
  setGroupMemberRole,
  setMaintenanceMode,
  setStaff,
  setStaffRole,
  setUserBadges,
  unbanIpById,
  unbanUser,
  updateGroup,
  updateProfileByAdmin,
} from '../services/rtdb.js';
import type { AuthRequest } from '../types/index.js';

const router: Router = Router();
router.use(verifyToken);

type StaffLevel = 'moderator' | 'owner';

async function requireRole(req: Request, res: Response, min: StaffLevel): Promise<boolean> {
  const authReq = req as AuthRequest;
  const role = await getStaffRole(authReq.uid!);
  if (!role) {
    res.status(403).json({ error: 'Accès réservé au staff' });
    return false;
  }
  if (min === 'owner' && role !== 'owner') {
    res.status(403).json({ error: 'Action réservée au propriétaire' });
    return false;
  }
  return true;
}

/* POST /admin/bootstrap — premier admin si la liste staff est vide */
router.post('/bootstrap', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const allStaff = await getAllStaff();
  if (Object.keys(allStaff).length > 0) {
    res.status(403).json({ error: 'Un staff existe déjà, contactez un admin' });
    return;
  }
  await setStaff(authReq.uid!, true, 'owner');
  res.json({ success: true, message: 'Vous êtes maintenant propriétaire' });
});

/* GET /admin/staff — liste du staff (avec rôles) */
router.get('/staff', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const staff = await getAllStaff();
  const profiles = await getProfiles(Object.keys(staff));
  const result: Record<string, { role: string; addedAt: number; profile?: Record<string, unknown> }> = {};
  for (const [uid, info] of Object.entries(staff)) {
    result[uid] = { role: info.role, addedAt: info.addedAt, profile: profiles.get(uid) || undefined };
  }
  res.json(result);
});

/* POST /admin/staff/:uid — ajouter un membre au staff (owner) */
router.post('/staff/:uid', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'owner'))) return;
  const { role } = req.body as { role?: string };
  await setStaff(req.params.uid, true, role === 'owner' ? 'owner' : 'moderator');
  await logAdminAction((req as AuthRequest).uid!, 'staff_add', 'user', req.params.uid);
  res.json({ success: true });
});

/* PUT /admin/staff/:uid/role — changer le rôle d'un membre (owner) */
router.put('/staff/:uid/role', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'owner'))) return;
  const { role } = req.body as { role?: string };
  const next = role === 'owner' ? 'owner' : 'moderator';
  if (next === 'moderator') {
    const owners = Object.values(await getAllStaff()).filter((s) => s.role === 'owner');
    if (owners.length <= 1 && req.params.uid === (req as AuthRequest).uid) {
      res.status(400).json({ error: 'Impossible de rétrograder le dernier propriétaire' });
      return;
    }
  }
  await setStaffRole(req.params.uid, next);
  await logAdminAction((req as AuthRequest).uid!, 'staff_role', 'user', req.params.uid, next);
  res.json({ success: true, role: next });
});

/* DELETE /admin/staff/:uid — retirer du staff (owner) */
router.delete('/staff/:uid', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'owner'))) return;
  await setStaff(req.params.uid, false);
  await logAdminAction((req as AuthRequest).uid!, 'staff_remove', 'user', req.params.uid);
  res.json({ success: true });
});

/* GET /admin/stats — statistiques */
router.get('/stats', async (_req: Request, res: Response) => {
  if (!(await requireRole(_req, res, 'moderator'))) return;
  const stats = await getAdminStats();
  res.json(stats);
});

/* GET /admin/analytics — analytics (inscriptions/posts/messages par jour) */
router.get('/analytics', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const days = Math.min(90, Math.max(1, parseInt(req.query.days as string, 10) || 7));
  const analytics = await getAdminAnalytics(days);
  res.json(analytics);
});

/* GET /admin/search — recherche globale */
router.get('/search', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const q = ((req.query.q as string) || '').trim();
  if (!q) {
    res.json({ users: [], posts: [], videos: [], groups: [], messages: [] });
    return;
  }
  const like = `%${q}%`;
  const [users, posts, videos, groups, messages] = await Promise.all([
    query(
      'SELECT uid, pseudo, avatar, wouaffId, createdAt FROM users WHERE pseudo LIKE ? OR wouaffId LIKE ? OR uid LIKE ? LIMIT 10',
      [like, like, like],
    ),
    query(
      `SELECT p.id, p.text, p.uid, p.createdAt, u.pseudo, u.avatar
       FROM posts p LEFT JOIN users u ON u.uid = p.uid
       WHERE p.text LIKE ? ORDER BY p.createdAt DESC LIMIT 10`,
      [like],
    ),
    query(
      `SELECT v.id, v.caption, v.uid, v.createdAt, u.pseudo
       FROM videos v LEFT JOIN users u ON u.uid = v.uid
       WHERE v.caption LIKE ? ORDER BY v.createdAt DESC LIMIT 10`,
      [like],
    ),
    query(
      'SELECT gid, name, description, privacy, createdAt FROM groups_table WHERE name LIKE ? ORDER BY createdAt DESC LIMIT 10',
      [like],
    ),
    query('SELECT convId, msgKey, text, fromUid, time FROM messages WHERE text LIKE ? ORDER BY time DESC LIMIT 10', [
      like,
    ]),
  ]);
  res.json({ users, posts, videos, groups, messages });
});

/* GET /admin/users/recent — derniers utilisateurs inscrits */
router.get('/users/recent', async (_req: Request, res: Response) => {
  if (!(await requireRole(_req, res, 'moderator'))) return;
  const users = await getRecentUsers(20);
  res.json(users);
});

/* GET /admin/badges — liste des badges disponibles */
router.get('/badges', async (_req: Request, res: Response) => {
  const badges = await getBadges();
  res.json(badges);
});

/* POST /admin/badges/seed — recréer les badges manquants */
router.post('/badges/seed', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const result = await seedBadges();
  res.json(result);
});

/* PUT /admin/badges/:uid — remplacer tous les badges d'un utilisateur */
router.put('/badges/:uid', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const { badgeIds } = req.body as { badgeIds: string[] };
  await setUserBadges(req.params.uid, badgeIds || []);
  res.json({ success: true });
});

/* POST /admin/badges/:uid/add/:badgeId — ajouter un badge à un utilisateur */
router.post('/badges/:uid/add/:badgeId', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  await addBadgeToUser(req.params.uid, req.params.badgeId);
  res.json({ success: true });
});

/* GET /admin/profile/:uid/email — email d'un utilisateur + statut de vérification (staff) */
router.get('/profile/:uid/email', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const info = await getUserEmail(req.params.uid);
  res.json(info);
});

/* PUT /admin/profile/:uid — modifier le profil d'un utilisateur */
router.put('/profile/:uid', async (req: Request, res: Response) => {
  if (req.body && req.body.email !== undefined) {
    if (!(await requireRole(req, res, 'owner'))) return;
  } else if (!(await requireRole(req, res, 'moderator'))) return;
  await updateProfileByAdmin(req.params.uid, req.body);
  res.json({ success: true });
});

/* POST /admin/profile/:uid/reset-wouaffid — réinitialiser le wouaffId */
router.post('/profile/:uid/reset-wouaffid', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  await resetUserWouaffId(req.params.uid);
  res.json({ success: true });
});

/* DELETE /admin/profile/:uid — supprimer un compte utilisateur (owner) */
router.delete('/profile/:uid', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'owner'))) return;
  await deleteUserProfile(req.params.uid);
  await logAdminAction((req as AuthRequest).uid!, 'account_delete', 'user', req.params.uid);
  res.json({ success: true });
});

/* POST /admin/migrate/wouaffids — indexer tous les wouaffIds existants (owner) */
router.post('/migrate/wouaffids', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'owner'))) return;
  const result = await migrateWouaffIds();
  await logAdminAction((req as AuthRequest).uid!, 'migrate_wouaff_ids', 'system', undefined, `${result.migrated} IDs`);
  res.json(result);
});

/* GET /admin/logs — activité récente du staff */
router.get('/logs', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const logs = await getAdminLogs(100);
  res.json(logs);
});

/* GET /admin/login-history/:uid — historique des connexions d'un utilisateur */
router.get('/login-history/:uid', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const history = await getLoginHistory(req.params.uid, 100);
  res.json(history);
});

/* POST /admin/log-action — logger une action depuis le frontend */
router.post('/log-action', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const { action, targetType, targetId, details } = req.body as {
    action: string;
    targetType?: string;
    targetId?: string;
    details?: string;
  };
  await logAdminAction((req as AuthRequest).uid!, action, targetType, targetId, details);
  res.json({ success: true });
});

/* ── Bannissements (owner) ── */

/* GET /admin/bans — liste des bannissements actifs */
router.get('/bans', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'owner'))) return;
  const bans = await getActiveBans(200);
  res.json(bans);
});

/* POST /admin/bans — bannir un utilisateur */
router.post('/bans', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'owner'))) return;
  const authReq = req as AuthRequest;
  const { uid, reason, durationHours } = req.body as { uid?: string; reason?: string; durationHours?: number };
  if (!uid) {
    res.status(400).json({ error: 'UID requis' });
    return;
  }
  if (uid === authReq.uid) {
    res.status(400).json({ error: 'Impossible de se bannir soi-même' });
    return;
  }
  const expiresAt =
    typeof durationHours === 'number' && durationHours > 0 ? Date.now() + durationHours * 3600000 : undefined;
  await banUser(uid, reason, authReq.uid!, expiresAt);
  await clearBanCache(uid);
  const io: Server = req.app.get('io');
  if (io) io.to(`user:${uid}`).emit('account:banned', { reason: reason || null, expiresAt: expiresAt ?? null });
  await logAdminAction(authReq.uid!, 'user_ban', 'user', uid, reason || '');
  res.json({ success: true });
});

/* DELETE /admin/bans/:uid — débannir un utilisateur */
router.delete('/bans/:uid', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'owner'))) return;
  await unbanUser(req.params.uid);
  await clearBanCache(req.params.uid);
  await logAdminAction((req as AuthRequest).uid!, 'user_unban', 'user', req.params.uid);
  res.json({ success: true });
});

/* ── Bannissements d'adresses IP ── */

/* GET /admin/ip-bans — liste des IP bannies actives */
router.get('/ip-bans', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'owner'))) return;
  res.json(await getActiveIpBans(200));
});

/* POST /admin/ip-bans — bannir une adresse IP */
router.post('/ip-bans', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'owner'))) return;
  const authReq = req as AuthRequest;
  const { ip, reason, durationHours } = req.body as { ip?: string; reason?: string; durationHours?: number };
  if (!ip || isIP(ip) === 0) {
    res.status(400).json({ error: 'Adresse IP invalide' });
    return;
  }
  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.')) {
    res.status(400).json({ error: 'Impossible de bannir une adresse locale' });
    return;
  }
  const expiresAt =
    typeof durationHours === 'number' && durationHours > 0 ? Date.now() + durationHours * 3600000 : undefined;
  await banIp(ip, reason, authReq.uid!, expiresAt);
  await clearIpBanCache(ip);
  const io: Server = req.app.get('io');
  if (io) {
    for (const s of io.sockets.sockets.values()) {
      const sockIp = (s.handshake?.address || '').replace(/^::ffff:/, '');
      if (sockIp === ip) s.disconnect(true);
    }
  }
  await logAdminAction(authReq.uid!, 'ip_ban', 'ip', ip, reason || '');
  res.json({ success: true });
});

/* DELETE /admin/ip-bans/:id — débannir une adresse IP */
router.delete('/ip-bans/:id', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'owner'))) return;
  const authReq = req as AuthRequest;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'ID invalide' });
    return;
  }
  const row = await getOne<{ ip: string }>('SELECT ip FROM ip_bans WHERE id=?', [id]);
  await unbanIpById(id);
  if (row) await clearIpBanCache(row.ip);
  await logAdminAction(authReq.uid!, 'ip_unban', 'ip', row?.ip || String(id));
  res.json({ success: true });
});

/* ── Signalements ── */

/* GET /admin/reports — groupes signalés */
router.get('/reports', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const reports = await getReportedGroups();
  res.json(reports);
});

/* GET /admin/reports/users — signalements d'utilisateurs */
router.get('/reports/users', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const reports = await listUserReports(100);
  res.json(reports);
});

/* POST /admin/reports/users/:id/clear — clôturer un signalement utilisateur */
router.post('/reports/users/:id/clear', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'ID invalide' });
    return;
  }
  await clearUserReport(id);
  await logReportAction('user', String(id), 'cleared', (req as AuthRequest).uid!);
  res.json({ success: true });
});

/* GET /admin/reports/posts — signalements de posts */
router.get('/reports/posts', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const reports = await listPostReports(100);
  res.json(reports);
});

/* POST /admin/reports/posts/:id/clear — clôturer un signalement de post */
router.post('/reports/posts/:id/clear', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'ID invalide' });
    return;
  }
  await clearPostReport(id);
  await logReportAction('post', String(id), 'cleared', (req as AuthRequest).uid!);
  res.json({ success: true });
});

/* GET /admin/reports/history — historique des signalements traités */
router.get('/reports/history', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const history = await getReportActions(100);
  res.json(history);
});

/* POST /admin/groups/:gid/report/clear — lever le signalement d'un groupe */
router.post('/groups/:gid/report/clear', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  await clearGroupReport(req.params.gid);
  await logReportAction('group', req.params.gid, 'cleared', (req as AuthRequest).uid!);
  res.json({ success: true });
});

/* ── Groupes (modération) ── */

/* GET /admin/groups — tous les groupes */
router.get('/groups', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
  const q = (req.query.q as string) || undefined;
  const groups = await listAllGroups(limit, offset, q);
  res.json(groups);
});

/* GET /admin/groups/:gid — détail d'un groupe */
router.get('/groups/:gid', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const group = await getGroup(req.params.gid);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }
  res.json(group);
});

/* PUT /admin/groups/:gid — modifier un groupe */
router.put('/groups/:gid', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const allowed = ['name', 'description', 'icon', 'banner', 'privacy'];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }
  await updateGroup(req.params.gid, data);
  const io: Server = req.app.get('io');
  if (io) io.to(`group:${req.params.gid}`).emit('group:updated', { gid: req.params.gid, ...data });
  await logAdminAction(
    (req as AuthRequest).uid!,
    'group_update',
    'group',
    req.params.gid,
    Object.keys(data).join(', '),
  );
  res.json({ success: true });
});

/* PUT /admin/groups/:gid/members/:uid/role — changer le rôle d'un membre */
router.put('/groups/:gid/members/:uid/role', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const { role } = req.body as { role?: string };
  if (role === 'owner') {
    await setGroupMemberRole(req.params.gid, (req as AuthRequest).uid!, 'member');
    await setGroupMemberRole(req.params.gid, req.params.uid, 'owner');
  } else {
    await setGroupMemberRole(req.params.gid, req.params.uid, role || 'member');
  }
  const io: Server = req.app.get('io');
  if (io) {
    io.to(`group:${req.params.gid}`).emit('group:role:changed', { gid: req.params.gid, uid: req.params.uid, role });
  }
  res.json({ success: true });
});

/* DELETE /admin/groups/:gid/members/:uid — exclure un membre */
router.delete('/groups/:gid/members/:uid', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  await removeGroupMember(req.params.gid, req.params.uid);
  const io: Server = req.app.get('io');
  if (io) {
    io.to(`user:${req.params.uid}`).emit('group:member:removed', { gid: req.params.gid, kicked: true });
    io.to(`group:${req.params.gid}`).emit('group:member:removed', { gid: req.params.gid, uid: req.params.uid });
  }
  res.json({ success: true });
});

/* DELETE /admin/groups/:gid — supprimer un groupe (modération) */
router.delete('/groups/:gid', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const group = await getGroup(req.params.gid);
  await deleteGroup(req.params.gid);
  await logReportAction('group', req.params.gid, 'deleted', (req as AuthRequest).uid!);
  await logAdminAction((req as AuthRequest).uid!, 'group_delete', 'group', req.params.gid);
  const io: Server = req.app.get('io');
  if (io && group?.members) {
    for (const uid of Object.keys(group.members as Record<string, unknown>)) {
      io.to(`user:${uid}`).emit('group:deleted', { gid: req.params.gid });
    }
  }
  res.json({ success: true });
});

/* ── Modération du contenu ── */

/* GET /admin/posts — posts récents (modération) */
router.get('/posts', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));
  const authorUid = (req.query.uid as string) || undefined;
  const posts = await listRecentPosts(limit, authorUid);
  res.json(posts);
});

/* DELETE /admin/posts/:id — supprimer n'importe quel post */
router.delete('/posts/:id', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const deleted = await deletePostById(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Post introuvable' });
    return;
  }
  const io: Server = req.app.get('io');
  if (io) io.emit('post:deleted', { postId: req.params.id });
  await logReportAction('post', req.params.id, 'deleted', (req as AuthRequest).uid!);
  await logAdminAction((req as AuthRequest).uid!, 'post_delete', 'post', req.params.id);
  res.json({ success: true });
});

/* GET /admin/comments — commentaires récents (modération) */
router.get('/comments', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));
  const comments = await listRecentPostComments(limit);
  res.json(comments);
});

/* DELETE /admin/posts/comments/:id — supprimer n'importe quel commentaire */
router.delete('/posts/comments/:id', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'ID invalide' });
    return;
  }
  const deleted = await deletePostCommentById(id);
  if (!deleted) {
    res.status(404).json({ error: 'Commentaire introuvable' });
    return;
  }
  await logAdminAction((req as AuthRequest).uid!, 'comment_delete', 'comment', String(id));
  res.json({ success: true });
});

/* GET /admin/videos — vidéos récentes (modération) */
router.get('/videos', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));
  const videos = await listRecentVideos(limit);
  res.json(videos);
});

/* DELETE /admin/videos/:id — supprimer n'importe quelle vidéo */
router.delete('/videos/:id', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const deleted = await deleteVideoById(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Vidéo introuvable' });
    return;
  }
  await logAdminAction((req as AuthRequest).uid!, 'video_delete', 'video', req.params.id);
  res.json({ success: true });
});

/* ── Maintenance (owner) ── */

/* GET /admin/maintenance — statut maintenance */
router.get('/maintenance', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'moderator'))) return;
  const status = await getMaintenanceMode();
  res.json(status);
});

/* POST /admin/maintenance — activer/désactiver la maintenance (owner) */
router.post('/maintenance', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, 'owner'))) return;
  const { enabled, message } = req.body as { enabled: boolean; message?: string };
  await setMaintenanceMode(enabled, message);
  await logAdminAction(
    (req as AuthRequest).uid!,
    enabled ? 'maintenance_on' : 'maintenance_off',
    'system',
    undefined,
    message,
  );
  res.json({ success: true });
});

export default router;
