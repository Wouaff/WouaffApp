SET @onboardingExists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='onboardingCompletedAt');
SET @sql20a = IF(@onboardingExists=0, 'ALTER TABLE users ADD COLUMN onboardingCompletedAt BIGINT DEFAULT 0', 'SELECT 1');
PREPARE stmt20a FROM @sql20a; EXECUTE stmt20a; DEALLOCATE PREPARE stmt20a;

SET @phoneExists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='phone');
SET @sql20b = IF(@phoneExists=0, 'ALTER TABLE users ADD COLUMN phone VARCHAR(32) DEFAULT NULL', 'SELECT 1');
PREPARE stmt20b FROM @sql20b; EXECUTE stmt20b; DEALLOCATE PREPARE stmt20b;

SET @contactsSyncedExists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='contactsSyncedAt');
SET @sql20c = IF(@contactsSyncedExists=0, 'ALTER TABLE users ADD COLUMN contactsSyncedAt BIGINT DEFAULT 0', 'SELECT 1');
PREPARE stmt20c FROM @sql20c; EXECUTE stmt20c; DEALLOCATE PREPARE stmt20c;

SET @phoneIndexExists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='idx_users_phone');
SET @sql20d = IF(@phoneIndexExists=0, 'CREATE INDEX idx_users_phone ON users (phone)', 'SELECT 1');
PREPARE stmt20d FROM @sql20d; EXECUTE stmt20d; DEALLOCATE PREPARE stmt20d;
