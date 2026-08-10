import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getOne, query } from '../config/database.js';
import { isUserBanned } from '../services/rtdb.js';
import type { AuthRequest } from '../types/index.js';

const sessionCache = new Map<string, { uid: string; expires: number }>();
const SESSION_CACHE_TTL = 30000;

const banCache = new Map<string, { banned: boolean; expires: number }>();
const BAN_CACHE_TTL = 15000;

async function isBanned(uid: string): Promise<boolean> {
  const cached = banCache.get(uid);
  if (cached && Date.now() < cached.expires) return cached.banned;
  const banned = await isUserBanned(uid);
  banCache.set(uid, { banned, expires: Date.now() + BAN_CACHE_TTL });
  return banned;
}

export async function clearBanCache(uid: string): Promise<void> {
  banCache.delete(uid);
}

function getCachedSession(sessionId: string): string | null {
  const entry = sessionCache.get(sessionId);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    sessionCache.delete(sessionId);
    return null;
  }
  return entry.uid;
}

function setCachedSession(sessionId: string, uid: string): void {
  sessionCache.set(sessionId, { uid, expires: Date.now() + SESSION_CACHE_TTL });
}

function removeCachedSession(sessionId: string): void {
  sessionCache.delete(sessionId);
}

export async function verifyToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionId = req.cookies?.session_id;
  if (!sessionId) {
    res.status(401).json({ error: 'Session manquante' });
    return;
  }
  const cached = getCachedSession(sessionId);
  if (cached) {
    if (await isBanned(cached)) {
      res.status(403).json({ error: 'Compte banni' });
      return;
    }
    (req as AuthRequest).uid = cached;
    next();
    return;
  }
  const session = await getOne<{ uid: string }>('SELECT uid FROM sessions WHERE sessionId = ?', [sessionId]);
  if (!session) {
    removeCachedSession(sessionId);
    res.clearCookie('session_id');
    res.status(401).json({ error: 'Session invalide' });
    return;
  }
  if (await isBanned(session.uid)) {
    res.status(403).json({ error: 'Compte banni' });
    return;
  }
  setCachedSession(sessionId, session.uid);
  (req as AuthRequest).uid = session.uid;
  next();
}

export async function createSession(
  uid: string,
  opts: { ip?: string; userAgent?: string } = {},
): Promise<{ sessionId: string }> {
  const sessionId = randomUUID().replace(/-/g, '');
  const ip = opts.ip || null;
  const userAgent = opts.userAgent || null;
  await query('INSERT INTO sessions (sessionId, uid, createdAt, ip, userAgent) VALUES (?,?,?,?,?)', [
    sessionId,
    uid,
    Date.now(),
    ip,
    userAgent,
  ]);
  await query('INSERT INTO login_history (uid, ip, userAgent, createdAt) VALUES (?,?,?,?)', [
    uid,
    ip,
    userAgent,
    Date.now(),
  ]);
  setCachedSession(sessionId, uid);
  return { sessionId };
}

export async function destroySession(sessionId: string): Promise<void> {
  await query('DELETE FROM sessions WHERE sessionId = ?', [sessionId]);
  removeCachedSession(sessionId);
}
