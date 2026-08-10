CREATE TABLE IF NOT EXISTS hashtag_occurrences (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  postId VARCHAR(36) NOT NULL,
  tag VARCHAR(80) NOT NULL,
  uid VARCHAR(128) NOT NULL,
  kind ENUM('post','repost') DEFAULT 'post',
  createdAt BIGINT NOT NULL,
  INDEX idx_hoc_tag_time (tag, createdAt),
  INDEX idx_hoc_post (postId),
  INDEX idx_hoc_uid_kind (uid, kind, postId)
);
