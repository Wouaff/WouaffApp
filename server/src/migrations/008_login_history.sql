CREATE TABLE IF NOT EXISTS login_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  ip VARCHAR(45) DEFAULT NULL,
  userAgent TEXT DEFAULT NULL,
  createdAt BIGINT DEFAULT 0,
  INDEX idx_login_history_uid (uid),
  INDEX idx_login_history_ip (ip),
  INDEX idx_login_history_time (createdAt)
);

SET @sessionIpExists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sessions' AND COLUMN_NAME='ip');
SET @sql8a = IF(@sessionIpExists=0, 'ALTER TABLE sessions ADD COLUMN ip VARCHAR(45) DEFAULT NULL', 'SELECT 1');
PREPARE stmt8a FROM @sql8a;
EXECUTE stmt8a;
DEALLOCATE PREPARE stmt8a;

SET @sessionUaExists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sessions' AND COLUMN_NAME='userAgent');
SET @sql8b = IF(@sessionUaExists=0, 'ALTER TABLE sessions ADD COLUMN userAgent TEXT DEFAULT NULL', 'SELECT 1');
PREPARE stmt8b FROM @sql8b;
EXECUTE stmt8b;
DEALLOCATE PREPARE stmt8b;
