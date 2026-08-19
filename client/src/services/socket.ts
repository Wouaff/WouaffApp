import { io, type Socket } from 'socket.io-client';
import type {
  CallPayload,
  FeedItem,
  NotificationItem,
  PostComment,
  PostPoll,
  SocialPost,
  SocketMessageEvent,
} from '../types';
import { getSessionId } from './auth';

const SOCKET_URL = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL
  ? (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_URL
  : 'https://wouaff.app';

let socket: Socket | null = null;
const pendingListeners: Array<{ event: string; cb: (...args: unknown[]) => void }> = [];

function attachPendingListeners(sock: Socket) {
  for (const { event, cb } of pendingListeners) {
    sock.on(event, cb);
  }
}

function setSocket(newSocket: Socket | null) {
  socket = newSocket;
  if (newSocket) {
    attachPendingListeners(newSocket);
  }
}

export function connectSocket(): Socket {
  if (socket?.connected) return socket;
  const sessionId = getSessionId();
  const newSocket = io(SOCKET_URL, {
    auth: { session_id: sessionId },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 20000,
  });
  newSocket.on('connect_error', (err) => {
    console.warn('[Socket] connect_error:', err.message);
  });
  newSocket.on('error', (err) => {
    console.warn('[Socket] error:', err);
  });
  newSocket.on('connect', () => {
    for (const cb of connectionCallbacks) cb(true);
  });
  newSocket.on('disconnect', () => {
    for (const cb of connectionCallbacks) cb(false);
  });
  setSocket(newSocket);
  return socket!;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    setSocket(null);
  }
}

export function getSocket(): Socket | null {
  return socket;
}

/* ── Connection status ── */

type ConnectionCallback = (connected: boolean) => void;
const connectionCallbacks: ConnectionCallback[] = [];

export function onConnectionChange(cb: ConnectionCallback): void {
  connectionCallbacks.push(cb);
}
export function offConnectionChange(cb: ConnectionCallback): void {
  const idx = connectionCallbacks.indexOf(cb);
  if (idx !== -1) connectionCallbacks.splice(idx, 1);
}
export function isConnected(): boolean {
  return socket?.connected ?? false;
}

export function joinDM(otherUid: string): void {
  socket?.emit('join:dm', otherUid);
}

export function leaveDM(): void {
  socket?.emit('leave:dm');
}

export function joinGroup(gid: string): void {
  socket?.emit('join:group', gid);
}

export function leaveGroup(): void {
  socket?.emit('leave:group');
}

export function emitTypingDM(otherUid: string, isTyping: boolean): void {
  socket?.emit('typing:dm', otherUid, isTyping);
}

export function emitTypingGroup(gid: string, isTyping: boolean): void {
  socket?.emit('typing:group', gid, isTyping);
}

export function emitSeen(otherUid: string, msgKeys: string[]): void {
  socket?.emit('seen', otherUid, msgKeys);
}

export function onMessageAdded(cb: (ev: SocketMessageEvent) => void): void {
  socket?.on('message:added', cb);
}

export function offMessageAdded(cb: (ev: SocketMessageEvent) => void): void {
  socket?.off('message:added', cb);
}

export function onMessageUpdated(cb: (ev: SocketMessageEvent) => void): void {
  socket?.on('message:updated', cb);
}

export function offMessageUpdated(cb: (ev: SocketMessageEvent) => void): void {
  socket?.off('message:updated', cb);
}

export function onMessageRemoved(cb: (ev: { convId: string; key: string }) => void): void {
  socket?.on('message:removed', cb);
}

export function offMessageRemoved(cb: (ev: { convId: string; key: string }) => void): void {
  socket?.off('message:removed', cb);
}

export function onTyping(cb: (ev: { from: string; isTyping: boolean }) => void): void {
  socket?.on('typing', cb);
}

export function offTyping(cb: (ev: { from: string; isTyping: boolean }) => void): void {
  socket?.off('typing', cb);
}

export function onSeen(cb: (ev: { by: string; msgKeys: string[] }) => void): void {
  socket?.on('seen', cb);
}

export function offSeen(cb: (ev: { by: string; msgKeys: string[] }) => void): void {
  socket?.off('seen', cb);
}

/* ── Status ── */

