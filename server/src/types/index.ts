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

export interface PostData {
  id: string;
  uid: string;
  pseudo: string;
  handle: string;
  avatar?: string;
  time: number;
  text: string;
  image?: string;
  likes: number;
  reposts: number;
  comments: number;
  liked: boolean;
  reposted: boolean;
  verified: boolean;
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
