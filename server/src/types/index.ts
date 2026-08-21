export interface AuthRequest extends Express.Request {
  uid?: string;
}

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
  ephemeralDuration?: number;
  [key: string]: unknown;
}

export interface ConversationData {
  profile: Record<string, unknown>;
  lastMsg: MessageData | null;
  lastTime: number;
  type: string;
}

export interface GroupData {
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

export interface SeenUpdate {
  [msgKey: string]: number;
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

export interface PostReaction {
  type: string;
  count: number;
}

export interface PostData {
  id: string;
  uid: string;
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
  myReaction: string | null;
  reactions: PostReaction[];
  reposted: boolean;
  verified: boolean;
  ownedBadges?: string[];
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

export interface PostFeedItem {
  type: 'post' | 'repost';
  key: string;
  post: PostData;
  repost?: RepostInfo;
}

export type NotificationType =
  | 'follow'
  | 'like'
  | 'repost'
  | 'comment'
  | 'community_reply'
  | 'community_mention'
  | 'mention';

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
