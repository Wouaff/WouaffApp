import type { Request, Response } from 'express';
import { Router } from 'express';
import { getOne, query } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';
import {
  chatId,
  getGroupMessageBlob,
  getGroupMessages,
  getMessageBlob,
  getMessages,
  markMessagesAsSeen,
  pushGroupMessage,
  pushMessage,
  searchGroupMessages,
  searchMessages,
  updateGroupMessage,
  updateMessage,
} from '../services/rtdb.js';
import type { AuthRequest, MessageData } from '../types/index.js';

const MSG_COLS =
  'msgKey, fromUid, text, type, time, seen, encrypted, ct, iv, fileName, duration, pendingFrom, senderName, replyTo, messageTheme, forwardedFrom, ephemeralDuration, pinned, reactions, id';
const MSG_GROUP_COLS =
  'msgKey, fromUid, text, type, time, deleted, edited, encrypted, ct, iv, fileName, duration, senderName, replyTo, messageTheme, forwardedFrom, seenBy, ephemeralDuration, pinned, id';

const router: Router = Router();
router.use(verifyToken);

async function isBlocked(uid: string, byUid: string): Promise<boolean> {
  const row = await getOne<{ blockedUid: string }>('SELECT blockedUid FROM blocks WHERE uid=? AND blockedUid=?', [
    byUid,
    uid,
  ]);
  return !!row;
}

async function requireGroupMember(req: Request, res: Response): Promise<boolean> {
  const authReq = req as AuthRequest;
  const member = await getOne<{ uid: string }>('SELECT uid FROM group_members WHERE gid=? AND uid=?', [
    req.params.gid,
    authReq.uid!,
  ]);
  if (member) return true;
  res.status(403).json({ error: 'Vous ne faites pas partie de ce groupe' });
  return false;
}

/* Vérifie que l'uid est l'auteur du message (table + colonne id passées en littéraux sûrs). */
async function isMessageOwner(
  table: 'messages' | 'group_messages',
  idCol: 'convId' | 'gid',
  id: string,
  msgKey: string,
  uid: string,
): Promise<boolean> {
  const row = await getOne<{ fromUid: string }>(`SELECT fromUid FROM ${table} WHERE ${idCol}=? AND msgKey=?`, [
    id,
    msgKey,
  ]);
  return !!row && row.fromUid === uid;
}

async function isGroupAdmin(gid: string, uid: string): Promise<boolean> {
  const row = await getOne<{ role: string }>('SELECT role FROM group_members WHERE gid=? AND uid=?', [gid, uid]);
  return !!row && (row.role === 'owner' || row.role === 'admin');
}

/* GET /messages/:uid — messages d'une conversation DM */
router.get('/:uid', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const cid = chatId(authReq.uid!, req.params.uid);
  const limit = req.query.limit ? Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 100) : undefined;
  const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;
  const result = await getMessages(cid, limit, before);
  res.json(result);
});

/* GET /messages/group/:gid — messages d'un groupe */
router.get('/group/:gid', async (req: Request, res: Response) => {
  if (!(await requireGroupMember(req, res))) return;
  const limit = req.query.limit ? Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 100) : undefined;
  const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;
  const result = await getGroupMessages(req.params.gid, limit, before);
  res.json(result);
});

/* POST /messages/:uid — envoyer un message DM */
router.post('/:uid', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const targetUid = req.params.uid;

  /* Block enforcement: check if target has blocked sender, or sender has blocked target */
  const blockedByTarget = await isBlocked(authReq.uid!, targetUid);
  if (blockedByTarget) {
    res.status(403).json({ error: 'Vous ne pouvez pas envoyer de message à cet utilisateur' });
    return;
  }

  const cid = chatId(authReq.uid!, targetUid);
  const msg: MessageData = {
    ...req.body,
    from: authReq.uid!,
    time: Date.now(),
  };
  const key = await pushMessage(cid, msg);
  const io = req.app.get('io');
  if (io) {
    io.to(`dm:${cid}`).emit('message:added', { convId: cid, key, data: msg });
    /* Only notify target if they haven't blocked the sender */
    const senderBlockedByTarget = await isBlocked(authReq.uid!, targetUid);
    if (!senderBlockedByTarget) {
      io.to(`user:${targetUid}`).emit('message:added', { convId: cid, key, data: msg });
    }
  }
  res.json({ key, ...msg });
});

