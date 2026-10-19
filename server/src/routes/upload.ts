import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { patchRouter } from '../middleware/asyncHandler.js';
import { authMiddleware } from '../middleware/auth.js';
import { byUser, rateLimit } from '../middleware/rateLimit.js';
import { finalizeUpload, type UploadKind, uploadsDir } from '../services/uploads.js';

/* index.ts importait déjà `uploadsDir` d'ici : on le ré-exporte. */
export { uploadsDir };

/* Extension provisoire d'après le type MIME déclaré par le navigateur. Le contenu réel est contrôlé
   ensuite par finalizeUpload (premiers octets), qui fixe l'extension définitive. */
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

const router = patchRouter(Router());

router.post(
  '/',
  authMiddleware,
  rateLimit({ windowMs: 10 * 60 * 1000, max: 40, message: "Trop d'envois, réessaie plus tard", key: byUser }),
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (!err) return next();
      const tooBig = (err as { code?: string }).code === 'LIMIT_FILE_SIZE';
      res.status(400).json({ error: tooBig ? 'Fichier trop volumineux (30 Mo max)' : (err as Error).message });
    });
  },
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    /* ?kind=avatar|banner : redimensionnement adapté à l'usage (par défaut : image de post). */
    const kind: UploadKind = req.query.kind === 'avatar' || req.query.kind === 'banner' ? req.query.kind : 'post';
    const result = await finalizeUpload(req.file.path, kind);
    if (!result) {
      return res.status(400).json({ error: "Ce fichier n'est pas une image ou une vidéo valide" });
    }
    res.json({ url: `/uploads/${result.filename}`, type: result.type });
  },
);

export default router;
