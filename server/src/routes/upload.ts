import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
/* Source unique du dossier d'uploads : index.ts l'importe pour le servir. */
export const uploadsDir = resolve(__dirname, '../../uploads');

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

/* L'extension vient du type MIME vérifié, jamais du nom de fichier fourni par le client. */
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${randomBytes(6).toString('hex')}.${EXT_BY_MIME[file.mimetype] ?? 'bin'}`);
  },
});

const MAX_SIZE = 30 * 1024 * 1024; // 30 Mo

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (EXT_BY_MIME[file.mimetype]) cb(null, true);
    else cb(new Error('Type de fichier non supporté (images : jpg/png/gif/webp, vidéos : mp4/webm/ogg/mov)'));
  },
});

const router = Router();

router.post(
  '/',
  authMiddleware,
  rateLimit({ windowMs: 10 * 60 * 1000, max: 40, message: "Trop d'envois, réessaie plus tard" }),
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (!err) return next();
      const tooBig = (err as { code?: string }).code === 'LIMIT_FILE_SIZE';
      res.status(400).json({ error: tooBig ? 'Fichier trop volumineux (30 Mo max)' : (err as Error).message });
    });
  },
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    const type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    res.json({ url: `/uploads/${req.file.filename}`, type });
  },
);

export default router;