/* POST /messages/group/:gid — envoyer un message groupe */
router.post('/group/:gid', async (req: Request, res: Response) => {
  if (!(await requireGroupMember(req, res))) return;
  const authReq = req as AuthRequest;
  const msg: MessageData = {
    ...req.body,
    from: authReq.uid!,
    time: Date.now(),
  };
  const key = await pushGroupMessage(req.params.gid, msg);
  const io = req.app.get('io');
  if (io)
    io.to(`group:${req.params.gid}`).emit('message:added', { convId: req.params.gid, key, data: msg, isGroup: true });
  res.json({ key, ...msg });
});

/* DELETE /messages/:uid/:msgKey — supprimer un message DM */
router.delete('/:uid/:msgKey', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const cid = chatId(authReq.uid!, req.params.uid);
  if (!(await isMessageOwner('messages', 'convId', cid, req.params.msgKey, authReq.uid!))) {
    res.status(403).json({ error: 'Vous ne pouvez pas supprimer ce message' });
    return;
  }
  await updateMessage(cid, req.params.msgKey, {
    text: '',
    deleted: true,
    edited: false,
    ct: null as unknown as undefined,
    iv: null as unknown as undefined,
    encrypted: null as unknown as undefined,
    imageData: null as unknown as undefined,
    fileData: null as unknown as undefined,
    fileName: null as unknown as undefined,
    audioData: null as unknown as undefined,
    duration: null as unknown as undefined,
    contact: null as unknown as undefined,
    html: null as unknown as undefined,
  });
  const io = req.app.get('io');
  if (io) io.to(`dm:${cid}`).emit('message:updated', { convId: cid, key: req.params.msgKey, data: { deleted: true } });
  res.json({ success: true });
});

/* DELETE /messages/group/:gid/:msgKey — supprimer un message groupe */
router.delete('/group/:gid/:msgKey', async (req: Request, res: Response) => {
  if (!(await requireGroupMember(req, res))) return;
  const authReq = req as AuthRequest;
  const isAuthor = await isMessageOwner('group_messages', 'gid', req.params.gid, req.params.msgKey, authReq.uid!);
  const isAdmin = await isGroupAdmin(req.params.gid, authReq.uid!);
  if (!isAuthor && !isAdmin) {
    res.status(403).json({ error: 'Vous ne pouvez pas supprimer ce message' });
    return;
  }
  await updateGroupMessage(req.params.gid, req.params.msgKey, {
    text: '',
    deleted: true,
    edited: false,
    ct: null as unknown as undefined,
    iv: null as unknown as undefined,
    encrypted: null as unknown as undefined,
    imageData: null as unknown as undefined,
    fileData: null as unknown as undefined,
    fileName: null as unknown as undefined,
    audioData: null as unknown as undefined,
    duration: null as unknown as undefined,
    contact: null as unknown as undefined,
    html: null as unknown as undefined,
  });
  const io = req.app.get('io');
  if (io)
    io.to(`group:${req.params.gid}`).emit('message:updated', {
      convId: req.params.gid,
      key: req.params.msgKey,
      data: { deleted: true },
      isGroup: true,
    });
  res.json({ success: true });
});

/* PATCH /messages/:uid/:msgKey — éditer/réagir à un message DM */
router.patch('/:uid/:msgKey', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const cid = chatId(authReq.uid!, req.params.uid);
  if (!(await isMessageOwner('messages', 'convId', cid, req.params.msgKey, authReq.uid!))) {
    res.status(403).json({ error: 'Vous ne pouvez pas modifier ce message' });
    return;
  }
  await updateMessage(cid, req.params.msgKey, req.body);
  const io = req.app.get('io');
  if (io) io.to(`dm:${cid}`).emit('message:updated', { convId: cid, key: req.params.msgKey, data: req.body });
  res.json({ success: true });
});

/* PATCH /messages/group/:gid/:msgKey */
router.patch('/group/:gid/:msgKey', async (req: Request, res: Response) => {
  if (!(await requireGroupMember(req, res))) return;
  const authReq = req as AuthRequest;
  if (!(await isMessageOwner('group_messages', 'gid', req.params.gid, req.params.msgKey, authReq.uid!))) {
    res.status(403).json({ error: 'Vous ne pouvez pas modifier ce message' });
    return;
  }
  await updateGroupMessage(req.params.gid, req.params.msgKey, req.body);
  const io = req.app.get('io');
  if (io)
    io.to(`group:${req.params.gid}`).emit('message:updated', {
      convId: req.params.gid,
      key: req.params.msgKey,
      data: req.body,
      isGroup: true,
    });
  res.json({ success: true });
});

