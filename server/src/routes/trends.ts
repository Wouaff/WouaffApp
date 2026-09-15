import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getTrendingHashtags } from '../services/rtdb.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    /* days=0 (défaut) = tout l'historique, sinon fenêtre glissante. */
    const days = Number(req.query.days) || 0;
    const limit = Number(req.query.limit) || 10;
    const trends = await getTrendingHashtags(Math.min(Math.max(days, 0), 3650), Math.min(Math.max(limit, 1), 50));
    res.json(trends);
  } catch (err) {
    console.error('[TRENDS] Error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
