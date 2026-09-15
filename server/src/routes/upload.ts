import { Router } from 'express';
import multer from 'multer';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import { authMiddleware } from '../middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsDir = resolve(__dirname, '../../uploads');

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop() || 'bin';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    cb(null, name);
  },
});

const ALLOWED_IMAGE = /^image\/(jpeg|png|gif|webp)$/;
const ALLOWED_VIDEO = /^video\/(mp4|webm|ogg|quicktime)$/;
const MAX_SIZE = 30 * 1024 * 1024; // 30 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE.test(file.mimetype) || ALLOWED_VIDEO.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté (images: jpg/png/gif/webp, vidéos: mp4/webm/ogg)'));
    }
  },
});

const router = Router();

router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    const url = `/uploads/${req.file.filename}`;
    const type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    res.json({ url, type });
  } catch (err) {
    console.error('[UPLOAD] Error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

export default router;
