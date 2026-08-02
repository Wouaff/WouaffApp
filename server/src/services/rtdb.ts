import { getOne, query } from '../config/database.js';
import type { MessageData } from '../types/index.js';

/* ── Helpers ── */

export function chatId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

function msgKey(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/* ── Conversations ── */

export async function getConversationsForUser(uid: string): Promise<Record<string, unknown>> {
  const rows = await query<Array<Record<string, unknown>>>(
    `SELECT c.contactUid,
            p.pseudo, p.avatar, p.status, p.lastSeen, p.bio, p.wouaffId,
            p.social_links, p.createdAt, p.banner, p.email,
            m.msgKey, m.text, m.fromUid, m.time, m.deleted, m.edited,
            m.encrypted, m.imageData, m.fileData, m.fileName,
            m.audioData, m.duration, m.contactData, m.replyTo, m.messageTheme,
            m.forwardedFrom, m.ephemeralDuration, m.reactions, m.type,
            m.pendingFrom, m.senderName, m.seen
     FROM contacts c
     JOIN profiles p ON p.uid = c.contactUid
     LEFT JOIN messages m ON m.msgKey = (
       SELECT m2.msgKey FROM messages m2
       WHERE m2.convId = CONCAT(LEAST(c.uid, c.contactUid), '_', GREATEST(c.uid, c.contactUid))
       ORDER BY m2.time DESC LIMIT 1
     )
     WHERE c.uid = ?`,
    [uid],
  );
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    const contactUid = row.contactUid as string;
    const profile: Record<string, unknown> = {};
    for (const k of ['pseudo', 'avatar', 'status', 'lastSeen', 'bio', 'wouaffId', 'social_links', 'createdAt', 'banner', 'email']) {
      if (row[k] !== undefined) profile[k] = row[k];
    }
    let lastMsg: Record<string, unknown> | null = null;
    if (row.msgKey) {
      lastMsg = {
        msgKey: row.msgKey, text: row.text, fromUid: row.fromUid, time: row.time,
        deleted: row.deleted, edited: row.edited, encrypted: row.encrypted,
        imageData: row.imageData, fileData: row.fileData, fileName: row.fileName,
        audioData: row.audioData, duration: row.duration, contactData: row.contactData,
        replyTo: row.replyTo, messageTheme: row.messageTheme, forwardedFrom: row.forwardedFrom,
        ephemeralDuration: row.ephemeralDuration, reactions: row.reactions, type: row.type,
        pendingFrom: row.pendingFrom, senderName: row.senderName, seen: row.seen,
        from: row.fromUid,
      };
    }
    result[contactUid] = { profile, lastMsg, lastTime: (lastMsg?.time as number) || 0, type: 'dm' };
  }
  return result;
}

export async function getContactUids(uid: string): Promise<string[]> {
  const rows = await query<Array<{ contactUid: string }>>('SELECT contactUid FROM contacts WHERE uid = ?', [uid]);
  return rows.map((r) => r.contactUid);
}

export async function getReverseContactUids(uid: string): Promise<string[]> {
  const rows = await query<Array<{ uid: string }>>('SELECT uid FROM contacts WHERE contactUid=?', [uid]);
  return rows.map((r) => r.uid);
}

export async function getGroupConversations(uid: string): Promise<Record<string, unknown>> {
  const rows = await query<Array<Record<string, unknown>>>(
    `SELECT gm.gid,
            g.name, g.description, g.icon, g.banner, g.privacy,
            g.createdAt, g.createdBy, g.reported, g.reportedBy, g.reportedAt,
            lm.msgKey, lm.text, lm.fromUid, lm.time, lm.deleted, lm.edited,
            lm.encrypted, lm.imageData, lm.fileData, lm.fileName,
            lm.audioData, lm.duration, lm.replyTo, lm.messageTheme,
            lm.forwardedFrom, lm.ephemeralDuration, lm.reactions, lm.type,
            lm.senderName, lm.seenBy
     FROM group_members gm
     JOIN groups_table g ON g.gid = gm.gid
     LEFT JOIN group_messages lm ON lm.msgKey = (
       SELECT lm2.msgKey FROM group_messages lm2
       WHERE lm2.gid = gm.gid
       ORDER BY lm2.time DESC LIMIT 1
     )
     WHERE gm.uid = ?`,
    [uid],
  );
  const gids = rows.map((r) => r.gid as string);
  const membersAll = gids.length > 0
    ? await query<Array<{ gid: string; uid: string; role: string; joinedAt: number }>>(
        `SELECT gid, uid, role, joinedAt FROM group_members WHERE gid IN (${gids.map(() => '?').join(',')})`,
        gids,
      )
    : [];
  const membersByGid: Record<string, Record<string, { role: string; joinedAt: number }>> = {};
  for (const m of membersAll) {
    if (!membersByGid[m.gid]) membersByGid[m.gid] = {};
    membersByGid[m.gid][m.uid] = { role: m.role, joinedAt: m.joinedAt };
  }
  const invitesAll = gids.length > 0
    ? await query<Array<{ gid: string; inviteId: string }>>(
        `SELECT gid, inviteId FROM (SELECT gid, inviteId, ROW_NUMBER() OVER (PARTITION BY gid ORDER BY createdAt DESC) as rn FROM group_invites) t WHERE t.rn = 1 AND t.gid IN (${gids.map(() => '?').join(',')})`,
        gids,
      )
    : [];
  const inviteByGid: Record<string, string> = {};
  for (const inv of invitesAll) {
    inviteByGid[inv.gid as string] = inv.inviteId;
  }
  const groups: Record<string, unknown> = {};
  for (const row of rows) {
    const gid = row.gid as string;
    const group: Record<string, unknown> = {};
    for (const k of ['name', 'description', 'icon', 'banner', 'privacy', 'createdAt', 'createdBy', 'reported', 'reportedBy', 'reportedAt']) {
      if (row[k] !== undefined) group[k] = row[k];
    }
    group.members = membersByGid[gid] || {};
    group.inviteId = inviteByGid[gid] || null;
    let lastMsg: Record<string, unknown> | null = null;
    if (row.msgKey) {
      lastMsg = {
        msgKey: row.msgKey, text: row.text, fromUid: row.fromUid, time: row.time,
        deleted: row.deleted, edited: row.edited, encrypted: row.encrypted,
        imageData: row.imageData, fileData: row.fileData, fileName: row.fileName,
        audioData: row.audioData, duration: row.duration,
        replyTo: row.replyTo, messageTheme: row.messageTheme, forwardedFrom: row.forwardedFrom,
        ephemeralDuration: row.ephemeralDuration, reactions: row.reactions, type: row.type,
        senderName: row.senderName, seenBy: row.seenBy, from: row.fromUid,
      };
    }
    groups[gid] = { group, lastMsg, lastTime: (lastMsg?.time as number) || 0, type: 'group' };
  }
  return groups;
}

