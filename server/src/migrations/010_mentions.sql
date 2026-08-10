CREATE TABLE IF NOT EXISTS post_mentions (
  postId VARCHAR(36) NOT NULL,
  uid VARCHAR(128) NOT NULL,
  createdAt BIGINT NOT NULL,
  PRIMARY KEY (postId, uid),
  INDEX idx_post_mentions_uid (uid, createdAt)
);

CREATE TABLE IF NOT EXISTS comment_mentions (
  commentId BIGINT NOT NULL,
  uid VARCHAR(128) NOT NULL,
  createdAt BIGINT NOT NULL,
  PRIMARY KEY (commentId, uid),
  INDEX idx_comment_mentions_uid (uid, createdAt)
);
