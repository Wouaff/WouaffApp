SET @postAudioExists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='posts' AND COLUMN_NAME='audio');
SET @sql1 = IF(@postAudioExists=0, 'ALTER TABLE posts ADD COLUMN audio LONGTEXT DEFAULT NULL', 'SELECT 1');
PREPARE stmt1 FROM @sql1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

SET @postAudioDurationExists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='posts' AND COLUMN_NAME='audioDuration');
SET @sql2 = IF(@postAudioDurationExists=0, 'ALTER TABLE posts ADD COLUMN audioDuration INT DEFAULT 0', 'SELECT 1');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
