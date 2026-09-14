import { randomUUID } from 'node:crypto';
import type { Server as HTTPServer } from 'node:http';
import { parseCookie } from 'cookie';
import { Server } from 'socket.io';
import { getOne, query } from '../config/database.js';
import { isIpBannedCached, isUserBannedCached } from '../middleware/auth.js';
import {
  chatId,
  getReverseContactUids,
  isBlocked,
  isUserBanned,
  setUserOffline,
  setUserOnline,
} from '../services/rtdb.js';

interface AuthenticatedSocket {
  uid: string;
  roomsJoined: Set<string>;
  activeCalls: Set<string>;
}

interface CallPayload {
  from: string;
  to: string;
  sdp?: string;
  ice?: unknown;
  duration?: number;
}

const sockets = new Map<string, AuthenticatedSocket>();

async function broadcastStatusChange(io: Server, uid: string, status: string) {
  try {
    const contactUids = await getReverseContactUids(uid);
    for (const contactUid of contactUids) {
      io.to(`user:${contactUid}`).emit('status:changed', { uid, status });
    }
  } catch (err) {
    console.error('broadcastStatusChange error:', err);
  }
}

export function setupSocket(httpServer: HTTPServer, allowedOrigins: string[]): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      methods: ['GET', 'POST'],
    },
    connectionStateRecovery: { maxDisconnectionDuration: 120000 },
  });

  io.use(async (socket, next) => {
    let sessionId = socket.handshake.auth?.session_id as string | undefined;
    if (!sessionId && socket.handshake.headers.cookie) {
      const cookies = parseCookie(socket.handshake.headers.cookie);
      sessionId = cookies.session_id;
    }
    if (!sessionId) {
      return next(new Error('Session manquante'));
    }
    const sockIp = (socket.handshake.address || '').replace(/^::ffff:/, '');
    if (await isIpBannedCached(sockIp)) {
      return next(new Error('Adresse IP bannie'));
    }
    try {
      const session = await getOne<{ uid: string }>('SELECT uid FROM sessions WHERE sessionId = ?', [sessionId]);
      if (!session) return next(new Error('Session invalide'));
      if (await isUserBanned(session.uid)) return next(new Error('Compte banni'));
      (socket as unknown as AuthenticatedSocket).uid = session.uid;
      (socket as unknown as AuthenticatedSocket).roomsJoined = new Set();
      (socket as unknown as AuthenticatedSocket).activeCalls = new Set();
      next();
    } catch {
      next(new Error('Session invalide'));
    }
  });

  io.on('connection', async (socket) => {
    const authed = socket as unknown as AuthenticatedSocket;
    if (!authed.roomsJoined) {
      authed.roomsJoined = new Set();
    }
    const uid = authed.uid;
    sockets.set(socket.id, authed);

    socket.join(`user:${uid}`);

    /* Set user online on socket connect */
    await setUserOnline(uid).catch(() => {});
    await broadcastStatusChange(io, uid, 'online').catch(() => {});

    socket.on('join:dm', (otherUid: string) => {
      const cid = chatId(uid, otherUid);
      socket.join(`dm:${cid}`);
      authed.roomsJoined.add(`dm:${cid}`);
    });

    socket.on('join:group', async (gid: string) => {
      const member = await getOne<{ uid: string }>('SELECT uid FROM group_members WHERE gid=? AND uid=?', [gid, uid]);
      if (!member) return;
      socket.join(`group:${gid}`);
      authed.roomsJoined.add(`group:${gid}`);
    });

    socket.on('leave:dm', () => {
      for (const room of [...authed.roomsJoined]) {
        if (room.startsWith('dm:')) {
          socket.leave(room);
          authed.roomsJoined.delete(room);
        }
      }
    });

    socket.on('leave:group', () => {
      for (const room of [...authed.roomsJoined]) {
        if (room.startsWith('group:')) {
          socket.leave(room);
          authed.roomsJoined.delete(room);
        }
      }
    });

    socket.on('typing:dm', (otherUid: string, isTyping: boolean) => {
      const cid = chatId(uid, otherUid);
      socket.to(`dm:${cid}`).emit('typing', { from: uid, isTyping });
    });

    socket.on('typing:group', async (gid: string, isTyping: boolean) => {
      if (!authed.roomsJoined.has(`group:${gid}`)) return;
      socket.to(`group:${gid}`).emit('typing', { from: uid, isTyping });
    });

    socket.on('seen', (otherUid: string, msgKeys: string[]) => {
      const cid = chatId(uid, otherUid);
      socket.to(`dm:${cid}`).emit('seen', { by: uid, msgKeys });
    });

    /* ── Call signaling ── */

    async function guardCall(payload: unknown): Promise<{ from: string; to: string } | null> {
      if (await isUserBannedCached(uid)) {
        socket.disconnect(true);
        return null;
      }
      if (!payload || typeof payload !== 'object') return null;
      const target = (payload as { to?: unknown }).to;
      if (typeof target !== 'string' || target.length === 0 || target.length > 128 || target === uid) return null;
      if ((await isBlocked(uid, target)) || (await isBlocked(target, uid))) return null;
      return { from: uid, to: target };
    }

    socket.on('call:offer', async (payload: CallPayload) => {
      const call = await guardCall(payload);
      if (!call) return;
      authed.activeCalls.add(call.to);
      io.to(`user:${call.to}`).emit('call:incoming', { ...payload, from: uid });
    });

    socket.on('call:accept', async (payload: CallPayload) => {
      const call = await guardCall(payload);
      if (!call) return;
      io.to(`user:${call.to}`).emit('call:accepted', { ...payload, from: uid });
    });

    socket.on('call:answer', async (payload: CallPayload) => {
      const call = await guardCall(payload);
      if (!call) return;
      io.to(`user:${call.to}`).emit('call:answer', { ...payload, from: uid });
    });

    socket.on('call:ice-candidate', async (payload: CallPayload) => {
      const call = await guardCall(payload);
      if (!call) return;
      io.to(`user:${call.to}`).emit('call:ice-candidate', { ...payload, from: uid });
    });

    socket.on('call:end', async (payload: CallPayload) => {
      const call = await guardCall(payload);
      if (!call || !authed.activeCalls.has(call.to)) return;
      authed.activeCalls.delete(call.to);
      const rawDuration = (payload as { duration?: unknown }).duration;
      const duration =
        typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration >= 0
          ? Math.min(Math.floor(rawDuration), 24 * 60 * 60)
          : 0;
      io.to(`user:${call.to}`).emit('call:ended', { ...payload, from: uid });
      try {
        const startTime = Date.now() - duration * 1000;
        const callId = randomUUID();
        const endTime = Date.now();
        query(
          'INSERT INTO calls (id, callerUid, calleeUid, startTime, endTime, duration, status) VALUES (?,?,?,?,?,?,?)',
          [callId, uid, call.to, startTime, endTime, duration, 'completed'],
        );
      } catch {}
    });

    socket.on('call:reject', async (payload: CallPayload) => {
      const call = await guardCall(payload);
      if (!call) return;
      authed.activeCalls.delete(call.to);
      io.to(`user:${call.to}`).emit('call:rejected', { ...payload, from: uid });
    });

    socket.on('disconnect', async () => {
      sockets.delete(socket.id);
      /* Only set offline if no other sockets for this user (multi-tab support) */
      const hasOther = Array.from(sockets.values()).some((s) => s.uid === uid);
      if (!hasOther) {
        await setUserOffline(uid).catch(() => {});
        await broadcastStatusChange(io, uid, 'offline').catch(() => {});
      }
    });
  });

  return io;
}
