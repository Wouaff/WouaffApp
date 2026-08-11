import { randomUUID } from 'node:crypto';
import type { Server as HTTPServer } from 'node:http';
import { parseCookie } from 'cookie';
import { Server } from 'socket.io';
import { getOne, query } from '../config/database.js';
import { isColdStorageEnabled, saveCallRecord } from '../services/coldStorage.js';
import { chatId, getReverseContactUids, isUserBanned, setUserOffline, setUserOnline } from '../services/rtdb.js';

interface AuthenticatedSocket {
  uid: string;
  roomsJoined: Set<string>;
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

export function setupSocket(httpServer: HTTPServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
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
    try {
      const session = await getOne<{ uid: string }>('SELECT uid FROM sessions WHERE sessionId = ?', [sessionId]);
      if (!session) return next(new Error('Session invalide'));
      if (await isUserBanned(session.uid)) return next(new Error('Compte banni'));
      (socket as unknown as AuthenticatedSocket).uid = session.uid;
      (socket as unknown as AuthenticatedSocket).roomsJoined = new Set();
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

    socket.on('call:offer', (payload: CallPayload) => {
      payload.from = uid;
      io.to(`user:${payload.to}`).emit('call:incoming', payload);
    });

    socket.on('call:accept', (payload: CallPayload) => {
      payload.from = uid;
      io.to(`user:${payload.to}`).emit('call:accepted', payload);
    });

    socket.on('call:answer', (payload: CallPayload) => {
      payload.from = uid;
      io.to(`user:${payload.to}`).emit('call:answer', payload);
    });

    socket.on('call:ice-candidate', (payload: CallPayload) => {
      payload.from = uid;
      io.to(`user:${payload.to}`).emit('call:ice-candidate', payload);
    });

    socket.on('call:end', (payload: CallPayload) => {
      payload.from = uid;
      io.to(`user:${payload.to}`).emit('call:ended', payload);
      try {
        const startTime = Date.now() - (payload.duration || 0);
        const callId = randomUUID();
        const caller = uid;
        const callee = payload.to;
        const endTime = Date.now();
        const dur = payload.duration || 0;
        query(
          'INSERT INTO calls (id, callerUid, calleeUid, startTime, endTime, duration, status) VALUES (?,?,?,?,?,?,?)',
          [callId, caller, callee, startTime, endTime, dur, 'completed'],
        );
        if (isColdStorageEnabled()) {
          saveCallRecord(callId, caller, callee, startTime, endTime, dur, 'completed');
        }
      } catch {}
    });

    socket.on('call:reject', (payload: CallPayload) => {
      payload.from = uid;
      io.to(`user:${payload.to}`).emit('call:rejected', payload);
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
