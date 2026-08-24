import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Server } from 'socket.io';
import { verifyToken } from '../middleware/auth.js';
import {
  addGroupMember,
  createGroup,
  createGroupInvite,
  deleteGroup,
  getGroup,
  getGroupConversations,
  getGroupInvite,
  getGroupInviteByGroup,
  getProfile,
  getProfiles,
  getPublicGroups,
  isGroupInvited,
  removeGroupInvite,
  removeGroupMember,
  reportGroup,
  setGroupMemberRole,
  updateGroup,
} from '../services/rtdb.js';
import type { AuthRequest } from '../types/index.js';

function getMemberUids(group: Record<string, unknown>): string[] {
  const members = group.members as Record<string, unknown> | undefined;
  return members ? Object.keys(members) : [];
}

function emitToGroup(io: Server, gid: string, event: string, data: unknown): void {
  io.to(`group:${gid}`).emit(event, data);
}

function emitToMembers(io: Server, group: Record<string, unknown>, event: string, data: unknown): void {
  for (const uid of getMemberUids(group)) {
    io.to(`user:${uid}`).emit(event, data);
  }
}

const router: Router = Router();
router.use(verifyToken);

/* POST /groups, créer un groupe */
router.post('/', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { name, description, icon, members } = req.body as {
    name: string;
    description?: string;
    icon?: string;
    members?: string[];
  };
  if (!name?.trim()) {
    res.status(400).json({ error: 'Nom requis' });
    return;
  }
  const inviteId = randomUUID();
  const groupMembers: Record<string, { role: string; joinedAt: number }> = {
    [authReq.uid!]: { role: 'owner', joinedAt: Date.now() },
  };
  if (members) {
    for (const uid of members) {
      groupMembers[uid] = { role: 'member', joinedAt: Date.now() };
    }
  }
  const groupData = {
    name: name.trim(),
    description: description?.trim() || '',
    icon: icon?.trim() || '',
    createdAt: Date.now(),
    createdBy: authReq.uid,
    members: groupMembers,
  };
  const gid = await createGroup(groupData);
  await createGroupInvite(inviteId, gid);
  const io: Server = req.app.get('io');
  if (io) {
    for (const uid of getMemberUids(groupData as unknown as Record<string, unknown>)) {
      io.to(`user:${uid}`).emit('group:created', { gid, name: name.trim(), icon: icon?.trim() || '' });
    }
  }
  res.json({ gid, ...groupData });
});

/* GET /groups, lister mes groupes */
router.get('/', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const groups = await getGroupConversations(authReq.uid!);
  res.json(groups);
});

/* GET /groups/public, lister les groupes publics */
router.get('/public', async (req: Request, res: Response) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 100));
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
  const groups = await getPublicGroups(limit, offset);
  res.json(groups);
});

/* GET /groups/:gid, infos d'un groupe */
router.get('/:gid', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const group = await getGroup(req.params.gid);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }
  const members = group.members as Record<string, { role: string }> | undefined;
  const myRole = members?.[authReq.uid!]?.role;
  if (group.privacy === 'private' && !myRole) {
    res.status(403).json({ error: 'Groupe privé' });
    return;
  }
  const safe = { ...group };
  delete safe.reported;
  delete safe.reportedBy;
  delete safe.reportedAt;
  if (myRole !== 'admin' && myRole !== 'owner') {
    delete safe.inviteId;
  }
  res.json(safe);
});

/* PUT /groups/:gid, modifier un groupe (admin/owner) */
router.put('/:gid', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const group = await getGroup(req.params.gid);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }
  const myRole = (group.members as Record<string, { role: string }>)?.[authReq.uid!]?.role;
  if (myRole !== 'admin' && myRole !== 'owner') {
    res.status(403).json({ error: 'Action réservée aux admins' });
    return;
  }
  const { name, description, icon } = req.body as { name?: string; description?: string; icon?: string };
  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (icon !== undefined) patch.icon = icon;
  await updateGroup(req.params.gid, patch);
  const io: Server = req.app.get('io');
  if (io) {
    emitToGroup(io, req.params.gid, 'group:updated', { gid: req.params.gid, ...patch });
  }
  res.json({ success: true });
});

/* DELETE /groups/:gid, supprimer un groupe (owner only) */
router.delete('/:gid', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const group = await getGroup(req.params.gid);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }
  const myRole = (group.members as Record<string, { role: string }>)?.[authReq.uid!]?.role;
  if (myRole !== 'owner') {
    res.status(403).json({ error: 'Seul le propriétaire peut supprimer' });
    return;
  }
  const inv = await getGroupInviteByGroup(req.params.gid);
  if (inv?.inviteId) await removeGroupInvite(inv.inviteId as string);
  await deleteGroup(req.params.gid);
  const io: Server = req.app.get('io');
  if (io) {
    emitToMembers(io, group as Record<string, unknown>, 'group:deleted', { gid: req.params.gid });
  }
  res.json({ success: true });
});