/* POST /messages/:uid/seen — marquer des messages comme vus */
router.post('/:uid/seen', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const cid = chatId(authReq.uid!, req.params.uid);
  const { msgKeys } = req.body as { msgKeys: string[] };
  if (msgKeys?.length) {
    await markMessagesAsSeen(cid, msgKeys, Date.now());
  }
  const io = req.app.get('io');
  if (io) io.to(`dm:${cid}`).emit('seen', { by: authReq.uid!, msgKeys });
  res.json({ success: true });
});

/* POST /messages/group/:gid/seen — marquer des messages comme vus dans un groupe */
router.post('/group/:gid/seen', async (req: Request, res: Response) => {
  if (!(await requireGroupMember(req, res))) return;
  const authReq = req as AuthRequest;
  const msgKeys = (req.body as { msgKeys?: string[] }).msgKeys || [];
  if (!msgKeys.length) {
    res.json({ success: true });
    return;
  }
  const keys = [...new Set(msgKeys)].slice(0, 100);
  const placeholders = keys.map(() => '?').join(',');
  const rows = await query<Array<{ msgKey: string; seenBy: string | null }>>(
    `SELECT msgKey, seenBy FROM group_messages WHERE gid = ? AND msgKey IN (${placeholders})`,
    [req.params.gid, ...keys],
  );
  const updates: Array<{ msgKey: string; seenBy: string[] }> = [];
  for (const row of rows) {
    const seenBy: string[] = row.seenBy ? JSON.parse(row.seenBy) : [];
    if (!seenBy.includes(authReq.uid!)) {
      seenBy.push(authReq.uid!);
      updates.push({ msgKey: row.msgKey, seenBy });
    }
  }
  if (updates.length > 0) {
    const cases = updates.map(() => 'WHEN ? THEN ?').join(' ');
    const params: Array<string> = [];
    for (const u of updates) {
      params.push(u.msgKey, JSON.stringify(u.seenBy));
    }
    const keyPlaceholders = updates.map(() => '?').join(',');
    params.push(req.params.gid, ...updates.map((u) => u.msgKey));
    await query(
      `UPDATE group_messages SET seenBy = CASE msgKey ${cases} END WHERE gid = ? AND msgKey IN (${keyPlaceholders})`,
      params,
    );
  }
  const io = req.app.get('io');
  if (io) io.to(`group:${req.params.gid}`).emit('seen:group', { gid: req.params.gid, by: authReq.uid!, msgKeys });
  res.json({ success: true });
});

/* GET /messages/search/:uid — rechercher dans une conversation DM */
router.get('/search/:uid', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const cid = chatId(authReq.uid!, req.params.uid);
  const q = ((req.query.q as string) || '').trim();
  if (!q) {
    res.json({ results: {} });
    return;
  }
  const results = await searchMessages(cid, q);
  res.json({ results });
});

/* GET /messages/group/search/:gid — rechercher dans un groupe */
router.get('/group/search/:gid', async (req: Request, res: Response) => {
  if (!(await requireGroupMember(req, res))) return;
  const q = ((req.query.q as string) || '').trim();
  if (!q) {
    res.json({ results: {} });
    return;
  }
  const results = await searchGroupMessages(req.params.gid, q);
  res.json({ results });
});

/* GET /messages/:uid/pinned — messages épinglés DM */
router.get('/:uid/pinned', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const cid = chatId(authReq.uid!, req.params.uid);
  const rows = await query<Array<MessageData & { msgKey: string }>>(
    `SELECT ${MSG_COLS} FROM messages WHERE convId=? AND pinned=1 ORDER BY time DESC LIMIT 5`,
    [cid],
  );
  const result: Record<string, MessageData> = {};
  for (const row of rows) {
    const key = row.msgKey;
    const { msgKey: _, convId: __, id: ___, fromUid, contactData, ...rest } = row as unknown as Record<string, unknown>;
    result[key] = {
      from: fromUid,
      contact: contactData ? JSON.parse(contactData as string) : undefined,
      ...rest,
    } as unknown as MessageData;
  }
  res.json(result);
});

/* GET /messages/group/:gid/pinned — messages épinglés groupe */
router.get('/group/:gid/pinned', async (req: Request, res: Response) => {
  if (!(await requireGroupMember(req, res))) return;
  const rows = await query<Array<MessageData & { msgKey: string }>>(
    `SELECT ${MSG_GROUP_COLS} FROM group_messages WHERE gid=? AND pinned=1 ORDER BY time DESC LIMIT 5`,
    [req.params.gid],
  );
  const result: Record<string, MessageData> = {};
  for (const row of rows) {
    const key = row.msgKey;
    const { msgKey: _, gid: __, id: ___, fromUid, ...rest } = row as unknown as Record<string, unknown>;
    result[key] = { from: fromUid, ...rest } as unknown as MessageData;
  }
  res.json(result);
});

