UPDATE users SET wouaffId = NULL WHERE wouaffId = '';

UPDATE users u
JOIN (
  SELECT wouaffId, MIN(uid) AS keepUid
  FROM users
  WHERE wouaffId IS NOT NULL AND wouaffId <> ''
  GROUP BY wouaffId
  HAVING COUNT(*) > 1
) dup ON dup.wouaffId = u.wouaffId AND u.uid <> dup.keepUid
SET u.wouaffId = NULL;

SET @wouaffUniqueExists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='uk_users_wouaffId');
SET @sql26 = IF(@wouaffUniqueExists=0, 'ALTER TABLE users ADD UNIQUE KEY uk_users_wouaffId (wouaffId)', 'SELECT 1');
PREPARE stmt26 FROM @sql26; EXECUTE stmt26; DEALLOCATE PREPARE stmt26;

SET @oldWouaffIdxExists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='idx_users_wouaffId');
SET @sql26b = IF(@oldWouaffIdxExists>0, 'ALTER TABLE users DROP INDEX idx_users_wouaffId', 'SELECT 1');
PREPARE stmt26b FROM @sql26b; EXECUTE stmt26b; DEALLOCATE PREPARE stmt26b;