/* POST /groups/:gid/members, ajouter des membres */
router.post('/:gid/members', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const group = await getGroup(req.params.gid);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }
  const myRole = (group.members as Record<string, { role: string }>)?.[authReq.uid!]?.role;
  if (myRole !== 'admin' && myRole !== 'owner') {
    res.status(403).json({ error: 'Action réservée aux admins' });
    return;
  }
  const { uids } = req.body as { uids: string[] };
  if (!uids?.length) {
    res.status(400).json({ error: 'Aucun membre spécifié' });
    return;
  }
  const io: Server = req.app.get('io');
  const profiles = await getProfiles(uids);
  for (const uid of uids) {
    await addGroupMember(req.params.gid, uid);
    if (io) {
      io.to(`user:${uid}`).emit('group:member:added', {
        gid: req.params.gid,
        name: (group as Record<string, string>).name || '',
      });
      emitToGroup(io, req.params.gid, 'group:member:added', { gid: req.params.gid, uid, profile: profiles.get(uid) });
    }
  }
  res.json({ success: true, added: uids.length });
});

/* DELETE /groups/:gid/members/:uid, exclure/quitter */
router.delete('/:gid/members/:uid', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const targetUid = req.params.uid;
  const group = await getGroup(req.params.gid);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }
  if (targetUid === authReq.uid) {
    /* Quitter le groupe */
    const myRole = (group.members as Record<string, { role: string }>)?.[authReq.uid!]?.role;
    if (myRole === 'owner') {
      res.status(403).json({ error: 'Transférez la propriété avant de quitter' });
      return;
    }
    await removeGroupMember(req.params.gid, targetUid);
    const io: Server = req.app.get('io');
    if (io) {
      emitToGroup(io, req.params.gid, 'group:member:removed', { gid: req.params.gid, uid: targetUid });
    }
    res.json({ success: true, left: true });
    return;
  }
  /* Exclure un membre (admin/owner) */
  const myRole = (group.members as Record<string, { role: string }>)?.[authReq.uid!]?.role;
  if (myRole !== 'admin' && myRole !== 'owner') {
    res.status(403).json({ error: 'Action réservée aux admins' });
    return;
  }
  await removeGroupMember(req.params.gid, targetUid);
  const io: Server = req.app.get('io');
  if (io) {
    io.to(`user:${targetUid}`).emit('group:member:removed', { gid: req.params.gid, kicked: true });
    emitToGroup(io, req.params.gid, 'group:member:removed', { gid: req.params.gid, uid: targetUid });
  }
  res.json({ success: true, kicked: true });
});

/* PUT /groups/:gid/members/:uid/role, changer rôle */
router.put('/:gid/members/:uid/role', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const group = await getGroup(req.params.gid);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }
  const myRole = (group.members as Record<string, { role: string }>)?.[authReq.uid!]?.role;
  if (myRole !== 'owner') {
    res.status(403).json({ error: 'Seul le propriétaire peut changer les rôles' });
    return;
  }
  const { role } = req.body as { role: string };
  if (role === 'owner') {
    await setGroupMemberRole(req.params.gid, authReq.uid!, 'member');
    await setGroupMemberRole(req.params.gid, req.params.uid, 'owner');
  } else {
    await setGroupMemberRole(req.params.gid, req.params.uid, role);
  }
  const io: Server = req.app.get('io');
  if (io) {
    const eventData = { gid: req.params.gid, uid: req.params.uid, role };
    emitToGroup(io, req.params.gid, 'group:role:changed', eventData);
    io.to(`user:${req.params.uid}`).emit('group:role:changed', eventData);
  }
  res.json({ success: true });
});

/* POST /groups/:gid/invite, générer nouveau lien d'invitation */
router.post('/:gid/invite', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const group = await getGroup(req.params.gid);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }
  const myRole = (group.members as Record<string, { role: string }>)?.[authReq.uid!]?.role;
  if (myRole !== 'admin' && myRole !== 'owner') {
    res.status(403).json({ error: 'Action réservée aux admins' });
    return;
  }
  const oldInv = await getGroupInviteByGroup(req.params.gid);
  if (oldInv?.inviteId) await removeGroupInvite(oldInv.inviteId as string);
  const newInviteId = randomUUID();
  await createGroupInvite(newInviteId, req.params.gid);
  res.json({ inviteId: newInviteId });
});

/* POST /groups/join/:inviteId, rejoindre via invitation */
router.post('/join/:inviteId', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const inv = await getGroupInvite(req.params.inviteId);
  if (!inv) {
    res.status(404).json({ error: "Lien d'invitation invalide" });
    return;
  }
  const groupId = (inv.gid as string) || (inv.groupId as string);
  const group = await getGroup(groupId);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }
  const members = group.members as Record<string, unknown>;
  if (members?.[authReq.uid!]) {
    res.json({ alreadyMember: true, gid: groupId });
    return;
  }
  if ((group as Record<string, string>).privacy === 'private') {
    const invited = await isGroupInvited(groupId!, authReq.uid!);
    if (!invited) {
      res.status(403).json({ error: 'Ce groupe est privé' });
      return;
    }
  }
  await addGroupMember(groupId, authReq.uid!);
  const io: Server = req.app.get('io');
  if (io) {
    io.to(`user:${authReq.uid!}`).emit('group:member:added', {
      gid: groupId,
      name: (group as Record<string, string>).name || '',
    });
    const profile = await getProfile(authReq.uid!);
    emitToGroup(io, groupId, 'group:member:added', { gid: groupId, uid: authReq.uid!, profile });
  }
  res.json({ success: true, gid: groupId });
});

/* POST /groups/:gid/report, signaler un groupe */
router.post('/:gid/report', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const group = await getGroup(req.params.gid);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }
  const name = (group as Record<string, string>).name || 'Groupe';
  await reportGroup(req.params.gid, name, authReq.uid!);
  res.json({ success: true });
});

export default router;