/* ── Messages (DM) ── */

export async function getMessages(
  convId: string,
  limit: number = 50,
  before?: number,
): Promise<{ messages: Record<string, MessageData>; hasMore: boolean }> {
  const take = limit + 1;
  const rows = await query<Array<MessageData & { msgKey: string }>>(
    before
      ? 'SELECT * FROM messages WHERE convId = ? AND time < ? ORDER BY time DESC LIMIT ?'
      : 'SELECT * FROM messages WHERE convId = ? ORDER BY time DESC LIMIT ?',
    before ? [convId, before, take] : [convId, take],
  );
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  rows.reverse();
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
  return { messages: result, hasMore };
}

export async function pushMessage(convId: string, msg: MessageData): Promise<string> {
  const key = msgKey();
  await query(
    `INSERT INTO messages (convId, msgKey, fromUid, text, type, time, seen, encrypted, ct, iv, imageData, fileData, fileName, audioData, duration, contactData, pendingFrom, senderName, replyTo, messageTheme, forwardedFrom, ephemeralDuration) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      convId,
      key,
      msg.from,
      msg.text || null,
      msg.type || 'text',
      msg.time || Date.now(),
      0,
      msg.encrypted ? 1 : 0,
      msg.ct || null,
      msg.iv || null,
      msg.imageData || null,
      msg.fileData || null,
      msg.fileName || null,
      msg.audioData || null,
      msg.duration || null,
      msg.contact ? JSON.stringify(msg.contact) : null,
      msg.pendingFrom || null,
      msg.senderName || null,
      msg.replyTo || null,
      msg.messageTheme || null,
      msg.forwardedFrom || null,
      msg.ephemeralDuration || null,
    ],
  );
  return key;
}

export async function updateMessage(convId: string, msgKey: string, updates: Partial<MessageData>): Promise<void> {
  const fields: string[] = [];
  const params: unknown[] = [];
  if (updates.text !== undefined) {
    fields.push('text=?');
    params.push(updates.text);
  }
  if (updates.edited !== undefined) {
    fields.push('edited=?');
    params.push(updates.edited ? 1 : 0);
  }
  if (updates.deleted !== undefined) {
    fields.push('deleted=?');
    params.push(updates.deleted ? 1 : 0);
  }
  if (updates.pinned !== undefined) {
    fields.push('pinned=?');
    params.push(updates.pinned ? 1 : 0);
  }
  if (updates.seen !== undefined) {
    fields.push('seen=?');
    params.push(updates.seen);
  }
  if (updates.reactions !== undefined) {
    fields.push('reactions=?');
    params.push(JSON.stringify(updates.reactions));
  }
  if (fields.length === 0) return;
  params.push(convId, msgKey);
  await query(`UPDATE messages SET ${fields.join(',')} WHERE convId=? AND msgKey=?`, params);
}

export async function markMessagesAsSeen(convId: string, msgKeys: string[], timestamp: number): Promise<void> {
  if (msgKeys.length === 0) return;
  const placeholders = msgKeys.map(() => '?').join(',');
  await query(`UPDATE messages SET seen=? WHERE convId=? AND msgKey IN (${placeholders})`, [
    timestamp,
    convId,
    ...msgKeys,
  ]);
}

/* ── Group Messages ── */

export async function getGroupMessages(
  gid: string,
  limit: number = 50,
  before?: number,
): Promise<{ messages: Record<string, MessageData>; hasMore: boolean }> {
  const take = limit + 1;
  const rows = await query<Array<MessageData & { msgKey: string }>>(
    before
      ? 'SELECT * FROM group_messages WHERE gid = ? AND time < ? ORDER BY time DESC LIMIT ?'
      : 'SELECT * FROM group_messages WHERE gid = ? ORDER BY time DESC LIMIT ?',
    before ? [gid, before, take] : [gid, take],
  );
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  rows.reverse();
  const result: Record<string, MessageData> = {};
  for (const row of rows) {
    const key = row.msgKey;
    const { msgKey: _, gid: __, id: ___, fromUid, ...rest } = row as unknown as Record<string, unknown>;
    const msg = { from: fromUid, ...rest } as unknown as MessageData;
    if (msg.seenBy && typeof msg.seenBy === 'string') {
      try {
        msg.seenBy = JSON.parse(msg.seenBy as string);
      } catch {
        msg.seenBy = [];
      }
    }
    result[key] = msg;
  }
  return { messages: result, hasMore };
}

export async function pushGroupMessage(gid: string, msg: MessageData): Promise<string> {
  const key = msgKey();
  await query(
    `INSERT INTO group_messages (gid, msgKey, fromUid, text, type, time, deleted, edited, encrypted, ct, iv, imageData, fileData, fileName, audioData, duration, senderName, replyTo, messageTheme, forwardedFrom, seenBy, ephemeralDuration) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      gid,
      key,
      msg.from,
      msg.text || null,
      msg.type || 'text',
      msg.time || Date.now(),
      0,
      0,
      msg.encrypted ? 1 : 0,
      msg.ct || null,
      msg.iv || null,
      msg.imageData || null,
      msg.fileData || null,
      msg.fileName || null,
      msg.audioData || null,
      msg.duration || null,
      msg.senderName || null,
      msg.replyTo || null,
      msg.messageTheme || null,
      msg.forwardedFrom || null,
      msg.seenBy ? JSON.stringify(msg.seenBy) : null,
      msg.ephemeralDuration || null,
    ],
  );
  return key;
}

