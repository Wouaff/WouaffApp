CREATE TABLE IF NOT EXISTS users (
  uid VARCHAR(128) NOT NULL PRIMARY KEY,
  pseudo VARCHAR(30) NOT NULL,
  email VARCHAR(255) NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,
  displayName VARCHAR(50) NULL,
  avatar VARCHAR(500) NULL,
  banner VARCHAR(500) NULL,
  bio VARCHAR(255) NULL,
  location VARCHAR(100) NULL,
  website VARCHAR(255) NULL,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  createdAt BIGINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_users_pseudo (pseudo),
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  expires_at BIGINT NOT NULL,
  user_agent VARCHAR(255) NULL,
  KEY idx_sessions_uid (uid),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (uid) REFERENCES users (uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS posts (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  text TEXT NULL,
  image VARCHAR(500) NULL,
  repost_of BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_posts_uid_created (uid, created_at),
  KEY idx_posts_created (created_at),
  KEY idx_posts_repost (repost_of),
  CONSTRAINT fk_posts_user FOREIGN KEY (uid) REFERENCES users (uid) ON DELETE CASCADE,
  CONSTRAINT fk_posts_repost FOREIGN KEY (repost_of) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS likes (
  uid VARCHAR(128) NOT NULL,
  post_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (uid, post_id),
  KEY idx_likes_post (post_id),
  CONSTRAINT fk_likes_user FOREIGN KEY (uid) REFERENCES users (uid) ON DELETE CASCADE,
  CONSTRAINT fk_likes_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS comments (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT NOT NULL,
  uid VARCHAR(128) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_comments_post (post_id, created_at),
  KEY idx_comments_uid (uid),
  CONSTRAINT fk_comments_user FOREIGN KEY (uid) REFERENCES users (uid) ON DELETE CASCADE,
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS follows (
  follower_uid VARCHAR(128) NOT NULL,
  followed_uid VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_uid, followed_uid),
  KEY idx_follows_followed (followed_uid),
  CONSTRAINT fk_follows_follower FOREIGN KEY (follower_uid) REFERENCES users (uid) ON DELETE CASCADE,
  CONSTRAINT fk_follows_followed FOREIGN KEY (followed_uid) REFERENCES users (uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  type VARCHAR(20) NOT NULL,
  actor_uid VARCHAR(128) NULL,
  post_id BIGINT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifs_uid (uid, is_read, created_at),
  CONSTRAINT fk_notifs_user FOREIGN KEY (uid) REFERENCES users (uid) ON DELETE CASCADE,
  CONSTRAINT fk_notifs_actor FOREIGN KEY (actor_uid) REFERENCES users (uid) ON DELETE CASCADE,
  CONSTRAINT fk_notifs_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
