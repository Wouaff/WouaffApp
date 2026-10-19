import { Router } from 'express';
import { patchRouter } from '../middleware/asyncHandler.js';
import { authMiddleware } from '../middleware/auth.js';
import { getTrendingHashtags } from '../services/rtdb.js';
import { toInt } from '../utils/validation.js';

const router = patchRouter(Router());

router.get('/', authMiddleware, async (req, res) => {
  try {
    /* days=0 (défaut) = tout l'historique, sinon fenêtre glissante. */
    res.json(await getTrendingHashtags(toInt(req.query.days, 0, 0, 3650), toInt(req.query.limit, 10, 1, 50)));
  } catch (err) {
    console.error('[TRENDS] Error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