export function onStatusChanged(cb: (data: { uid: string; status: string }) => void): void {
  socket?.on('status:changed', cb);
}

export function offStatusChanged(cb: (data: { uid: string; status: string }) => void): void {
  socket?.off('status:changed', cb);
}

/* ── Contact added ── */

export function onContactAdded(cb: (data: { by: string; profile: Record<string, unknown> }) => void): void {
  socket?.on('contact:added', cb);
}

export function offContactAdded(cb: (data: { by: string; profile: Record<string, unknown> }) => void): void {
  socket?.off('contact:added', cb);
}

/* ── Call signaling ── */

function onCallEvent<T>(event: string, cb: (data: T) => void) {
  pendingListeners.push({ event, cb: cb as (...args: unknown[]) => void });
  socket?.on(event, cb as (...args: unknown[]) => void);
}

function offCallEvent<T>(event: string, cb: (data: T) => void) {
  const idx = pendingListeners.findIndex((l) => l.event === event && l.cb === (cb as (...args: unknown[]) => void));
  if (idx !== -1) pendingListeners.splice(idx, 1);
  socket?.off(event, cb as (...args: unknown[]) => void);
}

export function emitCallOffer(payload: CallPayload): void {
  socket?.emit('call:offer', payload);
}

export function emitCallAccept(payload: CallPayload): void {
  socket?.emit('call:accept', payload);
}

export function emitCallAnswer(payload: CallPayload): void {
  socket?.emit('call:answer', payload);
}

export function emitCallICE(payload: CallPayload): void {
  socket?.emit('call:ice-candidate', payload);
}

export function emitCallEnd(payload: CallPayload): void {
  socket?.emit('call:end', payload);
}

export function emitCallReject(payload: CallPayload): void {
  socket?.emit('call:reject', payload);
}

export function onCallIncoming(cb: (data: CallPayload) => void): void {
  onCallEvent('call:incoming', cb);
}

export function offCallIncoming(cb: (data: CallPayload) => void): void {
  offCallEvent('call:incoming', cb);
}

export function onCallAccepted(cb: (data: CallPayload) => void): void {
  onCallEvent('call:accepted', cb);
}

export function offCallAccepted(cb: (data: CallPayload) => void): void {
  offCallEvent('call:accepted', cb);
}

export function onCallAnswer(cb: (data: CallPayload) => void): void {
  onCallEvent('call:answer', cb);
}

export function offCallAnswer(cb: (data: CallPayload) => void): void {
  offCallEvent('call:answer', cb);
}

export function onCallICE(cb: (data: CallPayload) => void): void {
  onCallEvent('call:ice-candidate', cb);
}

export function offCallICE(cb: (data: CallPayload) => void): void {
  offCallEvent('call:ice-candidate', cb);
}

export function onCallEnded(cb: (data: CallPayload) => void): void {
  onCallEvent('call:ended', cb);
}

export function offCallEnded(cb: (data: CallPayload) => void): void {
  offCallEvent('call:ended', cb);
}

export function onCallRejected(cb: (data: CallPayload) => void): void {
  onCallEvent('call:rejected', cb);
}

export function offCallRejected(cb: (data: CallPayload) => void): void {
  offCallEvent('call:rejected', cb);
}

/* ── Group events ── */

export function onGroupCreated(cb: (data: { gid: string; name: string; icon: string }) => void): void {
  socket?.on('group:created', cb);
}
export function offGroupCreated(cb: (data: { gid: string; name: string; icon: string }) => void): void {
  socket?.off('group:created', cb);
}

export function onGroupUpdated(cb: (data: { gid: string } & Record<string, unknown>) => void): void {
  socket?.on('group:updated', cb);
}
export function offGroupUpdated(cb: (data: { gid: string } & Record<string, unknown>) => void): void {
  socket?.off('group:updated', cb);
}

export function onGroupDeleted(cb: (data: { gid: string }) => void): void {
  socket?.on('group:deleted', cb);
}
export function offGroupDeleted(cb: (data: { gid: string }) => void): void {
  socket?.off('group:deleted', cb);
}

