import type { GroupData, GroupEntry, PostComment, SearchResult, SocialPost, StoryData, UserProfile } from '../types';

const API_BASE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL || '';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/* ── Conversations ── */
export const conversations = {
  list: () => request<{ dms: Record<string, unknown>; groups: Record<string, unknown> }>('GET', '/conversations'),
};

/* ── Messages ── */
export const messages = {
  list: (uid: string, limit?: number, before?: number) => {
    let path = `/messages/${uid}`;
    if (limit || before !== undefined) {
      const qs = new URLSearchParams();
      if (limit) qs.set('limit', String(limit));
      if (before !== undefined) qs.set('before', String(before));
      path += `?${qs.toString()}`;
    }
    return request<{ messages: Record<string, unknown>; hasMore: boolean }>('GET', path);
  },
  listGroup: (gid: string, limit?: number, before?: number) => {
    let path = `/messages/group/${gid}`;
    if (limit || before !== undefined) {
      const qs = new URLSearchParams();
      if (limit) qs.set('limit', String(limit));
      if (before !== undefined) qs.set('before', String(before));
      path += `?${qs.toString()}`;
    }
    return request<{ messages: Record<string, unknown>; hasMore: boolean }>('GET', path);
  },
  send: (uid: string, msg: Record<string, unknown>) => request<{ key: string }>('POST', `/messages/${uid}`, msg),
  sendGroup: (gid: string, msg: Record<string, unknown>) =>
    request<{ key: string }>('POST', `/messages/group/${gid}`, msg),
  delete: (uid: string, msgKey: string) => request<{ success: boolean }>('DELETE', `/messages/${uid}/${msgKey}`),
  deleteGroup: (gid: string, msgKey: string) =>
    request<{ success: boolean }>('DELETE', `/messages/group/${gid}/${msgKey}`),
  update: (uid: string, msgKey: string, data: Record<string, unknown>) =>
    request<{ success: boolean }>('PATCH', `/messages/${uid}/${msgKey}`, data),
  seen: (uid: string, msgKeys: string[]) => request<{ success: boolean }>('POST', `/messages/${uid}/seen`, { msgKeys }),
  seenGroup: (gid: string, msgKeys: string[]) =>
    request<{ success: boolean }>('POST', `/messages/group/${gid}/seen`, { msgKeys }),
  search: (uid: string, q: string) =>
    request<{ results: Record<string, unknown> }>('GET', `/messages/search/${uid}?q=${encodeURIComponent(q)}`),
  searchGroup: (gid: string, q: string) =>
    request<{ results: Record<string, unknown> }>('GET', `/messages/group/search/${gid}?q=${encodeURIComponent(q)}`),
  pin: (uid: string, msgKey: string, pinned: boolean) =>
    request<{ success: boolean }>('POST', `/messages/${uid}/${msgKey}/pin`, { pinned }),
  pinGroup: (gid: string, msgKey: string, pinned: boolean) =>
    request<{ success: boolean }>('POST', `/messages/group/${gid}/${msgKey}/pin`, { pinned }),
  getPinned: (uid: string) => request<Record<string, unknown>>('GET', `/messages/${uid}/pinned`),
  getPinnedGroup: (gid: string) => request<Record<string, unknown>>('GET', `/messages/group/${gid}/pinned`),
};

/* ── Profiles ── */
export const profiles = {
  get: (uid: string) => request<Record<string, unknown>>('GET', `/profiles/${uid}`),
  getPublicKey: (uid: string) =>
    request<{ publicKey: Record<string, unknown> | null }>('GET', `/profiles/${uid}/publicKey`),
  updateMe: (data: Record<string, unknown>) => request<{ success: boolean }>('PUT', '/profiles/me', data),
  mutual: (uid: string) =>
    request<Array<{ uid: string; pseudo: string; avatar: string | null }>>('GET', `/profiles/${uid}/mutual`),
  follow: (uid: string) => request<{ following: boolean }>('POST', `/profiles/${uid}/follow`),
  unfollow: (uid: string) => request<{ following: boolean }>('DELETE', `/profiles/${uid}/follow`),
};

