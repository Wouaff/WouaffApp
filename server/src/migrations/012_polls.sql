SET @postPollExists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='posts' AND COLUMN_NAME='poll');
SET @sql1 = IF(@postPollExists=0, 'ALTER TABLE posts ADD COLUMN poll TEXT DEFAULT NULL', 'SELECT 1');
PREPARE stmt1 FROM @sql1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

CREATE TABLE IF NOT EXISTS poll_votes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  postId VARCHAR(36) NOT NULL,
  uid VARCHAR(128) NOT NULL,
  optionIndex INT NOT NULL,
  createdAt BIGINT DEFAULT 0,
  UNIQUE KEY uk_poll_vote (postId, uid),
  INDEX idx_poll_votes_post (postId)
);
