SET @postEditedAtExists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='posts' AND COLUMN_NAME='editedAt');
SET @sqlPostEditedAt = IF(@postEditedAtExists=0, 'ALTER TABLE posts ADD COLUMN editedAt BIGINT DEFAULT 0 AFTER createdAt', 'SELECT 1');
PREPARE stmtPostEditedAt FROM @sqlPostEditedAt;
EXECUTE stmtPostEditedAt;
DEALLOCATE PREPARE stmtPostEditedAt;

CREATE TABLE IF NOT EXISTS post_edits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  postId VARCHAR(36) NOT NULL,
  editorUid VARCHAR(128) NOT NULL,
  text TEXT CHARACTER SET utf8mb4 NOT NULL,
  image TEXT DEFAULT NULL,
  audio TEXT DEFAULT NULL,
  audioDuration INT DEFAULT 0,
  poll TEXT DEFAULT NULL,
  editedAt BIGINT NOT NULL,
  INDEX idx_post_edits_post (postId, editedAt)
);

CREATE TABLE IF NOT EXISTS app_settings (
  settingKey VARCHAR(128) PRIMARY KEY,
  settingValue VARCHAR(255) NOT NULL
);

INSERT IGNORE INTO app_settings (settingKey, settingValue)
VALUES ('post_edit_window_minutes', '30');
