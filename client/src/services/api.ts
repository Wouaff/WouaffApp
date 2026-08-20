import type {
  Community,
  CommunityComment,
  CommunityDiscoverResponse,
  CommunityPost,
  CommunitySort,
  CommunityTopWindow,
  FeedItem,
  GifResult,
  GroupData,
  GroupEntry,
  MentionUser,
  NotificationItem,
  PostComment,
  PostPoll,
  PostReaction,
  SearchResult,
  SocialPost,
  StoryData,
  TrendItem,
  UserProfile,
} from '../types';

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
  blob: (uid: string, msgKey: string) =>
    request<{ imageData?: string; fileData?: string; fileName?: string; audioData?: string; contactData?: string }>(
      'GET',
      `/messages/${uid}/${msgKey}/blob`,
    ),
  blobGroup: (gid: string, msgKey: string) =>
    request<{ imageData?: string; fileData?: string; fileName?: string; audioData?: string }>(
      'GET',
      `/messages/group/${gid}/${msgKey}/blob`,
    ),
};

/* ── Profiles ── */
export const profiles = {
  get: (uid: string) => request<Record<string, unknown>>('GET', `/profiles/${uid}`),
  getPublicKey: (uid: string) =>
    request<{ publicKey: Record<string, unknown> | null }>('GET', `/profiles/${uid}/publicKey`),
  updateMe: (data: Record<string, unknown>) => request<{ success: boolean }>('PUT', '/profiles/me', data),
  mutual: (uid: string) =>
    request<Array<{ uid: string; pseudo: string; avatar: string | null }>>('GET', `/profiles/${uid}/mutual`),
  suggestions: (limit = 3) =>
    request<{
      results: Array<{
        uid: string;
        pseudo: string;
        avatar: string | null;
        bio: string | null;
        wouaffId: string | null;
      }>;
    }>('GET', `/profiles/suggestions?limit=${limit}`),
  follow: (uid: string) => request<{ following: boolean }>('POST', `/profiles/${uid}/follow`),
  unfollow: (uid: string) => request<{ following: boolean }>('DELETE', `/profiles/${uid}/follow`),
  setMusic: (url: string) =>
    request<{
      success: boolean;
      music: { provider: string; url: string; title: string; artist: string; thumbnail: string };
    }>('POST', '/profiles/me/music', { url }),
  removeMusic: () => request<{ success: boolean }>('DELETE', '/profiles/me/music'),
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

/* ── Communautés (type Subreddit) ── */
export interface CreateCommunityInput {
  name: string;
  displayName?: string;
  description?: string;
  category?: string;
  rules?: string[];
  avatar?: string;
  banner?: string;
  isPrivate?: boolean;
}

export const communities = {
  discover: () => request<CommunityDiscoverResponse>('GET', '/communities'),
  discoverCategory: (category?: string, limit = 30) =>
    request<Community[]>(
      'GET',
      `/communities/discover?limit=${limit}${category ? `&category=${encodeURIComponent(category)}` : ''}`,
    ),
  mine: () => request<Community[]>('GET', '/communities/mine'),
  search: (q: string, limit = 20) =>
    request<Community[]>('GET', `/communities/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  get: (name: string) => request<Community>('GET', `/communities/${encodeURIComponent(name)}`),
  create: (data: CreateCommunityInput) => request<Community>('POST', '/communities', data),
  update: (name: string, data: Partial<CreateCommunityInput>) =>
    request<Community>('PUT', `/communities/${encodeURIComponent(name)}`, data),
  subscribe: (name: string) => request<{ subscribed: boolean }>('POST', `/communities/${name}/subscribe`),
  unsubscribe: (name: string) => request<{ subscribed: boolean }>('POST', `/communities/${name}/unsubscribe`),
  setRole: (name: string, uid: string, role: 'member' | 'moderator') =>
    request<{ success: boolean; role: string }>('POST', `/communities/${name}/members/${uid}/role`, { role }),
  kick: (name: string, uid: string) => request<{ success: boolean }>('DELETE', `/communities/${name}/members/${uid}`),
  leave: (name: string) => request<{ success: boolean; left: boolean }>('DELETE', `/communities/${name}/members/me`),
  ban: (name: string, uid: string, reason?: string, durationHours?: number) =>
    request<{ success: boolean; durationHours: number | null }>('POST', `/communities/${name}/bans`, {
      uid,
      reason,
      durationHours,
    }),
  unban: (name: string, uid: string) => request<{ success: boolean }>('DELETE', `/communities/${name}/bans/${uid}`),
  feed: (name: string, sort: CommunitySort, window: CommunityTopWindow, offset = 0, limit = 20) => {
    const params = new URLSearchParams({ sort, window, limit: String(limit), offset: String(offset) });
    return request<{ items: CommunityPost[]; hasMore: boolean }>(
      'GET',
      `/communities/${encodeURIComponent(name)}/feed?${params.toString()}`,
    );
  },
  homeFeed: (sort: CommunitySort = 'new', window: CommunityTopWindow = 'week', offset = 0, limit = 20) => {
    const params = new URLSearchParams({ sort, window, limit: String(limit), offset: String(offset) });
    return request<{ items: CommunityPost[]; hasMore: boolean }>('GET', `/communities/feed?${params.toString()}`);
  },
  onboard: (names: string[]) => request<{ subscribed: number }>('POST', '/communities/onboard', { names }),
  getPost: (id: string) => request<CommunityPost>('GET', `/communities/post/${id}`),
  createPost: (name: string, data: { title: string; content?: string; type?: string }) =>
    request<CommunityPost>('POST', `/communities/${name}/posts`, data),
  getPostDetail: (name: string, postId: string) =>
    request<CommunityPost>('GET', `/communities/${name}/posts/${postId}`),
  vote: (name: string, postId: string, value: -1 | 0 | 1) =>
    request<{ vote: -1 | 0 | 1; upvotes: number; downvotes: number }>(
      'POST',
      `/communities/${name}/posts/${postId}/vote`,
      { value },
    ),
  pin: (name: string, postId: string, pinned: boolean) =>
    request<{ success: boolean; pinned: boolean }>('POST', `/communities/${name}/posts/${postId}/pin`, { pinned }),
  deletePost: (name: string, postId: string) =>
    request<{ success: boolean }>('DELETE', `/communities/${name}/posts/${postId}`),
  comments: (name: string, postId: string) =>
    request<{ items: CommunityComment[]; hasMore: boolean }>('GET', `/communities/${name}/posts/${postId}/comments`),
  addComment: (name: string, postId: string, content: string) =>
    request<CommunityComment>('POST', `/communities/${name}/posts/${postId}/comments`, { content }),
  deleteComment: (name: string, postId: string, commentId: number) =>
    request<{ success: boolean }>('DELETE', `/communities/${name}/posts/${postId}/comments/${commentId}`),
};

/* ── Contacts ── */
export interface ContactMatch {
  uid: string;
  pseudo: string;
  avatar: string | null;
  wouaffId: string | null;
}

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
  syncStatus: () => request<{ completed: boolean; phone: string | null }>('GET', '/contacts/sync-status'),
  sync: (phone: string | undefined, contactsList: string[]) =>
    request<{ matches: ContactMatch[]; missing: string[]; phone: string | null }>('POST', '/contacts/sync', {
      phone,
      contacts: contactsList,
    }),
};

/* ── Onboarding (compte neuf : suivre des comptes + communautés) ── */
export interface OnboardingUser {
  uid: string;
  pseudo: string;
  avatar: string | null;
  bio: string | null;
  wouaffId: string | null;
  isStaff: boolean;
}

export interface OnboardingCommunity {
  id: string;
  name: string;
  displayName: string | null;
  avatar: string | null;
  category: string;
  memberCount: number;
}

export const onboarding = {
  status: () => request<{ completed: boolean; required: boolean }>('GET', '/onboarding/status'),
  suggestions: () =>
    request<{ users: OnboardingUser[]; communities: OnboardingCommunity[]; minimum: number }>(
      'GET',
      '/onboarding/suggestions',
    ),
  complete: (followUids: string[], communityNames: string[]) =>
    request<{ success: boolean; followed: number; subscribed: number }>('POST', '/onboarding/complete', {
      followUids,
      communityNames,
    }),
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
  list: (limit = 50, before?: number) => {
    let path = `/notifications?limit=${limit}`;
    if (before) path += `&before=${before}`;
    return request<{ items: NotificationItem[]; unread: number }>('GET', path);
  },
  unreadCount: () => request<{ count: number }>('GET', '/notifications/unread-count'),
  markRead: (id: number) => request<{ success: boolean }>('POST', `/notifications/${id}/read`),
  markAllRead: () => request<{ success: boolean }>('POST', '/notifications/read-all'),
  setFcmToken: (token: string) => request<{ success: boolean }>('POST', '/notifications/fcm-token', { token }),
  removeFcmToken: (token: string) => request<{ success: boolean }>('DELETE', '/notifications/fcm-token', { token }),
};

/* ── Search ── */
export const search = {
  users: (q: string) => request<{ results: SearchResult[] }>('GET', `/search/users?q=${encodeURIComponent(q)}`),
  mentions: (q: string) => request<{ results: MentionUser[] }>('GET', `/search/mentions?q=${encodeURIComponent(q)}`),
  userByWouaffId: (wouaffId: string) =>
    request<{ uid: string; profile: UserProfile }>('GET', `/search/users/${wouaffId.replace('@', '')}`),
};

/* ── Public profile lists (abonnés / abonnements) ── */
export interface FollowUser {
  uid: string;
  pseudo: string;
  avatar: string | null;
  wouaffId: string | null;
  isFollowing: boolean;
  isMe: boolean;
}

export const publicProfile = {
  followers: (wouaffId: string) =>
    request<{ users: FollowUser[] }>('GET', `/public/profile/${encodeURIComponent(wouaffId)}/followers`),
  following: (wouaffId: string) =>
    request<{ users: FollowUser[] }>('GET', `/public/profile/${encodeURIComponent(wouaffId)}/following`),
};

/* ── Admin ── */

export interface AdminPostRow {
  id: string;
  uid: string;
  text: string;
  image?: string | null;
  likesCount: number;
  repostsCount: number;
  commentsCount: number;
  createdAt: number;
  pseudo: string;
  avatar?: string | null;
  wouaffId?: string | null;
  staffUid?: string | null;
}

export interface AdminCommentRow {
  id: number;
  postId: string;
  uid: string;
  text: string;
  createdAt: number;
  pseudo: string;
  avatar?: string | null;
  postText?: string | null;
}

export interface AdminVideoRow {
  id: string;
  uid: string;
  videoPath: string;
  thumbnailPath?: string | null;
  caption?: string | null;
  duration?: number | null;
  likesCount: number;
  commentsCount: number;
  createdAt: number;
  pseudo?: string | null;
  avatar?: string | null;
  wouaffId?: string | null;
}

export interface AdminUserReportRow {
  id: number;
  reportedUid: string;
  reporterUid: string;
  reason: string | null;
  createdAt: number;
  reportedPseudo: string;
  reportedAvatar?: string | null;
  reportedWouaffId?: string | null;
  reporterPseudo: string;
}

export interface AdminPostReportRow {
  id: number;
  postId: string;
  reporterUid: string;
  reason: string | null;
  createdAt: number;
  postText: string;
  postImage?: string | null;
  postAuthorUid: string;
  postPseudo: string;
  postAvatar?: string | null;
  postWouaffId?: string | null;
  reporterPseudo: string;
}

export interface AdminReportedGroupRow {
  gid: string;
  name: string;
  reportedBy: string;
  reportedAt: number;
}

export interface AdminReportActionRow {
  id: number;
  reportType: string;
  reportId: string;
  action: string;
  createdAt: number;
  adminPseudo?: string;
  adminAvatar?: string;
}

export interface AdminLoginHistoryRow {
  id: number;
  uid: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: number;
}

export const admin = {
  staff: {
    list: () =>
      request<Record<string, { role: string; addedAt: number; profile?: UserProfile }>>('GET', '/admin/staff'),
    add: (uid: string, role?: string) => request<{ success: boolean }>('POST', `/admin/staff/${uid}`, { role }),
    setRole: (uid: string, role: string) =>
      request<{ success: boolean; role: string }>('PUT', `/admin/staff/${uid}/role`, { role }),
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
      posts: number;
      postComments: number;
      postLikes: number;
      postReposts: number;
      videos: number;
      videoLikes: number;
      videoComments: number;
      follows: number;
      userReports: number;
      postReports: number;
      reportedGroups: number;
      logins: number;
    }>('GET', '/admin/stats'),
  analytics: (days: number) =>
    request<{
      registrations: Array<{ date: string; count: number }>;
      posts: Array<{ date: string; count: number }>;
      messages: Array<{ date: string; count: number }>;
      topPosts: Array<{
        id: string;
        text: string;
        likesCount: number;
        commentsCount: number;
        createdAt: number;
        pseudo: string;
        avatar?: string;
      }>;
      topUsers: Array<{
        uid: string;
        pseudo: string;
        avatar?: string;
        wouaffId?: string;
        postCount: number;
        followingCount: number;
        followersCount: number;
      }>;
    }>('GET', `/admin/analytics?days=${days}`),
  search: (q: string) =>
    request<{
      users: Array<{ uid: string; pseudo: string; avatar?: string; wouaffId?: string; createdAt: number }>;
      posts: Array<{ id: string; text: string; uid: string; createdAt: number; pseudo: string; avatar?: string }>;
      videos: Array<{ id: string; caption?: string; uid: string; createdAt: number; pseudo: string }>;
      groups: Array<{ gid: string; name: string; description?: string; privacy: string; createdAt: number }>;
      messages: Array<{ convId: string; msgKey: string; text: string; fromUid: string; time: number }>;
    }>('GET', `/admin/search?q=${encodeURIComponent(q)}`),
  bans: {
    list: () =>
      request<
        Array<{
          uid: string;
          reason: string | null;
          bannedBy: string;
          createdAt: number;
          expiresAt: number | null;
          pseudo: string;
          avatar?: string;
          wouaffId?: string;
        }>
      >('GET', '/admin/bans'),
    ban: (uid: string, reason?: string, durationHours?: number) =>
      request<{ success: boolean }>('POST', '/admin/bans', { uid, reason, durationHours }),
    unban: (uid: string) => request<{ success: boolean }>('DELETE', `/admin/bans/${uid}`),
  },
  ipBans: {
    list: () =>
      request<
        Array<{
          id: number;
          ip: string;
          reason: string | null;
          bannedBy: string;
          createdAt: number;
          expiresAt: number | null;
        }>
      >('GET', '/admin/ip-bans'),
    ban: (ip: string, reason?: string, durationHours?: number) =>
      request<{ success: boolean }>('POST', '/admin/ip-bans', { ip, reason, durationHours }),
    unban: (id: number) => request<{ success: boolean }>('DELETE', `/admin/ip-bans/${id}`),
  },
  users: {
    recent: () => request<Record<string, UserProfile>>('GET', '/admin/users/recent'),
  },
  profile: {
    email: (uid: string) =>
      request<{ email: string | null; emailVerified: boolean }>('GET', `/admin/profile/${uid}/email`),
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
  loginHistory: (uid: string) => request<AdminLoginHistoryRow[]>('GET', `/admin/login-history/${uid}`),
  posts: {
    list: (limit = 30, uid?: string) =>
      request<AdminPostRow[]>('GET', `/admin/posts?limit=${limit}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`),
    delete: (id: string) => request<{ success: boolean }>('DELETE', `/admin/posts/${id}`),
  },
  comments: {
    list: (limit = 30) => request<AdminCommentRow[]>('GET', `/admin/comments?limit=${limit}`),
    delete: (id: number) => request<{ success: boolean }>('DELETE', `/admin/posts/comments/${id}`),
  },
  videos: {
    list: (limit = 30) => request<AdminVideoRow[]>('GET', `/admin/videos?limit=${limit}`),
    delete: (id: string) => request<{ success: boolean }>('DELETE', `/admin/videos/${id}`),
  },
  groups: {
    list: (limit = 50, q?: string) =>
      request<
        Array<{
          gid: string;
          name: string;
          description?: string;
          icon?: string;
          privacy: string;
          createdAt: number;
          createdBy: string;
          reported: number;
          memberCount: number;
        }>
      >('GET', `/admin/groups?limit=${limit}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
    detail: (gid: string) => request<Record<string, unknown>>('GET', `/admin/groups/${gid}`),
    update: (gid: string, data: Record<string, unknown>) =>
      request<{ success: boolean }>('PUT', `/admin/groups/${gid}`, data),
    setMemberRole: (gid: string, uid: string, role: string) =>
      request<{ success: boolean }>('PUT', `/admin/groups/${gid}/members/${uid}/role`, { role }),
    kickMember: (gid: string, uid: string) =>
      request<{ success: boolean }>('DELETE', `/admin/groups/${gid}/members/${uid}`),
    delete: (gid: string) => request<{ success: boolean }>('DELETE', `/admin/groups/${gid}`),
  },
  reports: {
    users: () => request<AdminUserReportRow[]>('GET', '/admin/reports/users'),
    posts: () => request<AdminPostReportRow[]>('GET', '/admin/reports/posts'),
    groups: () => request<AdminReportedGroupRow[]>('GET', '/admin/reports'),
    history: () => request<AdminReportActionRow[]>('GET', '/admin/reports/history'),
    clearUser: (id: number) => request<{ success: boolean }>('POST', `/admin/reports/users/${id}/clear`),
    clearPost: (id: number) => request<{ success: boolean }>('POST', `/admin/reports/posts/${id}/clear`),
    clearGroup: (gid: string) => request<{ success: boolean }>('POST', `/admin/groups/${gid}/report/clear`),
    deleteGroup: (gid: string) => request<{ success: boolean }>('DELETE', `/admin/groups/${gid}`),
  },
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
  list: (page = 1, limit = 20, uid?: string, tag?: string, feed?: 'forYou' | 'following') => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (uid) params.set('uid', uid);
    if (tag) params.set('tag', tag);
    if (feed) params.set('feed', feed);
    return request<FeedItem[]>('GET', `/posts?${params.toString()}`);
  },
  get: (id: string) => request<SocialPost>('GET', `/posts/${id}`),
  getPublic: (id: string) => request<SocialPost>('GET', `/public/posts/${id}`),
  create: (
    text: string,
    image?: string,
    audio?: string,
    audioDuration?: number,
    poll?: { question?: string; options: string[] },
    capToken?: string,
  ) => request<SocialPost>('POST', '/posts', { text, image, audio, audioDuration, poll, capToken }),
  vote: (id: string, option: number) => request<{ poll: PostPoll }>('POST', `/posts/${id}/vote`, { option }),
  like: (id: string) => request<{ liked: boolean; likes: number }>('POST', `/posts/${id}/like`),
  react: (id: string, type: string) =>
    request<{ reaction: string | null; reactions: PostReaction[]; total: number }>('POST', `/posts/${id}/reaction`, {
      type,
    }),
  repost: (id: string) =>
    request<{ reposted: boolean; reposts: number; item?: FeedItem }>('POST', `/posts/${id}/repost`),
  comments: (id: string) => request<PostComment[]>('GET', `/posts/${id}/comments`),
  addComment: (id: string, text: string, capToken?: string) =>
    request<PostComment>('POST', `/posts/${id}/comments`, { text, capToken }),
  delete: (id: string) => request<{ success: boolean }>('DELETE', `/posts/${id}`),
  deleteComment: (commentId: number) => request<{ success: boolean }>('DELETE', `/posts/comments/${commentId}`),
  likeComment: (commentId: number) =>
    request<{ liked: boolean; likes: number }>('POST', `/posts/comments/${commentId}/like`),
  report: (id: string, reason?: string) => request<{ success: boolean }>('POST', `/posts/${id}/report`, { reason }),
};

/* ── Tendances ── */
export const trends = {
  list: (limit = 10) => request<TrendItem[]>('GET', `/trends?limit=${limit}`),
};

/* ── GIFs (Giphy) ── */
export const gifs = {
  trending: () => request<{ results: GifResult[]; error?: string }>('GET', '/gifs/trending'),
  search: (q: string) =>
    request<{ results: GifResult[]; error?: string }>('GET', `/gifs/search?q=${encodeURIComponent(q)}`),
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
