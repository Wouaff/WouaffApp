import { randomUUID } from 'node:crypto';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = resolve(__dirname, '../uploads');
const VIDEOS_DIR = resolve(UPLOADS_DIR, 'videos');
const THUMBS_DIR = resolve(UPLOADS_DIR, 'thumbnails');
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const UPLOADS_ROOT = resolve(UPLOADS_DIR, '..');

function safeUploadPath(relativePath: string): string | null {
  const full = resolve(UPLOADS_ROOT, relativePath);
  if (full !== UPLOADS_ROOT && !full.startsWith(UPLOADS_ROOT + sep)) return null;
  return full;
}

const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export async function initVideoStorage(): Promise<void> {
  await mkdir(VIDEOS_DIR, { recursive: true });
  await mkdir(THUMBS_DIR, { recursive: true });
}

export interface StoredVideo {
  id: string;
  videoPath: string;
  thumbnailPath?: string;
}

export async function storeVideo(buffer: Buffer, mimeType: string): Promise<StoredVideo> {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error('Type de fichier non supporté. Utilisez MP4, WebM ou MOV.');
  }
  if (buffer.length > MAX_VIDEO_SIZE) {
    throw new Error('Fichier trop volumineux (max 100 Mo)');
  }
  const id = randomUUID().replace(/-/g, '');
  const ext = mimeType === 'video/quicktime' ? '.mov' : mimeType === 'video/webm' ? '.webm' : '.mp4';
  const filename = `${id}${ext}`;
  const filePath = resolve(VIDEOS_DIR, filename);
  await writeFile(filePath, buffer);
  const relativePath = `uploads/videos/${filename}`;
  return { id, videoPath: relativePath };
}

export async function storeThumbnail(buffer: Buffer): Promise<string> {
  const filename = `${randomUUID().replace(/-/g, '')}.jpg`;
  const filePath = resolve(THUMBS_DIR, filename);
  await writeFile(filePath, buffer);
  return `uploads/thumbnails/${filename}`;
}

export async function deleteVideoFiles(videoPath: string, thumbnailPath?: string): Promise<void> {
  const fullPath = safeUploadPath(videoPath);
  if (!fullPath) return;
  try {
    await unlink(fullPath);
  } catch {}
  if (thumbnailPath) {
    const thumbPath = safeUploadPath(thumbnailPath);
    if (thumbPath) {
      try {
        await unlink(thumbPath);
      } catch {}
    }
  }
}

export async function cleanupOrphanedVideos(validPaths: Set<string>): Promise<void> {
  try {
    const files = await readdir(VIDEOS_DIR);
    for (const file of files) {
      const relPath = `uploads/videos/${file}`;
      if (!validPaths.has(relPath)) {
        try {
          await unlink(resolve(VIDEOS_DIR, file));
        } catch {}
      }
    }
  } catch {}
}

export function getVideoUrl(videoPath: string): string {
  return `/${videoPath}`;
}
