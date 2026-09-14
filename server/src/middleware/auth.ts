import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getOne, query } from '../config/database.js';
import { isIpBanned as isIpBannedService, isUserBanned } from '../services/rtdb.js';
import type { AuthRequest } from '../types/index.js';
import { getClientIp } from '../utils/clientIp.js';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const CACHE_MAX_ENTRIES = 10000;

interface SessionCacheEntry {
  uid: string;
  sessionExpiresAt: number;
  userAgent: string | null;
  expires: number;
}

const sessionCache = new Map<string, SessionCacheEntry>();
const SESSION_CACHE_TTL = 30000;

const banCache = new Map<string, { banned: boolean; expires: number }>();
const BAN_CACHE_TTL = 15000;

const ipBanCache = new Map<string, { banned: boolean; expires: number }>();
const IP_BAN_CACHE_TTL = 15000;

function setBounded<K, V>(map: Map<K, V>, key: K, value: V): void {
  if (map.size >= CACHE_MAX_ENTRIES && !map.has(key)) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}

function pruneCache<K, V extends { expires: number }>(map: Map<K, V>): void {
  const now = Date.now();
  for (const [key, entry] of map) {
    if (entry.expires < now) map.delete(key);
  }
}

setInterval(() => {
  pruneCache(sessionCache);
  pruneCache(banCache);
  pruneCache(ipBanCache);
}, 60000).unref();

export async function isIpBannedCached(ip: string): Promise<boolean> {
  if (!ip) return false;
  const cached = ipBanCache.get(ip);
  if (cached && Date.now() < cached.expires) return cached.banned;
  const banned = await isIpBannedService(ip);
  setBounded(ipBanCache, ip, { banned, expires: Date.now() + IP_BAN_CACHE_TTL });
  return banned;
}

export function clearIpBanCache(ip: string): void {
  ipBanCache.delete(ip);
}

export async function checkIpBan(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = getClientIp(req);
  if (await isIpBannedCached(ip)) {
    res.status(403).json({ error: 'Adresse IP bannie' });
    return;
  }
  next();
}

async function isBanned(uid: string): Promise<boolean> {
  const cached = banCache.get(uid);
  if (cached && Date.now() < cached.expires) return cached.banned;
  const banned = await isUserBanned(uid);
  setBounded(banCache, uid, { banned, expires: Date.now() + BAN_CACHE_TTL });
  return banned;
}

export async function isUserBannedCached(uid: string): Promise<boolean> {
  return isBanned(uid);
}

export async function clearBanCache(uid: string): Promise<void> {
  banCache.delete(uid);
}

function getCachedSession(sessionId: string): SessionCacheEntry | null {
  const entry = sessionCache.get(sessionId);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    sessionCache.delete(sessionId);
    return null;
  }
  return entry;
}

function setCachedSession(sessionId: string, uid: string, sessionExpiresAt: number, userAgent: string | null): void {
  setBounded(sessionCache, sessionId, {
    uid,
    sessionExpiresAt,
    userAgent,
    expires: Date.now() + SESSION_CACHE_TTL,
  });
}

function removeCachedSession(sessionId: string): void {
  sessionCache.delete(sessionId);
}

export function clearCachedSessionsForUid(uid: string): void {
  for (const [sessionId, entry] of sessionCache) {
    if (entry.uid === uid) sessionCache.delete(sessionId);
  }
}

export function clearAllCachedSessions(): void {
  sessionCache.clear();
}

function denySession(res: Response, sessionId: string, error: string): void {
  removeCachedSession(sessionId);
  res.clearCookie('session_id');
  res.status(401).json({ error });
}

function sessionMatchesRequest(stored: string | null, req: Request): boolean {
  if (!stored) return true;
  const current = req.headers['user-agent'] || null;
  return !current || current === stored;
}

export async function verifyToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionId = req.cookies?.session_id;
  if (!sessionId) {
    res.status(401).json({ error: 'Session manquante' });
    return;
  }
  const cached = getCachedSession(sessionId);
  if (cached) {
    if (cached.sessionExpiresAt > 0 && cached.sessionExpiresAt < Date.now()) {
      denySession(res, sessionId, 'Session expirée');
      void query('DELETE FROM sessions WHERE sessionId = ?', [sessionId]).catch(() => {});
      return;
    }
    if (!sessionMatchesRequest(cached.userAgent, req)) {
      denySession(res, sessionId, 'Session invalide');
      void query('DELETE FROM sessions WHERE sessionId = ?', [sessionId]).catch(() => {});
      return;
    }
    if (await isBanned(cached.uid)) {
      res.status(403).json({ error: 'Compte banni' });
      return;
    }
    (req as AuthRequest).uid = cached.uid;
    next();
    return;
  }
  const session = await getOne<{
    uid: string;
    expiresAt: number | null;
    userExists: number;
    userAgent: string | null;
  }>(
    'SELECT s.uid, s.expiresAt, s.userAgent, (u.uid IS NOT NULL) AS userExists FROM sessions s LEFT JOIN users u ON u.uid = s.uid WHERE s.sessionId = ?',
    [sessionId],
  );
  if (!session?.userExists) {
    denySession(res, sessionId, 'Session invalide');
    void query('DELETE FROM sessions WHERE sessionId = ?', [sessionId]).catch(() => {});
    return;
  }
  if (session.expiresAt && session.expiresAt < Date.now()) {
    denySession(res, sessionId, 'Session expirée');
    void query('DELETE FROM sessions WHERE sessionId = ?', [sessionId]).catch(() => {});
    return;
  }
  if (!sessionMatchesRequest(session.userAgent, req)) {
    denySession(res, sessionId, 'Session invalide');
    void query('DELETE FROM sessions WHERE sessionId = ?', [sessionId]).catch(() => {});
    return;
  }
  if (await isBanned(session.uid)) {
    res.status(403).json({ error: 'Compte banni' });
    return;
  }
  setCachedSession(sessionId, session.uid, session.expiresAt || 0, session.userAgent);
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
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await query('INSERT INTO sessions (sessionId, uid, createdAt, expiresAt, ip, userAgent) VALUES (?,?,?,?,?,?)', [
    sessionId,
    uid,
    Date.now(),
    expiresAt,
    ip,
    userAgent,
  ]);
  await query('INSERT INTO login_history (uid, ip, userAgent, createdAt) VALUES (?,?,?,?)', [
    uid,
    ip,
    userAgent,
    Date.now(),
  ]);
  setCachedSession(sessionId, uid, expiresAt, userAgent);
  return { sessionId };
}

export async function destroySession(sessionId: string): Promise<void> {
  await query('DELETE FROM sessions WHERE sessionId = ?', [sessionId]);
  removeCachedSession(sessionId);
}

export async function getSessionUid(req: Request): Promise<string | null> {
  const sessionId = req.cookies?.session_id;
  if (!sessionId) return null;
  const cached = getCachedSession(sessionId);
  if (cached) return cached.uid;
  const session = await getOne<{ uid: string; expiresAt: number | null }>(
    'SELECT uid, expiresAt FROM sessions WHERE sessionId = ?',
    [sessionId],
  );
  if (!session) return null;
  if (session.expiresAt && session.expiresAt < Date.now()) return null;
  return session.uid;
}

export async function purgeExpiredSessions(): Promise<void> {
  await query('DELETE FROM sessions WHERE expiresAt IS NOT NULL AND expiresAt < ?', [Date.now()]);
}
