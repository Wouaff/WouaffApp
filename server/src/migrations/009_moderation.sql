CREATE TABLE IF NOT EXISTS bans (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  reason TEXT DEFAULT NULL,
  bannedBy VARCHAR(128) NOT NULL,
  createdAt BIGINT DEFAULT 0,
  expiresAt BIGINT DEFAULT NULL,
  UNIQUE KEY uk_bans_uid (uid),
  INDEX idx_bans_expires (expiresAt)
);

CREATE TABLE IF NOT EXISTS report_actions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  reportType VARCHAR(20) NOT NULL,
  reportId VARCHAR(128) NOT NULL,
  action VARCHAR(20) NOT NULL,
  adminUid VARCHAR(128) NOT NULL,
  createdAt BIGINT DEFAULT 0,
  INDEX idx_ra_time (createdAt),
  INDEX idx_ra_type (reportType)
);

SET @staffRoleExists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='staff' AND COLUMN_NAME='role');
SET @sql9a = IF(@staffRoleExists=0, 'ALTER TABLE staff ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT ''moderator''', 'SELECT 1');
PREPARE stmt9a FROM @sql9a;
EXECUTE stmt9a;
DEALLOCATE PREPARE stmt9a;

SET @sql9b = IF(@staffRoleExists=0, 'UPDATE staff SET role=''owner''', 'SELECT 1');
PREPARE stmt9b FROM @sql9b;
EXECUTE stmt9b;
DEALLOCATE PREPARE stmt9b;
