/* ─────────────────────────────────────────────────────────────
   Système communautaire type Subreddit (r/nom)
   Tables : communities, community_members, subscriptions,
            community_posts, community_votes, community_comments,
            community_bans, community_mentions
   RGPD : pas de tracking, timestamps en ms (BIGINT) comme le reste du schéma.
   ───────────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS communities (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  displayName VARCHAR(100) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'Autre',
  rules TEXT DEFAULT NULL,
  avatar TEXT DEFAULT NULL,
  banner TEXT DEFAULT NULL,
  creatorId VARCHAR(128) NOT NULL,
  isPrivate TINYINT(1) DEFAULT 0,
  createdAt BIGINT DEFAULT 0,
  UNIQUE KEY uk_communities_name (name),
  INDEX idx_communities_category (category, createdAt),
  INDEX idx_communities_creator (creatorId),
  INDEX idx_communities_popular (isPrivate, createdAt)
);

CREATE TABLE IF NOT EXISTS community_members (
  communityId VARCHAR(36) NOT NULL,
  userId VARCHAR(128) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  joinedAt BIGINT DEFAULT 0,
  PRIMARY KEY (communityId, userId),
  INDEX idx_community_members_user (userId)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  userId VARCHAR(128) NOT NULL,
  communityId VARCHAR(36) NOT NULL,
  createdAt BIGINT DEFAULT 0,
  PRIMARY KEY (userId, communityId),
  INDEX idx_subscriptions_community (communityId)
);

CREATE TABLE IF NOT EXISTS community_posts (
  id VARCHAR(36) PRIMARY KEY,
  communityId VARCHAR(36) NOT NULL,
  authorId VARCHAR(128) NOT NULL,
  title VARCHAR(300) NOT NULL,
  content TEXT DEFAULT NULL,
  type VARCHAR(10) NOT NULL DEFAULT 'text',
  upvotes INT DEFAULT 0,
  downvotes INT DEFAULT 0,
  commentCount INT DEFAULT 0,
  isPinned TINYINT(1) DEFAULT 0,
  createdAt BIGINT DEFAULT 0,
  deletedAt BIGINT DEFAULT NULL,
  INDEX idx_community_posts_feed (communityId, isPinned, createdAt),
  INDEX idx_community_posts_author (authorId),
  INDEX idx_community_posts_time (createdAt)
);

CREATE TABLE IF NOT EXISTS community_votes (
  communityId VARCHAR(36) NOT NULL,
  postId VARCHAR(36) NOT NULL,
  userId VARCHAR(128) NOT NULL,
  voteValue TINYINT NOT NULL,
  createdAt BIGINT DEFAULT 0,
  PRIMARY KEY (postId, userId),
  INDEX idx_community_votes_community (communityId)
);

CREATE TABLE IF NOT EXISTS community_comments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  communityId VARCHAR(36) NOT NULL,
  postId VARCHAR(36) NOT NULL,
  authorId VARCHAR(128) NOT NULL,
  parentId BIGINT DEFAULT NULL,
  content TEXT NOT NULL,
  upvotes INT DEFAULT 0,
  createdAt BIGINT DEFAULT 0,
  deletedAt BIGINT DEFAULT NULL,
  INDEX idx_community_comments_post (postId, createdAt),
  INDEX idx_community_comments_author (authorId)
);

CREATE TABLE IF NOT EXISTS community_bans (
  communityId VARCHAR(36) NOT NULL,
  userId VARCHAR(128) NOT NULL,
  reason TEXT DEFAULT NULL,
  bannedBy VARCHAR(128) NOT NULL,
  createdAt BIGINT DEFAULT 0,
  expiresAt BIGINT DEFAULT NULL,
  PRIMARY KEY (communityId, userId),
  INDEX idx_community_bans_expires (expiresAt)
);

CREATE TABLE IF NOT EXISTS community_mentions (
  communityId VARCHAR(36) NOT NULL,
  postId VARCHAR(36) NOT NULL,
  userId VARCHAR(128) NOT NULL,
  commentId BIGINT NOT NULL DEFAULT 0,
  createdAt BIGINT DEFAULT 0,
  PRIMARY KEY (postId, userId, commentId),
  INDEX idx_community_mentions_user (userId, createdAt)
);
