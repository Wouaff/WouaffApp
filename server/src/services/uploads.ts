import { existsSync, mkdirSync } from 'node:fs';
import { open, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOne, query } from '../config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* Source unique du dossier d'uploads (écrit par /api/upload, servi par /uploads). */
export const uploadsDir = resolve(__dirname, '../../uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

/* Nom de fichier d'un chemin `/uploads/xxx`, ou null si le chemin n'est pas sûr. */
export function uploadFileName(urlPath: string | null | undefined): string | null {
  if (typeof urlPath !== 'string') return null;
  const match = /^\/uploads\/([A-Za-z0-9._-]+)$/.exec(urlPath);
  if (!match || match[1].startsWith('.') || match[1].includes('..')) return null;
  return match[1];
}

export function uploadExists(urlPath: string | null | undefined): boolean {
  const name = uploadFileName(urlPath);
  return !!name && existsSync(resolve(uploadsDir, name));
}

/* ── Vérification du contenu réel ───────────────────────────────────────────── */

export interface DetectedMedia {
  ext: string;
  type: 'image' | 'video';
}

/* Brands « ftyp » qui sont des images ou de l'audio, pas des vidéos lisibles. */
const NOT_VIDEO_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'avif', 'avis', 'M4A ', 'M4B ']);

/* Le type MIME envoyé par le navigateur est déclaratif : on reconnaît le fichier à ses premiers octets. */
export function sniffMedia(head: Buffer): DetectedMedia | null {
  if (head.length < 12) return null;
  const at = (sig: number[], offset = 0) => sig.every((b, i) => head[offset + i] === b);
  const text = (start: number, end: number) => head.toString('latin1', start, end);
  if (at([0xff, 0xd8, 0xff])) return { ext: 'jpg', type: 'image' };
  if (at([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: 'png', type: 'image' };
  if (text(0, 6) === 'GIF87a' || text(0, 6) === 'GIF89a') return { ext: 'gif', type: 'image' };
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return { ext: 'webp', type: 'image' };
  if (text(4, 8) === 'ftyp') {
    const brand = text(8, 12);
    if (NOT_VIDEO_BRANDS.has(brand)) return null;
    return { ext: brand === 'qt  ' ? 'mov' : 'mp4', type: 'video' };
  }
  if (at([0x1a, 0x45, 0xdf, 0xa3])) return { ext: 'webm', type: 'video' };
  if (text(0, 4) === 'OggS') return { ext: 'ogv', type: 'video' };
  return null;
}

/* ── Retrait des métadonnées (EXIF : position GPS, appareil, date…) ─────────── */

interface SharpInstance {
  metadata(): Promise<{ pages?: number }>;
  rotate(): SharpInstance;
  resize(options: Record<string, unknown>): SharpInstance;
  toBuffer(): Promise<Buffer>;
}
type SharpFactory = (input: string, options?: Record<string, unknown>) => SharpInstance;

let sharpLoader: Promise<SharpFactory | null> | undefined;

function loadSharp(): Promise<SharpFactory | null> {
  if (!sharpLoader) {
    const name = 'sharp';
    sharpLoader = import(name)
      .then((mod) => (mod.default ?? mod) as SharpFactory)
      .catch(() => {
        console.warn(
          "[UPLOAD] Le module « sharp » n'est pas installé : les métadonnées EXIF (position GPS…) ne sont PAS retirées des images. Lance « npm --prefix server install ».",
        );
        return null;
      });
  }
  return sharpLoader;
}

/* Réorientation selon l'EXIF puis ré-encodage sans métadonnées. Faux = image illisible ou corrompue. */
async function stripImageMetadata(path: string, ext: string): Promise<boolean> {
  const sharp = await loadSharp();
  if (!sharp) return true;
  try {
    if (ext === 'webp' && ((await sharp(path).metadata()).pages ?? 1) > 1) return true; // WebP animé : laissé tel quel
    const out = await sharp(path, { limitInputPixels: 80_000_000 })
      .rotate()
      .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
      .toBuffer();
    await writeFile(path, out);
    return true;
  } catch {
    return false;
  }
}

/* Contrôle un fichier fraîchement reçu : type réel, extension cohérente, métadonnées retirées.
   Renvoie null (et supprime le fichier) s'il n'est pas un média valide. */
export async function finalizeUpload(filePath: string): Promise<{ filename: string; type: 'image' | 'video' } | null> {
  let detected: DetectedMedia | null = null;
  try {
    const handle = await open(filePath, 'r');
    try {
      const head = Buffer.alloc(32);
      const { bytesRead } = await handle.read(head, 0, 32, 0);
      detected = sniffMedia(head.subarray(0, bytesRead));
    } finally {
      await handle.close();
    }
  } catch {
    detected = null;
  }
  if (!detected) {
    await unlink(filePath).catch(() => {});
    return null;
  }

  let finalPath = filePath;
  const currentExt = extname(filePath).slice(1);
  if (currentExt !== detected.ext) {
    finalPath = `${filePath.slice(0, filePath.length - currentExt.length)}${detected.ext}`;
    await rename(filePath, finalPath);
  }
  if (detected.type === 'image' && ['jpg', 'png', 'webp'].includes(detected.ext)) {
    if (!(await stripImageMetadata(finalPath, detected.ext))) {
      await unlink(finalPath).catch(() => {});
      return null;
    }
  }
  return { filename: basename(finalPath), type: detected.type };
}

/* ── Suppression des fichiers devenus inutiles (RGPD : droit à l'effacement) ── */

/* Supprime du disque les fichiers qui ne sont plus référencés par aucun post ni profil. */
export async function removeUploadsIfUnreferenced(urlPaths: Array<string | null | undefined>): Promise<void> {
  for (const urlPath of new Set(urlPaths)) {
    const name = uploadFileName(urlPath);
    if (!name || !urlPath) continue;
    try {
      const row = await getOne<{ n: number }>(
        `SELECT (SELECT COUNT(*) FROM posts WHERE image = ? OR video = ?)
              + (SELECT COUNT(*) FROM users WHERE avatar = ? OR banner = ?) AS n`,
        [urlPath, urlPath, urlPath, urlPath],
      );
      if ((row?.n ?? 0) === 0) await unlink(resolve(uploadsDir, name));
    } catch (err) {
      if ((err as { code?: string }).code !== 'ENOENT') {
        console.warn('[UPLOAD] Suppression impossible :', (err as Error).message);
      }
    }
  }
}

/* Fichiers créés par cette application (Date.now()-hex.ext) : les autres ne sont jamais touchés. */
const OWN_FILE_RE = /^\d{13}-[0-9a-f]{12}\.(?:jpg|png|gif|webp|mp4|webm|ogv|mov)$/;

/* Balayage des fichiers envoyés mais jamais rattachés à un post ou un profil (publication abandonnée,
   échec réseau…). Les fichiers de moins de `minAgeMs` sont épargnés (envoi en cours). */
export async function sweepOrphanUploads(minAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
  const [posts, users] = await Promise.all([
    query<{ image: string | null; video: string | null }[]>(
      'SELECT image, video FROM posts WHERE image IS NOT NULL OR video IS NOT NULL',
    ),
    query<{ avatar: string | null; banner: string | null }[]>(
      'SELECT avatar, banner FROM users WHERE avatar IS NOT NULL OR banner IS NOT NULL',
    ),
  ]);
  const referenced = new Set<string>();
  for (const p of posts) for (const v of [p.image, p.video]) if (uploadFileName(v)) referenced.add(uploadFileName(v)!);
  for (const u of users)
    for (const v of [u.avatar, u.banner]) if (uploadFileName(v)) referenced.add(uploadFileName(v)!);

  const cutoff = Date.now() - minAgeMs;
  let removed = 0;
  for (const name of await readdir(uploadsDir)) {
    if (!OWN_FILE_RE.test(name) || referenced.has(name)) continue;
    try {
      const full = resolve(uploadsDir, name);
      const info = await stat(full);
      if (!info.isFile() || info.mtimeMs > cutoff) continue;
      await unlink(full);
      removed++;
    } catch {
      /* fichier déjà parti ou verrouillé : au prochain passage */
    }
  }
  return removed;
}
