import type { Request, Response } from 'express';
import { Router } from 'express';
import { query } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';
import { getProfile, searchByWouaffId } from '../services/rtdb.js';
import type { AuthRequest } from '../types/index.js';

const router: Router = Router();
router.use(verifyToken);

/* GET /search/users?q=@pseudo — rechercher un utilisateur */
router.get('/users', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const q = ((req.query.q as string) || '').trim().toLowerCase();
  if (!q) {
    res.json({ results: [] });
    return;
  }
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const searchPattern = `%${q}%`;
  const rows = await query<Array<{ wouaffId: string; uid: string }>>(
    `SELECT wouaffId, uid FROM wouaff_id_index WHERE (wouaffId LIKE ? OR REPLACE(wouaffId, '@', '') LIKE ?) AND uid != ? LIMIT ?`,
    [searchPattern, searchPattern, authReq.uid!, limit],
  );
  const results: Array<{ uid: string; wouaffId: string; profile: Record<string, unknown> | null }> = [];
  for (const row of rows) {
    const displayId = row.wouaffId.startsWith('@') ? row.wouaffId : `@${row.wouaffId}`;
    const profile = await getProfile(row.uid);
    results.push({ uid: row.uid, wouaffId: displayId, profile });
  }
  res.json({ results });
});

/* GET /search/users/:wouaffId — recherche exacte par @ */
router.get('/users/:wouaffId', async (req: Request, res: Response) => {
  let wouaffId = req.params.wouaffId;
  if (!wouaffId.startsWith('@')) wouaffId = `@${wouaffId}`;
  const uid = await searchByWouaffId(wouaffId);
  if (!uid) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  const profile = await getProfile(uid);
  res.json({ uid, profile });
});

export default router;