export function onGroupMemberAdded(
  cb: (data: { gid: string; uid?: string; profile?: Record<string, unknown>; name?: string; kicked?: boolean }) => void,
): void {
  socket?.on('group:member:added', cb);
}
export function offGroupMemberAdded(
  cb: (data: { gid: string; uid?: string; profile?: Record<string, unknown>; name?: string; kicked?: boolean }) => void,
): void {
  socket?.off('group:member:added', cb);
}

export function onGroupMemberRemoved(cb: (data: { gid: string; uid?: string; kicked?: boolean }) => void): void {
  socket?.on('group:member:removed', cb);
}
export function offGroupMemberRemoved(cb: (data: { gid: string; uid?: string; kicked?: boolean }) => void): void {
  socket?.off('group:member:removed', cb);
}

export function onGroupRoleChanged(cb: (data: { gid: string; uid: string; role: string }) => void): void {
  socket?.on('group:role:changed', cb);
}
export function offGroupRoleChanged(cb: (data: { gid: string; uid: string; role: string }) => void): void {
  socket?.off('group:role:changed', cb);
}

/* ── Story events ── */

export function onStoryAdded(
  cb: (data: { uid: string; storyId: string; media: string; type: string; timestamp: number }) => void,
): void {
  socket?.on('story:added', cb);
}
export function offStoryAdded(
  cb: (data: { uid: string; storyId: string; media: string; type: string; timestamp: number }) => void,
): void {
  socket?.off('story:added', cb);
}

export function onStoryViewed(cb: (data: { storyId: string; viewedBy: string }) => void): void {
  socket?.on('story:viewed', cb);
}
export function offStoryViewed(cb: (data: { storyId: string; viewedBy: string }) => void): void {
  socket?.off('story:viewed', cb);
}

export function onStoryRemoved(cb: (data: { uid: string; storyId: string }) => void): void {
  socket?.on('story:removed', cb);
}
export function offStoryRemoved(cb: (data: { uid: string; storyId: string }) => void): void {
  socket?.off('story:removed', cb);
}

/* ── Profile events ── */

export function onProfileUpdated(cb: (data: { uid: string } & Record<string, unknown>) => void): void {
  socket?.on('profile:updated', cb);
}
export function offProfileUpdated(cb: (data: { uid: string } & Record<string, unknown>) => void): void {
  socket?.off('profile:updated', cb);
}

export function onKeyChanged(cb: (data: { uid: string }) => void): void {
  socket?.on('key:changed', cb);
}
export function offKeyChanged(cb: (data: { uid: string }) => void): void {
  socket?.off('key:changed', cb);
}

export function onAccountDeleted(cb: (data: { uid: string }) => void): void {
  socket?.on('account:deleted', cb);
}
export function offAccountDeleted(cb: (data: { uid: string }) => void): void {
  socket?.off('account:deleted', cb);
}

/* ── Contact removed ── */

export function onContactRemoved(cb: (data: { by: string }) => void): void {
  socket?.on('contact:removed', cb);
}
export function offContactRemoved(cb: (data: { by: string }) => void): void {
  socket?.off('contact:removed', cb);
}

/* ── Contact request events ── */

export function onContactRequest(cb: (data: { from: string; profile: Record<string, unknown> }) => void): void {
  socket?.on('contact:request', cb);
}
export function offContactRequest(cb: (data: { from: string; profile: Record<string, unknown> }) => void): void {
  socket?.off('contact:request', cb);
}

export function onContactRequestAccepted(cb: (data: { by: string; profile: Record<string, unknown> }) => void): void {
  socket?.on('contact:request:accepted', cb);
}
export function offContactRequestAccepted(cb: (data: { by: string; profile: Record<string, unknown> }) => void): void {
  socket?.off('contact:request:accepted', cb);
}

export function onContactRequestRejected(cb: (data: { by: string }) => void): void {
  socket?.on('contact:request:rejected', cb);
}
export function offContactRequestRejected(cb: (data: { by: string }) => void): void {
  socket?.off('contact:request:rejected', cb);
}

/* ── Group seen events ── */

export function onGroupSeen(cb: (data: { gid: string; by: string; msgKeys: string[] }) => void): void {
  socket?.on('seen:group', cb);
}
export function offGroupSeen(cb: (data: { gid: string; by: string; msgKeys: string[] }) => void): void {
  socket?.off('seen:group', cb);
}

/* ── Video events ── */