/* POST /messages/:uid/:msgKey/pin — épingler/désépingler un message DM */
router.post('/:uid/:msgKey/pin', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const cid = chatId(authReq.uid!, req.params.uid);
  const { pinned } = req.body as { pinned: boolean };
  await updateMessage(cid, req.params.msgKey, { pinned } as unknown as Record<string, unknown>);
  const io = req.app.get('io');
  if (io) io.to(`dm:${cid}`).emit('message:updated', { convId: cid, key: req.params.msgKey, data: { pinned } });
  res.json({ success: true });
});

/* POST /messages/group/:gid/:msgKey/pin — épingler/désépingler un message groupe */
router.post('/group/:gid/:msgKey/pin', async (req: Request, res: Response) => {
  if (!(await requireGroupMember(req, res))) return;
  const { pinned } = req.body as { pinned: boolean };
  await updateGroupMessage(req.params.gid, req.params.msgKey, { pinned } as unknown as Record<string, unknown>);
  const io = req.app.get('io');
  if (io)
    io.to(`group:${req.params.gid}`).emit('message:updated', {
      convId: req.params.gid,
      key: req.params.msgKey,
      data: { pinned },
      isGroup: true,
    });
  res.json({ success: true });
});

/* GET /messages/:uid/:msgKey/blob — données blob d'un message DM */
router.get('/:uid/:msgKey/blob', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const cid = chatId(authReq.uid!, req.params.uid);
  const blob = await getMessageBlob(cid, req.params.msgKey);
  if (!blob) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }
  res.json(blob);
});

/* GET /messages/group/:gid/:msgKey/blob — données blob d'un message groupe */
router.get('/group/:gid/:msgKey/blob', async (req: Request, res: Response) => {
  if (!(await requireGroupMember(req, res))) return;
  const blob = await getGroupMessageBlob(req.params.gid, req.params.msgKey);
  if (!blob) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }
  res.json(blob);
});

/* POST /messages/:uid/:msgKey/reaction — toggle réaction DM */
router.post('/:uid/:msgKey/reaction', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const cid = chatId(authReq.uid!, req.params.uid);
  const { emoji } = req.body as { emoji?: string };
  if (!emoji) {
    res.status(400).json({ error: 'Emoji requis' });
    return;
  }
  const row = await getOne<{ reactions: string | null }>('SELECT reactions FROM messages WHERE convId=? AND msgKey=?', [
    cid,
    req.params.msgKey,
  ]);
  if (!row) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }
  const reactions: Record<string, string> = row.reactions ? JSON.parse(row.reactions) : {};
  if (reactions[authReq.uid!] === emoji) {
    delete reactions[authReq.uid!];
  } else {
    reactions[authReq.uid!] = emoji;
  }
  await updateMessage(cid, req.params.msgKey, { reactions });
  const io = req.app.get('io');
  if (io) io.to(`dm:${cid}`).emit('message:updated', { convId: cid, key: req.params.msgKey, data: { reactions } });
  res.json({ reactions });
});

/* POST /messages/group/:gid/:msgKey/reaction — toggle réaction groupe */
router.post('/group/:gid/:msgKey/reaction', async (req: Request, res: Response) => {
  if (!(await requireGroupMember(req, res))) return;
  const authReq = req as AuthRequest;
  const { emoji } = req.body as { emoji?: string };
  if (!emoji) {
    res.status(400).json({ error: 'Emoji requis' });
    return;
  }
  const row = await getOne<{ reactions: string | null }>(
    'SELECT reactions FROM group_messages WHERE gid=? AND msgKey=?',
    [req.params.gid, req.params.msgKey],
  );
  if (!row) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }
  const reactions: Record<string, string> = row.reactions ? JSON.parse(row.reactions) : {};
  if (reactions[authReq.uid!] === emoji) {
    delete reactions[authReq.uid!];
  } else {
    reactions[authReq.uid!] = emoji;
  }
  await updateGroupMessage(req.params.gid, req.params.msgKey, { reactions });
  const io = req.app.get('io');
  if (io)
    io.to(`group:${req.params.gid}`).emit('message:updated', {
      convId: req.params.gid,
      key: req.params.msgKey,
      data: { reactions },
      isGroup: true,
    });
  res.json({ reactions });
});

export default router;
