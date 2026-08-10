import type { Request, Response } from 'express';
import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
  addBadgeToUser,
  deleteUserProfile,
  getAdminLogs,
  getAdminStats,
  getAllStaff,
  getBadges,
  getLoginHistory,
  getMaintenanceMode,
  getProfile,
  getRecentUsers,
  getReportedGroups,
  isStaff,
  logAdminAction,
  migrateWouaffIds,
  resetUserWouaffId,
  seedBadges,
  setMaintenanceMode,
  setStaff,
  setUserBadges,
  updateProfileByAdmin,
} from '../services/rtdb.js';
import type { AuthRequest } from '../types/index.js';

const router: Router = Router();
router.use(verifyToken);

async function requireStaff(req: Request, res: Response): Promise<boolean> {
  const authReq = req as AuthRequest;
  const staff = await isStaff(authReq.uid!);
  if (!staff) {
    res.status(403).json({ error: 'Accès réservé au staff' });
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
  await setStaff(authReq.uid!, true);
  res.json({ success: true, message: 'Vous êtes maintenant staff' });
});

/* GET /admin/staff — liste du staff */
router.get('/staff', async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return;
  const staff = await getAllStaff();
  const result: Record<string, unknown> = {};
  for (const uid of Object.keys(staff)) {
    const profile = await getProfile(uid);
    if (profile) result[uid] = profile;
  }
  res.json(result);
});

/* POST /admin/staff/:uid — ajouter un membre au staff */
router.post('/staff/:uid', async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return;
  await setStaff(req.params.uid, true);
  await logAdminAction((req as AuthRequest).uid!, 'staff_add', 'user', req.params.uid);
  res.json({ success: true });
});

/* DELETE /admin/staff/:uid — retirer du staff */
router.delete('/staff/:uid', async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return;
  await setStaff(req.params.uid, false);
  await logAdminAction((req as AuthRequest).uid!, 'staff_remove', 'user', req.params.uid);
  res.json({ success: true });
});

/* GET /admin/stats — statistiques */
router.get('/stats', async (_req: Request, res: Response) => {
  if (!(await requireStaff(_req, res))) return;
  const stats = await getAdminStats();
  res.json(stats);
});

/* GET /admin/users/recent — derniers utilisateurs inscrits */
router.get('/users/recent', async (_req: Request, res: Response) => {
  if (!(await requireStaff(_req, res))) return;
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
  if (!(await requireStaff(req, res))) return;
  const result = await seedBadges();
  res.json(result);
});

/* PUT /admin/badges/:uid — remplacer tous les badges d'un utilisateur */
router.put('/badges/:uid', async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return;
  const { badgeIds } = req.body as { badgeIds: string[] };
  await setUserBadges(req.params.uid, badgeIds || []);
  res.json({ success: true });
});

/* POST /admin/badges/:uid/add/:badgeId — ajouter un badge à un utilisateur */
router.post('/badges/:uid/add/:badgeId', async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return;
  await addBadgeToUser(req.params.uid, req.params.badgeId);
  res.json({ success: true });
});

/* PUT /admin/profile/:uid — modifier le profil d'un utilisateur */
router.put('/profile/:uid', async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return;
  await updateProfileByAdmin(req.params.uid, req.body);
  res.json({ success: true });
});

/* POST /admin/profile/:uid/reset-wouaffid — réinitialiser le wouaffId */
router.post('/profile/:uid/reset-wouaffid', async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return;
  await resetUserWouaffId(req.params.uid);
  res.json({ success: true });
});

/* DELETE /admin/profile/:uid — supprimer un compte utilisateur */
router.delete('/profile/:uid', async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return;
  await deleteUserProfile(req.params.uid);
  res.json({ success: true });
});

/* POST /admin/migrate/wouaffids — indexer tous les wouaffIds existants */
router.post('/migrate/wouaffids', async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return;
  const result = await migrateWouaffIds();
  await logAdminAction((req as AuthRequest).uid!, 'migrate_wouaff_ids', 'system', undefined, `${result.migrated} IDs`);
  res.json(result);
});

/* GET /admin/logs — activité récente du staff */
router.get('/logs', async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return;
  const logs = await getAdminLogs(100);
  res.json(logs);
});

/* GET /admin/login-history/:uid — historique des connexions d'un utilisateur */
router.get('/login-history/:uid', async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return;
  const history = await getLoginHistory(req.params.uid, 100);
  res.json(history);
});

/* POST /admin/log-action — logger une action depuis le frontend */
router.post('/log-action', async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return;
  const { action, targetType, targetId, details } = req.body as {
    action: string;
    targetType?: string;
    targetId?: string;
    details?: string;
  };
  await logAdminAction((req as AuthRequest).uid!, action, targetType, targetId, details);
  res.json({ success: true });
});

/* GET /admin/reports — groupes signalés */
router.get('/reports', async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return;
  const reports = await getReportedGroups();
  res.json(reports);
});

/* GET /admin/maintenance — statut maintenance */
router.get('/maintenance', async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return;
  const status = await getMaintenanceMode();
  res.json(status);
});

/* POST /admin/maintenance — activer/désactiver la maintenance */
router.post('/maintenance', async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return;
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
