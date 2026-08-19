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
  wouaffId?: string;
  ownedBadges?: string[];
}

export interface VideoComment {
  id: number;
  videoId: string;
  uid: string;
  text: string;
  createdAt: number;
  pseudo?: string;
  avatar?: string;
  ownedBadges?: string[];
  verified?: boolean;
}

export interface PostPoll {
  question: string;
  options: string[];
  votes: number[];
  total: number;
  votedIndex: number | null;
}

export interface GifResult {
  id: string;
  url: string;
  preview: string;
  title: string;
}

export interface SocialPost {
  id: string;
  uid?: string;
  pseudo: string;
  handle: string;
  avatar?: string;
  time: number;
  text: string;
  image?: string;
  audio?: string;
  audioDuration?: number;
  poll?: PostPoll | null;
  likes: number;
  reposts: number;
  comments: number;
  liked?: boolean;
  reposted?: boolean;
  verified?: boolean;
  ownedBadges?: string[];
}

export interface TrendItem {
  tag: string;
  category: string;
  posts: string;
}

export interface MentionUser {
  uid: string;
  pseudo: string;
  handle: string;
  avatar?: string;
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
  handle?: string;
  avatar?: string;
  ownedBadges?: string[];
  verified?: boolean;
  likes: number;
  liked: boolean;
}

export interface RepostInfo {
  uid: string;
  pseudo: string;
  handle: string;
  avatar?: string;
  verified?: boolean;
  time: number;
}

export interface FeedItem {
  type: 'post' | 'repost';
  key: string;
  post: SocialPost;
  repost?: RepostInfo;
}

export type NotificationType = 'follow' | 'like' | 'repost' | 'comment' | 'community_reply' | 'community_mention';

export interface NotificationItem {
  id: number;
  type: NotificationType;
  actorUid: string;
  actorPseudo: string;
  actorHandle: string;
  actorAvatar?: string;
  postId?: string | null;
  postText?: string | null;
  postImage?: string | null;
  commentId?: number | null;
  read: boolean;
  createdAt: number;
}

/* ── Communautés (type Subreddit) ── */

export type CommunityRole = 'member' | 'moderator' | 'admin';

export interface Community {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  category: string;
  rules: string[];
  avatar: string | null;
  banner: string | null;
  creatorId: string;
  isPrivate: boolean;
  createdAt: number;
  memberCount: number;
  postCount: number;
  isSubscribed: boolean;
  myRole: CommunityRole | null;
}

export type CommunitySort = 'new' | 'top' | 'hot';
export type CommunityTopWindow = 'day' | 'week' | 'month';
export type CommunityPostType = 'text' | 'link' | 'image';

export interface CommunityPost {
  id: string;
  communityId: string;
  communityName: string;
  communityDisplayName: string | null;
  communityAvatar: string | null;
  authorId: string;
  authorPseudo: string;
  authorAvatar: string | null;
  title: string;
  content: string | null;
  type: CommunityPostType;
  upvotes: number;
  downvotes: number;
  score: number;
  commentCount: number;
  isPinned: boolean;
  createdAt: number;
  vote: -1 | 0 | 1;
}

export interface CommunityComment {
  id: number;
  postId: string;
  authorId: string;
  authorPseudo: string;
  authorAvatar: string | null;
  content: string;
  upvotes: number;
  createdAt: number;
  deleted: boolean;
}

export interface CommunityDiscoverResponse {
  categories: string[];
  groups: Array<{ category: string; items: Community[] }>;
}
