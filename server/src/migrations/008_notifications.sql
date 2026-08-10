CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  actorUid VARCHAR(128) NOT NULL,
  type VARCHAR(20) NOT NULL,
  postId VARCHAR(36) DEFAULT NULL,
  commentId BIGINT DEFAULT NULL,
  read TINYINT(1) DEFAULT 0,
  createdAt BIGINT DEFAULT 0,
  INDEX idx_notifications_uid (uid, read, createdAt)
);
