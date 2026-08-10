CREATE TABLE IF NOT EXISTS post_reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  postId VARCHAR(36) NOT NULL,
  reporterUid VARCHAR(128) NOT NULL,
  reason TEXT DEFAULT NULL,
  createdAt BIGINT DEFAULT 0,
  UNIQUE KEY uk_post_report (postId, reporterUid),
  INDEX idx_post_reports_post (postId)
);