/* ── Groups ── */
export const groups = {
  list: () => request<Record<string, GroupEntry>>('GET', '/groups'),
  get: (gid: string) => request<GroupData>('GET', `/groups/${gid}`),
  create: (data: { name: string; description?: string; icon?: string; members?: string[] }) =>
    request<{ gid: string } & Record<string, unknown>>('POST', '/groups', data),
  update: (gid: string, data: Record<string, unknown>) => request<{ success: boolean }>('PUT', `/groups/${gid}`, data),
  delete: (gid: string) => request<{ success: boolean }>('DELETE', `/groups/${gid}`),
  addMembers: (gid: string, uids: string[]) =>
    request<{ success: boolean; added: number }>('POST', `/groups/${gid}/members`, { uids }),
  removeMember: (gid: string, uid: string) => request<{ success: boolean }>('DELETE', `/groups/${gid}/members/${uid}`),
  setRole: (gid: string, uid: string, role: string) =>
    request<{ success: boolean }>('PUT', `/groups/${gid}/members/${uid}/role`, { role }),
  newInvite: (gid: string) => request<{ inviteId: string }>('POST', `/groups/${gid}/invite`),
  join: (inviteId: string) =>
    request<{ success?: boolean; alreadyMember?: boolean; gid: string }>('POST', `/groups/join/${inviteId}`),
  public: () => request<Record<string, unknown>[]>('GET', '/groups/public'),
  report: (gid: string) => request<{ success: boolean }>('POST', `/groups/${gid}/report`),
};

/* ── Contacts ── */
export const contacts = {
  list: () => request<Record<string, UserProfile>>('GET', '/contacts'),
  add: (wouaffId: string) =>
    request<{ uid: string; profile?: UserProfile; requested?: boolean; autoAccepted?: boolean }>('POST', '/contacts', {
      wouaffId,
    }),
  remove: (uid: string) => request<{ success: boolean }>('DELETE', `/contacts/${uid}`),
  pending: () =>
    request<{
      incoming: Array<{ fromUid: string; profile: UserProfile; createdAt: number }>;
      outgoing: Array<{ toUid: string; profile: UserProfile; createdAt: number }>;
    }>('GET', '/contacts/pending'),
  accept: (uid: string) => request<{ success: boolean }>('PUT', `/contacts/${uid}/accept`),
  reject: (uid: string) => request<{ success: boolean }>('DELETE', `/contacts/${uid}/reject`),
};

/* ── Stories ── */
export const stories = {
  list: () => request<Record<string, Record<string, StoryData>>>('GET', '/stories'),
  mine: () => request<Record<string, StoryData>>('GET', '/stories/mine'),
  create: (
    media: string,
    type?: string,
    audioData?: string,
    audioName?: string,
    audioStartTime?: number,
    audioExtractDuration?: number,
    description?: string,
  ) =>
    request<{ storyId: string } & StoryData>('POST', '/stories', {
      media,
      type: type || 'image',
      audioData,
      audioName,
      audioStartTime,
      audioExtractDuration,
      description,
    }),
  markViewed: (storyId: string, uid: string) =>
    request<{ success: boolean }>('POST', `/stories/${storyId}/view`, { uid }),
  delete: (storyId: string) => request<{ success: boolean }>('DELETE', `/stories/${storyId}`),
};

/* ── Notifications ── */
export const notifications = {
  setFcmToken: (token: string) => request<{ success: boolean }>('POST', '/notifications/fcm-token', { token }),
  removeFcmToken: (token: string) => request<{ success: boolean }>('DELETE', '/notifications/fcm-token', { token }),
};

/* ── Search ── */
export const search = {
  users: (q: string) => request<{ results: SearchResult[] }>('GET', `/search/users?q=${encodeURIComponent(q)}`),
  userByWouaffId: (wouaffId: string) =>
    request<{ uid: string; profile: UserProfile }>('GET', `/search/users/${wouaffId.replace('@', '')}`),
};