export async function updateGroupMessage(gid: string, msgKey: string, updates: Partial<MessageData>): Promise<void> {
  const fields: string[] = [];
  const params: unknown[] = [];
  if (updates.text !== undefined) {
    fields.push('text=?');
    params.push(updates.text);
  }
  if (updates.edited !== undefined) {
    fields.push('edited=?');
    params.push(updates.edited ? 1 : 0);
  }
  if (updates.deleted !== undefined) {
    fields.push('deleted=?');
    params.push(updates.deleted ? 1 : 0);
  }
  if (updates.pinned !== undefined) {
    fields.push('pinned=?');
    params.push(updates.pinned ? 1 : 0);
  }
  if (updates.reactions !== undefined) {
    fields.push('reactions=?');
    params.push(JSON.stringify(updates.reactions));
  }
  if (updates.seenBy !== undefined) {
    fields.push('seenBy=?');
    params.push(JSON.stringify(updates.seenBy));
  }
  if (fields.length === 0) return;
  params.push(gid, msgKey);
  await query(`UPDATE group_messages SET ${fields.join(',')} WHERE gid=? AND msgKey=?`, params);
}

/* ── Message Search ── */

export async function searchMessages(convId: string, searchQuery: string): Promise<Record<string, MessageData>> {
  const rows = await query<Array<MessageData & { msgKey: string }>>(
    'SELECT * FROM messages WHERE convId = ? AND text LIKE ? AND (deleted IS NULL OR deleted = 0) ORDER BY time DESC LIMIT 20',
    [convId, `%${searchQuery}%`],
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
  return result;
}

export async function searchGroupMessages(gid: string, searchQuery: string): Promise<Record<string, MessageData>> {
  const rows = await query<Array<MessageData & { msgKey: string }>>(
    'SELECT * FROM group_messages WHERE gid = ? AND text LIKE ? AND (deleted IS NULL OR deleted = 0) ORDER BY time DESC LIMIT 20',
    [gid, `%${searchQuery}%`],
  );
  const result: Record<string, MessageData> = {};
  for (const row of rows) {
    const key = row.msgKey;
    const { msgKey: _, gid: __, id: ___, fromUid, ...rest } = row as unknown as Record<string, unknown>;
    result[key] = { from: fromUid, ...rest } as unknown as MessageData;
  }
  return result;
}

/* ── Profiles ── */

export async function getProfile(uid: string): Promise<Record<string, unknown> | null> {
  const row = await getOne<Record<string, unknown>>('SELECT * FROM profiles WHERE uid = ?', [uid]);
  if (!row) return null;
  const { publicKey, ...profile } = row;
  const result = profile as Record<string, unknown>;
  if (publicKey) {
    try {
      result.publicKey = JSON.parse(publicKey as string);
    } catch {
      result.publicKey = publicKey;
    }
  }
  const badgeRows = await query<Array<{ badgeId: string }>>(
    'SELECT badgeId FROM user_badges WHERE uid=? ORDER BY sortOrder ASC',
    [uid],
  );
  if (badgeRows.length > 0) {
    result.ownedBadges = badgeRows.map((r) => r.badgeId);
  }
  return result;
}

const PROFILE_COLUMNS = new Set([
  'pseudo',
  'bio',
  'email',
  'passwordHash',
  'avatar',
  'banner',
  'wouaffId',
  'publicKey',
  'status',
  'lastSeen',
  'createdAt',
  'social_links',
]);

export async function updateProfile(uid: string, data: Record<string, unknown>): Promise<void> {
  if (data.wouaffId !== undefined) {
    const newId = data.wouaffId as string;
    const oldRow = await getOne<{ wouaffId: string | null }>('SELECT wouaffId FROM profiles WHERE uid = ?', [uid]);
    const oldId = oldRow?.wouaffId || '';
    if (newId !== oldId) {
      if (oldId) await query('DELETE FROM wouaff_id_index WHERE wouaffId = ?', [oldId]);
      if (newId)
        await query(
          'INSERT INTO wouaff_id_index (wouaffId, uid) VALUES (?,?) ON DUPLICATE KEY UPDATE uid=VALUES(uid)',
          [newId, uid],
        );
    }
  }
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (!PROFILE_COLUMNS.has(key)) continue;
    if (key === 'publicKey') {
      fields.push('publicKey=?');
      params.push(typeof value === 'object' ? JSON.stringify(value) : value);
    } else if (key !== 'wouaffId') {
      fields.push(`${key}=?`);
      params.push(value === undefined ? null : value);
    }
  }
  if (data.wouaffId !== undefined) {
    fields.push('wouaffId=?');
    params.push(data.wouaffId || null);
  }
  if (fields.length === 0) return;
  params.push(uid);
  await query(`UPDATE profiles SET ${fields.join(',')} WHERE uid=?`, params);
}

export async function getPublicKey(uid: string): Promise<Record<string, unknown> | null> {
  const row = await getOne<{ publicKey: string | null }>('SELECT publicKey FROM profiles WHERE uid = ?', [uid]);
  if (!row?.publicKey) return null;
  try {
    return JSON.parse(row.publicKey);
  } catch {
    return null;
  }
}

/* ── Groups ── */

