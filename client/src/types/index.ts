export interface MessageData {
  from: string;
  text?: string;
  time: number;
  type?: string;
  messageTheme?: string;
  deleted?: boolean;
  edited?: boolean;
  replyTo?: string;
  pendingFrom?: string;
  senderName?: string;
  ct?: string;
  iv?: string;
  encrypted?: boolean;
  seen?: number;
  imageData?: string;
  fileData?: string;
  fileName?: string;
  audioData?: string;
  duration?: number;
  contact?: Record<string, string>;
  html?: string;
  reactions?: Record<string, string>;
  seenBy?: string[];
  pinned?: boolean;
  forwardedFrom?: string;
  forwardedSenderName?: string;
  ephemeralDuration?: number;
  [key: string]: unknown;
}

export interface ConversationEntry {
  profile: Record<string, unknown>;
  lastMsg: MessageData | null;
  lastTime: number;
  type: string;
}

export interface GroupEntry {
  group: {
    name: string;
    description?: string;
    icon?: string;
    privacy?: string;
    members?: Record<string, { role: string; joinedAt: number }>;
  };
  lastMsg: MessageData | null;
  lastTime: number;
  type: string;
}

export interface ConversationsData {
  dms: Record<string, ConversationEntry>;
  groups: Record<string, GroupEntry>;
}

export interface UserProfile {
  uid: string;
  pseudo?: string;
  avatar?: string;
  bio?: string;
  status?: string;
  messageTheme?: string;
  email?: string;
  publicKey?: Record<string, unknown>;
  banner?: string;
  wouaffId?: string;
  ownedBadges?: string[] | Record<string, string>;
  role?: string;
  vipTrial?: { active: boolean; expiresAt: number };
  lastSeen?: number;
  discordId?: string;
  social_links?: string;
  [key: string]: unknown;
}

export interface GroupData {
  name: string;
  description?: string;
  icon?: string;
  privacy?: string;
  createdAt?: number;
  createdBy?: string;
  inviteId?: string;
  members?: Record<string, { role: string; joinedAt: number }>;
  msgs?: Record<string, MessageData>;
  [key: string]: unknown;
}

export interface StoryData {
  media: string;
  type: string;
  timestamp: number;
  expiresAt: number;
  viewedBy?: Record<string, boolean>;
  audioData?: string;
  audioName?: string;
  audioStartTime?: number;
  audioExtractDuration?: number;
  description?: string;
}

export interface SocketMessageEvent {
  convId: string;
  key: string;
  data: MessageData;
  isGroup?: boolean;
}

export interface SearchResult {
  uid: string;
  wouaffId: string;
  profile: UserProfile | null;
}

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

export interface CallPayload {
  from: string;
  to: string;
  sdp?: string;
  ice?: RTCIceCandidate;
  duration?: number;
}

export interface CallerInfo {
  uid: string;
  pseudo: string;
  avatar?: string;
}

export interface VideoData {
  id: string;
  uid: string;
  videoPath: string;
  thumbnailPath?: string;
  caption?: string;
  duration?: number;
  location?: { lat: number; lng: number; name?: string } | null;
  likesCount: number;
  commentsCount: number;
  createdAt: number;
  liked?: boolean;
  pseudo?: string;
  avatar?: string;
}

export interface VideoComment {
  id: number;
  videoId: string;
  uid: string;
  text: string;
  createdAt: number;
  pseudo?: string;
  avatar?: string;
}

export interface SocialPost {
  id: string;
  pseudo: string;
  handle: string;
  avatar?: string;
  time: number;
  text: string;
  likes: number;
  reposts: number;
  comments: number;
  liked?: boolean;
  reposted?: boolean;
  verified?: boolean;
}

export interface TrendItem {
  tag: string;
  category: string;
  posts: string;
}

export interface SuggestedUser {
  pseudo: string;
  handle: string;
  bio: string;
  avatar?: string;
}

export interface PostComment {
  id: number;
  postId: string;
  uid: string;
  text: string;
  createdAt: number;
  pseudo?: string;
  avatar?: string;
}