export function onVideoNew(cb: (data: unknown) => void): void {
  socket?.on('video:new', cb);
}
export function offVideoNew(cb: (data: unknown) => void): void {
  socket?.off('video:new', cb);
}

export function onVideoLiked(cb: (data: { videoId: string; uid: string; liked: boolean }) => void): void {
  socket?.on('video:liked', cb);
}
export function offVideoLiked(cb: (data: { videoId: string; uid: string; liked: boolean }) => void): void {
  socket?.off('video:liked', cb);
}

export function onVideoComment(cb: (data: { videoId: string; comment: unknown }) => void): void {
  socket?.on('video:comment', cb);
}
export function offVideoComment(cb: (data: { videoId: string; comment: unknown }) => void): void {
  socket?.off('video:comment', cb);
}

/* ── Post events (feed social) ── */

export function onPostNew(cb: (data: SocialPost) => void): void {
  socket?.on('post:new', cb);
}
export function offPostNew(cb: (data: SocialPost) => void): void {
  socket?.off('post:new', cb);
}

export function onPostLiked(cb: (data: { postId: string; uid: string; liked: boolean; likes: number }) => void): void {
  socket?.on('post:liked', cb);
}
export function offPostLiked(cb: (data: { postId: string; uid: string; liked: boolean; likes: number }) => void): void {
  socket?.off('post:liked', cb);
}

export function onPostReposted(
  cb: (data: { postId: string; uid: string; reposted: boolean; reposts: number }) => void,
): void {
  socket?.on('post:reposted', cb);
}
export function offPostReposted(
  cb: (data: { postId: string; uid: string; reposted: boolean; reposts: number }) => void,
): void {
  socket?.off('post:reposted', cb);
}

export function onPostComment(cb: (data: { postId: string; comment: PostComment }) => void): void {
  socket?.on('post:comment', cb);
}
export function offPostComment(cb: (data: { postId: string; comment: PostComment }) => void): void {
  socket?.off('post:comment', cb);
}

export function onCommentLiked(
  cb: (data: { commentId: number; postId: string; uid: string; liked: boolean; likes: number }) => void,
): void {
  socket?.on('comment:liked', cb);
}
export function offCommentLiked(
  cb: (data: { commentId: number; postId: string; uid: string; liked: boolean; likes: number }) => void,
): void {
  socket?.off('comment:liked', cb);
}

export function onPostDeleted(cb: (data: { postId: string }) => void): void {
  socket?.on('post:deleted', cb);
}
export function offPostDeleted(cb: (data: { postId: string }) => void): void {
  socket?.off('post:deleted', cb);
}

export function onPostPoll(cb: (data: { postId: string; poll: PostPoll }) => void): void {
  socket?.on('post:poll', cb);
}
export function offPostPoll(cb: (data: { postId: string; poll: PostPoll }) => void): void {
  socket?.off('post:poll', cb);
}

export function onPostRepost(cb: (item: FeedItem) => void): void {
  socket?.on('post:repost', cb);
}
export function offPostRepost(cb: (item: FeedItem) => void): void {
  socket?.off('post:repost', cb);
}

export function onPostUnrepost(cb: (data: { postId: string; uid: string }) => void): void {
  socket?.on('post:unrepost', cb);
}
export function offPostUnrepost(cb: (data: { postId: string; uid: string }) => void): void {
  socket?.off('post:unrepost', cb);
}

/* ── Block events ── */

export function onBlockChanged(cb: (data: { by: string; blocked: boolean }) => void): void {
  socket?.on('block:changed', cb);
}
export function offBlockChanged(cb: (data: { by: string; blocked: boolean }) => void): void {
  socket?.off('block:changed', cb);
}

/* ── Notification events ── */

export function onNotificationNew(cb: (item: NotificationItem) => void): void {
  socket?.on('notification:new', cb);
}
export function offNotificationNew(cb: (item: NotificationItem) => void): void {
  socket?.off('notification:new', cb);
}

/* ── Ban events ── */

export function onAccountBanned(cb: (data: { reason: string | null; expiresAt: number | null }) => void): void {
  socket?.on('account:banned', cb);
}
export function offAccountBanned(cb: (data: { reason: string | null; expiresAt: number | null }) => void): void {
  socket?.off('account:banned', cb);
}
