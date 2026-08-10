import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Server } from 'socket.io';
import { verifyToken } from '../middleware/auth.js';
import {
  acceptContactRequest,
  getContacts,
  getPendingRequests,
  getProfile,
  getProfiles,
  getSentRequests,
  isBlocked,
  rejectContactRequest,
  removeContact,
  searchByWouaffId,
  sendContactRequest,
} from '../services/rtdb.js';
import type { AuthRequest } from '../types/index.js';

const router: Router = Router();
router.use(verifyToken);

/* GET /contacts — liste des contacts */
router.get('/', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const contacts = await getContacts(authReq.uid!);
  const profiles = await getProfiles(Object.keys(contacts));
  const result: Record<string, unknown> = {};
  for (const [uid, profile] of profiles) {
    result[uid] = profile;
  }
  res.json(result);
});

/* GET /contacts/pending — demandes entrantes + sortantes */
router.get('/pending', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const [incoming, outgoing] = await Promise.all([getPendingRequests(authReq.uid!), getSentRequests(authReq.uid!)]);
  const uids = [...incoming.map((r) => r.fromUid), ...outgoing.map((r) => r.toUid)];
  const profiles = await getProfiles(uids);
  const incomingProfiles = incoming.map((r) => ({
    fromUid: r.fromUid,
    profile: profiles.get(r.fromUid) || null,
    createdAt: r.createdAt,
  }));
  const outgoingProfiles = outgoing.map((r) => ({
    toUid: r.toUid,
    profile: profiles.get(r.toUid) || null,
    createdAt: r.createdAt,
  }));
  res.json({ incoming: incomingProfiles, outgoing: outgoingProfiles });
});

/* POST /contacts — envoyer une demande d'ami par @wouaffId */
router.post('/', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  let { wouaffId } = req.body as { wouaffId: string };
  if (typeof wouaffId === 'string') wouaffId = wouaffId.trim();
  if (!wouaffId?.startsWith('@')) {
    res.status(400).json({ error: "L'identifiant doit commencer par @" });
    return;
  }
  const contactUid = await searchByWouaffId(wouaffId);
  if (!contactUid) {
    res.status(404).json({ error: 'Identifiant introuvable' });
    return;
  }
  if (contactUid === authReq.uid) {
    res.status(400).json({ error: 'Vous ne pouvez pas vous ajouter vous-même' });
    return;
  }

  /* Check if blocked */
  if (await isBlocked(contactUid, authReq.uid!)) {
    res.status(403).json({ error: 'Vous ne pouvez pas ajouter cet utilisateur' });
    return;
  }

  const existing = await getContacts(authReq.uid!);
  if (existing[contactUid]) {
    res.status(409).json({ error: 'Contact déjà dans votre liste' });
    return;
  }

  /* Check if target already sent us a request → auto-accept */
  const targetSent = await getSentRequests(contactUid);
  if (targetSent.some((r) => r.toUid === authReq.uid)) {
    await acceptContactRequest(authReq.uid!, contactUid);
    const requesterProfile = await getProfile(authReq.uid!);
    const targetProfile = await getProfile(contactUid);
    const io: Server = req.app.get('io');
    if (io) {
      io.to(`user:${contactUid}`).emit('contact:request:accepted', { by: authReq.uid!, profile: requesterProfile });
      io.to(`user:${authReq.uid!}`).emit('contact:added', { by: contactUid, profile: targetProfile });
    }
    res.json({ uid: contactUid, profile: targetProfile, autoAccepted: true });
    return;
  }

  /* Send a pending request */
  await sendContactRequest(authReq.uid!, contactUid);
  const requesterProfile = await getProfile(authReq.uid!);
  const targetProfile = await getProfile(contactUid);
  const io: Server = req.app.get('io');
  if (io) {
    io.to(`user:${contactUid}`).emit('contact:request', { from: authReq.uid!, profile: requesterProfile });
  }
  res.json({ uid: contactUid, profile: targetProfile, requested: true });
});

/* PUT /contacts/:uid/accept — accepter une demande */
router.put('/:uid/accept', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const ok = await acceptContactRequest(authReq.uid!, req.params.uid);
  if (!ok) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }
  const acceptorProfile = await getProfile(authReq.uid!);
  const requesterProfile = await getProfile(req.params.uid);
  const io: Server = req.app.get('io');
  if (io) {
    io.to(`user:${req.params.uid}`).emit('contact:request:accepted', { by: authReq.uid!, profile: acceptorProfile });
    io.to(`user:${authReq.uid!}`).emit('contact:added', { by: req.params.uid, profile: requesterProfile });
  }
  res.json({ success: true });
});

/* DELETE /contacts/:uid/reject — refuser une demande */
router.delete('/:uid/reject', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const ok = await rejectContactRequest(authReq.uid!, req.params.uid);
  if (!ok) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }
  const io: Server = req.app.get('io');
  if (io) {
    io.to(`user:${req.params.uid}`).emit('contact:request:rejected', { by: authReq.uid! });
  }
  res.json({ success: true });
});

/* DELETE /contacts/:uid — supprimer un contact */
router.delete('/:uid', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  await removeContact(authReq.uid!, req.params.uid);
  await removeContact(req.params.uid, authReq.uid!);
  const io: Server = req.app.get('io');
  if (io) {
    io.to(`user:${req.params.uid}`).emit('contact:removed', { by: authReq.uid! });
    io.to(`user:${authReq.uid!}`).emit('contact:removed', { by: req.params.uid });
  }
  res.json({ success: true });
});

export default router;
