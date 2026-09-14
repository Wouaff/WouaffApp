DELETE ur1 FROM user_reports ur1
JOIN user_reports ur2
  ON ur1.reportedUid = ur2.reportedUid
 AND ur1.reporterUid = ur2.reporterUid
 AND ur1.id > ur2.id;

SET @userReportsUniqueExists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_reports' AND INDEX_NAME='uk_user_reports_pair');
SET @sql25 = IF(@userReportsUniqueExists=0, 'ALTER TABLE user_reports ADD UNIQUE KEY uk_user_reports_pair (reportedUid, reporterUid)', 'SELECT 1');
PREPARE stmt25 FROM @sql25; EXECUTE stmt25; DEALLOCATE PREPARE stmt25;