export async function getGroup(gid: string): Promise<Record<string, unknown> | null> {
  if (!gid) return null;
  const row = await getOne<Record<string, unknown>>('SELECT * FROM groups_table WHERE gid = ?', [gid]);
  if (!row) return null;
  const members = await query<Array<{ uid: string; role: string; joinedAt: number }>>(
    'SELECT uid, role, joinedAt FROM group_members WHERE gid = ?',
    [gid],
  );
  const membersMap: Record<string, { role: string; joinedAt: number }> = {};
  for (const m of members) membersMap[m.uid] = { role: m.role, joinedAt: m.joinedAt };
  const inv = await getOne<{ inviteId: string }>('SELECT inviteId FROM group_invites WHERE gid = ? LIMIT 1', [gid]);
  return { ...row, members: membersMap, inviteId: inv?.inviteId || null };
}

export async function getPublicGroups(limit = 100, offset = 0): Promise<Record<string, unknown>[]> {
  const rows = await query<Array<Record<string, unknown>>>(
    `SELECT g.*, (SELECT COUNT(*) FROM group_members WHERE gid = g.gid) as memberCount
     FROM groups_table g WHERE g.privacy = 'public' ORDER BY g.createdAt DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  const gids = rows.map((r) => r.gid as string);
  const membersAll = gids.length > 0
    ? await query<Array<{ gid: string; uid: string; role: string }>>(
        `SELECT gid, uid, role FROM group_members WHERE gid IN (${gids.map(() => '?').join(',')})`,
        gids,
      )
    : [];
  const membersByGid: Record<string, Record<string, { role: string }>> = {};
  for (const m of membersAll) {
    if (!membersByGid[m.gid]) membersByGid[m.gid] = {};
    membersByGid[m.gid][m.uid] = { role: m.role };
  }
  const result: Record<string, unknown>[] = [];
  for (const row of rows) {
    result.push({ ...row, members: membersByGid[row.gid as string] || {} });
  }
  return result;
}

export async function createGroup(data: Record<string, unknown>): Promise<string> {
  const gid = (data.gid as string) || msgKey();
  const name = (data.name as string) || '';
  const description = (data.description as string) || '';
  const icon = (data.icon as string) || '';
  const createdBy = (data.createdBy as string) || '';
  const banner = (data.banner as string) || '';
  await query(
    'INSERT INTO groups_table (gid, name, description, icon, banner, createdAt, createdBy) VALUES (?,?,?,?,?,?,?)',
    [gid, name, description, icon, banner, Date.now(), createdBy],
  );
  const members = data.members as Record<string, { role: string; joinedAt: number }> | undefined;
  if (members) {
    for (const [uid, info] of Object.entries(members)) {
      await query('INSERT INTO group_members (gid, uid, role, joinedAt) VALUES (?,?,?,?)', [
        gid,
        uid,
        info.role || 'member',
        info.joinedAt || Date.now(),
      ]);
    }
  }
  return gid;
}

export async function updateGroup(gid: string, data: Record<string, unknown>): Promise<void> {
  const allowed = ['name', 'description', 'icon', 'banner', 'privacy'];
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'members' && allowed.includes(key)) {
      fields.push(`${key}=?`);
      params.push(value === undefined ? null : value);
    }
  }
  if (fields.length === 0) return;
  params.push(gid);
  await query(`UPDATE groups_table SET ${fields.join(',')} WHERE gid=?`, params);
}

export async function deleteGroup(gid: string): Promise<void> {
  await query('DELETE FROM group_messages WHERE gid=?', [gid]);
  await query('DELETE FROM group_members WHERE gid=?', [gid]);
  await query('DELETE FROM group_invites WHERE gid=?', [gid]);
  await query('DELETE FROM groups_table WHERE gid=?', [gid]);
}

export async function addGroupMember(gid: string, uid: string, role: string = 'member'): Promise<void> {
  await query(
    'INSERT INTO group_members (gid, uid, role, joinedAt) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE role=VALUES(role), joinedAt=VALUES(joinedAt)',
    [gid, uid, role, Date.now()],
  );
}

export async function removeGroupMember(gid: string, uid: string): Promise<void> {
  await query('DELETE FROM group_members WHERE gid=? AND uid=?', [gid, uid]);
}

export async function setGroupMemberRole(gid: string, uid: string, role: string): Promise<void> {
  await query('UPDATE group_members SET role=? WHERE gid=? AND uid=?', [role, gid, uid]);
}

export async function getGroupInviteByGroup(gid: string): Promise<Record<string, unknown> | null> {
  return getOne<Record<string, unknown>>('SELECT * FROM group_invites WHERE gid = ? LIMIT 1', [gid]);
}

export async function getGroupInvite(inviteId: string): Promise<Record<string, unknown> | null> {
  const row = await getOne<Record<string, unknown>>('SELECT * FROM group_invites WHERE inviteId = ?', [inviteId]);
  if (!row) return null;
  const group = await getGroup(row.gid as string);
  if (!group) return null;
  const members = group.members as Record<string, { role: string; joinedAt: number }>;
  return { group, memberCount: Object.keys(members || {}).length, ...row };
}

export async function createGroupInvite(inviteId: string, groupId: string): Promise<void> {
  await query(
    'INSERT INTO group_invites (inviteId, gid, createdAt) VALUES (?,?,?) ON DUPLICATE KEY UPDATE createdAt=VALUES(createdAt)',
    [inviteId, groupId, Date.now()],
  );
}

export async function removeGroupInvite(inviteId: string): Promise<void> {
  await query('DELETE FROM group_invites WHERE inviteId=?', [inviteId]);
}

export async function isGroupInvited(gid: string, uid: string): Promise<boolean> {
  const row = await getOne<{ uid: string }>('SELECT uid FROM group_members WHERE gid=? AND uid=?', [gid, uid]);
  return !!row;
}

export async function reportGroup(gid: string, _name: string, reporterUid: string): Promise<void> {
  await query('UPDATE groups_table SET reported=1, reportedBy=?, reportedAt=? WHERE gid=?', [
    reporterUid,
    Date.now(),
    gid,
  ]);
}

/* ── Contacts ── */

export async function getContacts(uid: string): Promise<Record<string, boolean>> {
  const rows = await query<Array<{ contactUid: string }>>('SELECT contactUid FROM contacts WHERE uid=?', [uid]);
  const result: Record<string, boolean> = {};
  for (const r of rows) result[r.contactUid] = true;
  return result;
}

export async function addContact(uid: string, contactUid: string): Promise<void> {
  await query(
    'INSERT INTO contacts (uid, contactUid, addedAt) VALUES (?,?,?) ON DUPLICATE KEY UPDATE addedAt=VALUES(addedAt)',
    [uid, contactUid, Date.now()],
  );
}

export async function getMutualContacts(
  uid1: string,
  uid2: string,
): Promise<Array<{ uid: string; pseudo: string; avatar: string | null }>> {
  return query<Array<{ uid: string; pseudo: string; avatar: string | null }>>(
    `SELECT c2.contactUid AS uid, p.pseudo, p.avatar
     FROM contacts c1
     INNER JOIN contacts c2 ON c1.contactUid = c2.contactUid
     LEFT JOIN profiles p ON c2.contactUid = p.uid
     WHERE c1.uid = ? AND c2.uid = ? AND c2.contactUid NOT IN (?, ?)`,
    [uid1, uid2, uid1, uid2],
  );
}

export async function removeContact(uid: string, contactUid: string): Promise<void> {
  await query('DELETE FROM contacts WHERE uid=? AND contactUid=?', [uid, contactUid]);
}

export async function searchByWouaffId(wouaffId: string): Promise<string | null> {
  const row = await getOne<{ uid: string }>('SELECT uid FROM wouaff_id_index WHERE wouaffId=?', [wouaffId]);
  if (row) return row.uid;
  const profile = await getOne<{ uid: string; wouaffId: string | null }>(
    'SELECT uid, wouaffId FROM profiles WHERE wouaffId=?',
    [wouaffId],
  );
  if (profile?.uid) {
    await query('INSERT INTO wouaff_id_index (wouaffId, uid) VALUES (?,?) ON DUPLICATE KEY UPDATE uid=VALUES(uid)', [
      wouaffId,
      profile.uid,
    ]);
    return profile.uid;
  }
  return null;
}

export async function getAllWouaffIds(): Promise<Record<string, string>> {
  const rows = await query<Array<{ wouaffId: string; uid: string }>>('SELECT wouaffId, uid FROM wouaff_id_index');
  const result: Record<string, string> = {};
  for (const r of rows) result[r.wouaffId] = r.uid;
  return result;
}

/* ── Pending Messages ── */

export async function getPendingMessagesForUser(uid: string): Promise<Record<string, unknown>> {
  const rows = await query<Array<Record<string, unknown>>>(
    'SELECT * FROM messages WHERE pendingFrom=? OR (convId LIKE ? AND fromUid!=?)',
    [uid, `%${uid}%`, uid],
  );
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    const key = (row as Record<string, unknown>).msgKey as string;
    result[key] = row;
  }
  return result;
}

/* ── Stories ── */

export async function getStories(uid: string): Promise<Record<string, unknown>> {
  const rows = await query<Array<Record<string, unknown>>>(
    'SELECT * FROM stories WHERE uid=? AND expiresAt>? ORDER BY createdAt DESC',
    [uid, Date.now()],
  );
  const result: Record<string, unknown> = {};
  const storyIds = rows.map((r) => (r as Record<string, unknown>).storyId as string);
  const viewsByStory: Record<string, string[]> = {};
  if (storyIds.length > 0) {
    const viewRows = await query<Array<{ storyId: string; viewedBy: string }>>(
      `SELECT storyId, viewedBy FROM story_views WHERE storyId IN (${storyIds.map(() => '?').join(',')})`,
      storyIds,
    );
    for (const v of viewRows) {
      if (!viewsByStory[v.storyId]) viewsByStory[v.storyId] = [];
      viewsByStory[v.storyId].push(v.viewedBy);
    }
  }
  for (const row of rows) {
    const storyId = (row as Record<string, unknown>).storyId as string;
    (row as Record<string, unknown>).views = viewsByStory[storyId] || [];
    result[storyId] = row;
  }
  return result;
}

export async function createStory(uid: string, storyData: Record<string, unknown>): Promise<string> {
  const storyId = msgKey();
  const media = (storyData.media as string) || '';
  const type = (storyData.type as string) || 'image';
  const audioData = (storyData.audioData as string) || null;
  const audioName = (storyData.audioName as string) || null;
  const audioStartTime = typeof storyData.audioStartTime === 'number' ? storyData.audioStartTime : 0;
  const audioExtractDuration =
    typeof storyData.audioExtractDuration === 'number' ? storyData.audioExtractDuration : null;
  const description = (storyData.description as string) || null;
  const now = Date.now();
  await query(
    'INSERT INTO stories (uid, storyId, media, type, createdAt, expiresAt, audioData, audioName, audioStartTime, audioExtractDuration, description) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [
      uid,
      storyId,
      media,
      type,
      now,
      now + 86400000,
      audioData,
      audioName,
      audioStartTime,
      audioExtractDuration,
      description,
    ],
  );
  return storyId;
}

export async function markStoryViewed(_uid: string, storyId: string, viewerUid: string): Promise<void> {
  await query(
    'INSERT INTO story_views (storyId, viewedBy, viewedAt) VALUES (?,?,?) ON DUPLICATE KEY UPDATE viewedAt=VALUES(viewedAt)',
    [storyId, viewerUid, Date.now()],
  );
}

export async function deleteStory(uid: string, storyId: string): Promise<void> {
  await query('DELETE FROM story_views WHERE storyId=?', [storyId]);
  await query('DELETE FROM stories WHERE storyId=? AND uid=?', [storyId, uid]);
}

export async function cleanupExpiredStories(uid: string): Promise<void> {
  const expired = await query<Array<{ storyId: string }>>('SELECT storyId FROM stories WHERE uid=? AND expiresAt<=?', [
    uid,
    Date.now(),
  ]);
  for (const row of expired) {
    await query('DELETE FROM story_views WHERE storyId=?', [row.storyId]);
  }
  await query('DELETE FROM stories WHERE uid=? AND expiresAt<=?', [uid, Date.now()]);
}

/* ── FCM Tokens ── */

export async function setFcmToken(uid: string, token: string): Promise<void> {
  await query(
    'INSERT INTO fcm_tokens (uid, token, createdAt) VALUES (?,?,?) ON DUPLICATE KEY UPDATE createdAt=VALUES(createdAt)',
    [uid, token, Date.now()],
  );
}

export async function removeFcmToken(uid: string, token: string): Promise<void> {
  await query('DELETE FROM fcm_tokens WHERE uid=? AND token=?', [uid, token]);
}

/* ── Badges ── */

export async function getBadges(): Promise<Record<string, unknown>> {
  const rows = await query<Array<Record<string, unknown>>>('SELECT * FROM badges');
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    const id = (row as Record<string, unknown>).id as string;
    result[id] = row;
  }
  return result;
}

export async function addBadgeToUser(uid: string, badgeId: string): Promise<void> {
  await query('INSERT INTO user_badges (uid, badgeId) VALUES (?,?) ON DUPLICATE KEY UPDATE sortOrder=sortOrder', [
    uid,
    badgeId,
  ]);
}

export async function seedBadges(): Promise<{ created: string[]; existed: string[] }> {
  const knownBadges: Array<{ id: string; name: string; icon: string }> = [
    { id: 'dieu', name: 'Dieu', icon: '/assets/badges/dieu_badge.png' },
    { id: 'cat', name: 'Cat', icon: '/assets/badges/cat_badge.png' },
    { id: 'og', name: 'OG', icon: '/assets/badges/og_badge.png' },
    { id: 'founder', name: 'Founder', icon: '/assets/badges/founder.png' },
    { id: 'discord', name: 'Discord', icon: '/assets/badges/discord_badge.png' },
    { id: 'staff', name: 'Staff', icon: '/assets/badges/staff_badge.png' },
    { id: 'partner', name: 'Partner', icon: '/assets/badges/partner_badge.png' },
    { id: 'v.i.p', name: 'V.I.P', icon: '/assets/badges/vip_badge.png' },
  ];
  const created: string[] = [];
  const existed: string[] = [];
  for (const badge of knownBadges) {
    const existing = await getOne<{ id: string }>('SELECT id FROM badges WHERE id=?', [badge.id]);
    if (existing) {
      existed.push(badge.id);
      await query('UPDATE badges SET name=?, icon=? WHERE id=?', [badge.name, badge.icon, badge.id]);
    } else {
      await query('INSERT INTO badges (id, name, icon) VALUES (?,?,?)', [badge.id, badge.name, badge.icon]);
      created.push(badge.id);
    }
  }
  return { created, existed };
}

/* ── Croquettes (legacy) ── */

export async function getCroquettes(_uid: string): Promise<Record<string, unknown> | null> {
  return null;
}

/* ── Deleted Conversations ── */

export async function getDeletedConversations(uid: string): Promise<Record<string, boolean>> {
  const rows = await query<Array<{ convId: string }>>('SELECT convId FROM deleted_convs WHERE uid=?', [uid]);
  const result: Record<string, boolean> = {};
  for (const r of rows) result[r.convId] = true;
  return result;
}

export async function setDeletedConversation(uid: string, convId: string): Promise<void> {
  await query(
    'INSERT INTO deleted_convs (uid, convId, deletedAt) VALUES (?,?,?) ON DUPLICATE KEY UPDATE deletedAt=VALUES(deletedAt)',
    [uid, convId, Date.now()],
  );
}

/* ── Staff ── */

export async function isStaff(uid: string): Promise<boolean> {
  const row = await getOne<{ uid: string }>('SELECT uid FROM staff WHERE uid=?', [uid]);
  return !!row;
}

export async function getAllStaff(): Promise<Record<string, boolean>> {
  const rows = await query<Array<{ uid: string }>>('SELECT uid FROM staff');
  const result: Record<string, boolean> = {};
  for (const r of rows) result[r.uid] = true;
  return result;
}

export async function setStaff(uid: string, isStaffMember: boolean): Promise<void> {
  if (isStaffMember) {
    await query('INSERT INTO staff (uid, addedAt) VALUES (?,?) ON DUPLICATE KEY UPDATE addedAt=VALUES(addedAt)', [
      uid,
      Date.now(),
    ]);
  } else {
    await query('DELETE FROM staff WHERE uid=?', [uid]);
  }
}

/* ── Admin Functions ── */

export async function getAdminStats(): Promise<{
  users: number;
  chats: number;
  messages: number;
  online: number;
  badges: number;
  wouaffIds: number;
}> {
  const [[{ users }], [{ chats }], [{ messages }], [{ online }], [{ badges }], [{ ids }]] = await Promise.all([
    query<[{ users: number }]>('SELECT COUNT(*) as users FROM profiles'),
    query<[{ chats: number }]>('SELECT COUNT(DISTINCT convId) as chats FROM messages'),
    query<[{ messages: number }]>('SELECT COUNT(*) as messages FROM messages'),
    query<[{ online: number }]>("SELECT COUNT(*) as online FROM profiles WHERE status='online'"),
    query<[{ badges: number }]>('SELECT COUNT(*) as badges FROM badges'),
    query<[{ ids: number }]>('SELECT COUNT(*) as ids FROM wouaff_id_index'),
  ]);
  return { users, chats, messages, online, badges, wouaffIds: ids };
}

export async function getRecentUsers(limit = 20): Promise<Record<string, Record<string, unknown>>> {
  const rows = await query<Array<{ uid: string } & Record<string, unknown>>>(
    'SELECT * FROM profiles ORDER BY createdAt DESC LIMIT ?',
    [limit],
  );
  const result: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    const { uid, ...profile } = row;
    result[uid as string] = profile;
  }
  return result;
}

export async function updateProfileByAdmin(uid: string, data: Record<string, unknown>): Promise<void> {
  if (data.wouaffId !== undefined) {
    const newId = data.wouaffId as string;
    const oldRow = await getOne<{ wouaffId: string | null }>('SELECT wouaffId FROM profiles WHERE uid=?', [uid]);
    const oldId = oldRow?.wouaffId || '';
    if (newId !== oldId) {
      if (oldId) await query('DELETE FROM wouaff_id_index WHERE wouaffId=?', [oldId]);
      if (newId)
        await query(
          'INSERT INTO wouaff_id_index (wouaffId, uid) VALUES (?,?) ON DUPLICATE KEY UPDATE uid=VALUES(uid)',
          [newId, uid],
        );
    }
  }
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (!PROFILE_COLUMNS.has(key) || key === 'publicKey') continue;
    fields.push(`${key}=?`);
    params.push(value);
  }
  if (data.wouaffId !== undefined) {
    fields.push('wouaffId=?');
    params.push(data.wouaffId || null);
  }
  if (fields.length === 0) return;
  params.push(uid);
  await query(`UPDATE profiles SET ${fields.join(',')} WHERE uid=?`, params);
}

export async function setUserBadges(uid: string, badgeIds: string[]): Promise<void> {
  await query('DELETE FROM user_badges WHERE uid=?', [uid]);
  for (let i = 0; i < badgeIds.length; i++) {
    await query('INSERT INTO user_badges (uid, badgeId, sortOrder) VALUES (?,?,?)', [uid, badgeIds[i], i]);
  }
}

export async function resetUserWouaffId(uid: string): Promise<void> {
  const row = await getOne<{ wouaffId: string | null }>('SELECT wouaffId FROM profiles WHERE uid=?', [uid]);
  if (row?.wouaffId) await query('DELETE FROM wouaff_id_index WHERE wouaffId=?', [row.wouaffId]);
  await query('UPDATE profiles SET wouaffId=NULL WHERE uid=?', [uid]);
}

export async function deleteUserProfile(uid: string): Promise<void> {
  const row = await getOne<{ wouaffId: string | null }>('SELECT wouaffId FROM profiles WHERE uid=?', [uid]);
  if (row?.wouaffId) await query('DELETE FROM wouaff_id_index WHERE wouaffId=?', [row.wouaffId]);
  await query('DELETE FROM contacts WHERE uid=? OR contactUid=?', [uid, uid]);
  await query('DELETE FROM user_badges WHERE uid=?', [uid]);
  await query('DELETE FROM group_members WHERE uid=?', [uid]);
  await query('DELETE FROM messages WHERE fromUid=?', [uid]);
  await query('DELETE FROM group_messages WHERE fromUid=?', [uid]);
  await query('DELETE FROM fcm_tokens WHERE uid=?', [uid]);
  await query('DELETE FROM deleted_convs WHERE uid=?', [uid]);
  await query('DELETE FROM stories WHERE uid=?', [uid]);
  await query('DELETE FROM profiles WHERE uid=?', [uid]);
}

/* ── Contact Requests ── */

export async function sendContactRequest(fromUid: string, toUid: string): Promise<void> {
  await query(
    'INSERT INTO contact_requests (fromUid, toUid, status, createdAt) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status), createdAt=VALUES(createdAt)',
    [fromUid, toUid, 'pending', Date.now()],
  );
}

export async function acceptContactRequest(uid: string, fromUid: string): Promise<boolean> {
  const row = await getOne<{ id: number }>('SELECT id FROM contact_requests WHERE fromUid=? AND toUid=? AND status=?', [
    fromUid,
    uid,
    'pending',
  ]);
  if (!row) return false;
  await query('UPDATE contact_requests SET status=? WHERE id=?', ['accepted', row.id]);
  await addContact(uid, fromUid);
  await addContact(fromUid, uid);
  return true;
}

export async function rejectContactRequest(uid: string, fromUid: string): Promise<boolean> {
  const row = await getOne<{ id: number }>('SELECT id FROM contact_requests WHERE fromUid=? AND toUid=? AND status=?', [
    fromUid,
    uid,
    'pending',
  ]);
  if (!row) return false;
  await query('UPDATE contact_requests SET status=? WHERE id=?', ['rejected', row.id]);
  return true;
}

export async function getPendingRequests(uid: string): Promise<Array<{ fromUid: string; createdAt: number }>> {
  return query<Array<{ fromUid: string; createdAt: number }>>(
    'SELECT fromUid, createdAt FROM contact_requests WHERE toUid=? AND status=? ORDER BY createdAt DESC',
    [uid, 'pending'],
  );
}

export async function getSentRequests(uid: string): Promise<Array<{ toUid: string; createdAt: number }>> {
  return query<Array<{ toUid: string; createdAt: number }>>(
    'SELECT toUid, createdAt FROM contact_requests WHERE fromUid=? AND status=? ORDER BY createdAt DESC',
    [uid, 'pending'],
  );
}

/* ── Blocks ── */

export async function blockUser(uid: string, blockedUid: string): Promise<void> {
  await query(
    'INSERT INTO blocks (uid, blockedUid, blockedAt) VALUES (?,?,?) ON DUPLICATE KEY UPDATE blockedAt=VALUES(blockedAt)',
    [uid, blockedUid, Date.now()],
  );
}

export async function unblockUser(uid: string, blockedUid: string): Promise<void> {
  await query('DELETE FROM blocks WHERE uid=? AND blockedUid=?', [uid, blockedUid]);
}

export async function getBlockedUids(uid: string): Promise<string[]> {
  const rows = await query<Array<{ blockedUid: string }>>('SELECT blockedUid FROM blocks WHERE uid=?', [uid]);
  return rows.map((r) => r.blockedUid);
}

export async function isBlocked(uid: string, blockedUid: string): Promise<boolean> {
  const row = await getOne<{ blockedUid: string }>('SELECT blockedUid FROM blocks WHERE uid=? AND blockedUid=?', [
    uid,
    blockedUid,
  ]);
  return !!row;
}

/* ── User Reports ── */

export async function reportUser(reportedUid: string, reporterUid: string, reason?: string): Promise<void> {
  await query('INSERT INTO user_reports (reportedUid, reporterUid, reason, createdAt) VALUES (?,?,?,?)', [
    reportedUid,
    reporterUid,
    reason || null,
    Date.now(),
  ]);
}

/* ── Status ── */

export async function setUserOnline(uid: string): Promise<void> {
  await query("UPDATE profiles SET status='online', lastSeen=? WHERE uid=?", [Date.now(), uid]);
}

export async function setUserOffline(uid: string): Promise<void> {
  await query("UPDATE profiles SET status='offline', lastSeen=? WHERE uid=?", [Date.now(), uid]);
}

/* ── Typing (in-memory via Socket.IO, stub for compatibility) ── */

export async function setTyping(_convId: string, _uid: string, _isTyping: boolean): Promise<void> {
  /* Typing indicators are handled via Socket.IO */
}

export async function setGroupTyping(_gid: string, _uid: string, _isTyping: boolean): Promise<void> {
  /* Typing indicators are handled via Socket.IO */
}

/* ── Admin Logs ── */

export async function logAdminAction(
  adminUid: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: string,
): Promise<void> {
  await query(
    'INSERT INTO admin_logs (adminUid, action, targetType, targetId, details, createdAt) VALUES (?,?,?,?,?,?)',
    [adminUid, action, targetType || null, targetId || null, details || null, Date.now()],
  );
}

export async function getAdminLogs(limit = 50): Promise<
  Array<{
    id: number;
    adminUid: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    details: string | null;
    createdAt: number;
  }>
> {
  return query('SELECT * FROM admin_logs ORDER BY createdAt DESC LIMIT ?', [limit]);
}

export async function getReportedGroups(): Promise<
  Array<{
    gid: string;
    name: string;
    reportedBy: string;
    reportedAt: number;
  }>
> {
  return query<Array<{ gid: string; name: string; reportedBy: string; reportedAt: number }>>(
    `SELECT g.gid, g.name, g.reportedBy, g.reportedAt
     FROM groups_table g
     WHERE g.reported = 1
     ORDER BY g.reportedAt DESC
     LIMIT 50`,
  );
}

/* ── Ephemeral messages cleanup ── */

export async function cleanExpiredEphemeralMessages(): Promise<
  Array<{ type: 'dm' | 'group'; convId: string; key: string }>
> {
  const now = Date.now();
  const deleted: Array<{ type: 'dm' | 'group'; convId: string; key: string }> = [];

  const dmRows = await query<Array<{ convId: string; msgKey: string }>>(
    'SELECT convId, msgKey FROM messages WHERE ephemeralDuration IS NOT NULL AND (time + ephemeralDuration) < ?',
    [now],
  );
  for (const row of dmRows) {
    await query('DELETE FROM messages WHERE convId=? AND msgKey=?', [row.convId, row.msgKey]);
    deleted.push({ type: 'dm', convId: row.convId, key: row.msgKey });
  }

  const groupRows = await query<Array<{ gid: string; msgKey: string }>>(
    'SELECT gid, msgKey FROM group_messages WHERE ephemeralDuration IS NOT NULL AND (time + ephemeralDuration) < ?',
    [now],
  );
  for (const row of groupRows) {
    await query('DELETE FROM group_messages WHERE gid=? AND msgKey=?', [row.gid, row.msgKey]);
    deleted.push({ type: 'group', convId: row.gid, key: row.msgKey });
  }

  return deleted;
}

/* ── Maintenance mode ── */

export async function getMaintenanceMode(): Promise<{ enabled: boolean; message: string | null }> {
  await query(
    `CREATE TABLE IF NOT EXISTS maintenance_mode (
      id INT PRIMARY KEY DEFAULT 1,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      message TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  );
  await query('INSERT IGNORE INTO maintenance_mode (id, enabled, message) VALUES (1, 0, NULL)');
  const rows = await query<Array<{ enabled: number; message: string | null }>>(
    'SELECT enabled, message FROM maintenance_mode WHERE id = 1',
  );
  return { enabled: rows[0]?.enabled === 1, message: rows[0]?.message ?? null };
}

export async function setMaintenanceMode(enabled: boolean, message?: string): Promise<void> {
  await query('UPDATE maintenance_mode SET enabled = ?, message = ? WHERE id = 1', [enabled ? 1 : 0, message ?? null]);
}

/* ── Migration ── */

export async function migrateWouaffIds(): Promise<{ migrated: number }> {
  const rows = await query<Array<{ uid: string; wouaffId: string | null }>>(
    "SELECT uid, wouaffId FROM profiles WHERE wouaffId IS NOT NULL AND wouaffId != ''",
  );
  let count = 0;
  for (const row of rows) {
    if (row.wouaffId?.startsWith('@')) {
      await query('INSERT INTO wouaff_id_index (wouaffId, uid) VALUES (?,?) ON DUPLICATE KEY UPDATE uid=VALUES(uid)', [
        row.wouaffId,
        row.uid,
      ]);
      count++;
    }
  }
  return { migrated: count };
}