/* ── Admin ── */
export const admin = {
  staff: {
    list: () => request<Record<string, UserProfile>>('GET', '/admin/staff'),
    add: (uid: string) => request<{ success: boolean }>('POST', `/admin/staff/${uid}`),
    remove: (uid: string) => request<{ success: boolean }>('DELETE', `/admin/staff/${uid}`),
  },
  badges: {
    list: () => request<Record<string, unknown>>('GET', '/admin/badges'),
    addToUser: (uid: string, badgeId: string) =>
      request<{ success: boolean }>('POST', `/admin/badges/${uid}/add/${badgeId}`),
    set: (uid: string, badgeIds: string[]) =>
      request<{ success: boolean }>('PUT', `/admin/badges/${uid}`, { badgeIds }),
    seed: () => request<{ created: string[]; existed: string[] }>('POST', '/admin/badges/seed'),
  },
  stats: () =>
    request<{
      users: number;
      chats: number;
      messages: number;
      online: number;
      badges: number;
      wouaffIds: number;
    }>('GET', '/admin/stats'),
  users: {
    recent: () => request<Record<string, UserProfile>>('GET', '/admin/users/recent'),
  },
  profile: {
    update: (uid: string, data: Record<string, unknown>) =>
      request<{ success: boolean }>('PUT', `/admin/profile/${uid}`, data),
    resetWouaffId: (uid: string) => request<{ success: boolean }>('POST', `/admin/profile/${uid}/reset-wouaffid`),
    delete: (uid: string) => request<{ success: boolean }>('DELETE', `/admin/profile/${uid}`),
  },
  migrate: {
    wouaffIds: () => request<{ migrated: number }>('POST', '/admin/migrate/wouaffids'),
  },
  bootstrap: () => request<{ success: boolean; message: string }>('POST', '/admin/bootstrap'),
  logs: () =>
    request<
      Array<{
        id: number;
        adminUid: string;
        action: string;
        targetType: string | null;
        targetId: string | null;
        details: string | null;
        createdAt: number;
      }>
    >('GET', '/admin/logs'),
  logAction: (action: string, targetType?: string, targetId?: string, details?: string) =>
    request<{ success: boolean }>('POST', '/admin/log-action', { action, targetType, targetId, details }),
  reports: () =>
    request<
      Array<{
        gid: string;
        name: string;
        reportedBy: string;
        reportedAt: number;
      }>
    >('GET', '/admin/reports'),
  maintenance: {
    get: () => request<{ enabled: boolean; message: string | null }>('GET', '/admin/maintenance'),
    set: (enabled: boolean, message?: string) =>
      request<{ success: boolean }>('POST', '/admin/maintenance', { enabled, message }),
  },
};

/* ── Badges ── */
export const badges = {
  list: () => request<Record<string, { name?: string; icon?: string }>>('GET', '/admin/badges'),
};

/* ── Status ── */
export const status = {
  online: () => request<{ success: boolean }>('POST', '/status/online'),
  offline: () => request<{ success: boolean }>('POST', '/status/offline'),
};

/* ── Posts (feed social) ── */
export const posts = {
  list: (page = 1, limit = 20, uid?: string) =>
    request<SocialPost[]>('GET', `/posts?page=${page}&limit=${limit}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`),
  get: (id: string) => request<SocialPost>('GET', `/posts/${id}`),
  create: (text: string) => request<SocialPost>('POST', '/posts', { text }),
  like: (id: string) => request<{ liked: boolean; likes: number }>('POST', `/posts/${id}/like`),
  repost: (id: string) => request<{ reposted: boolean; reposts: number }>('POST', `/posts/${id}/repost`),
  comments: (id: string) => request<PostComment[]>('GET', `/posts/${id}/comments`),
  addComment: (id: string, text: string) => request<PostComment>('POST', `/posts/${id}/comments`, { text }),
  delete: (id: string) => request<{ success: boolean }>('DELETE', `/posts/${id}`),
  deleteComment: (commentId: number) => request<{ success: boolean }>('DELETE', `/posts/comments/${commentId}`),
};

/* ── Blocks / Reports ── */
export const blocks = {
  list: () => request<{ blocked: string[] }>('GET', '/blocks'),
  block: (uid: string) => request<{ success: boolean }>('POST', `/blocks/${uid}/block`),
  unblock: (uid: string) => request<{ success: boolean }>('POST', `/blocks/${uid}/unblock`),
  report: (uid: string, reason?: string) => request<{ success: boolean }>('POST', `/blocks/${uid}/report`, { reason }),
};

/* ── Health / Maintenance ── */
export const health = () => request<{ status: string }>('GET', '/health');
export const maintenanceStatus = () => request<{ enabled: boolean; message: string | null }>('GET', '/maintenance');
