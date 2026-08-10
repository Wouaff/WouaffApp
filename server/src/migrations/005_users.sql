CREATE TABLE IF NOT EXISTS users (
  uid VARCHAR(128) PRIMARY KEY,
  pseudo VARCHAR(100) DEFAULT '',
  bio TEXT DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  passwordHash VARCHAR(255) DEFAULT NULL,
  avatar LONGTEXT DEFAULT NULL,
  banner LONGTEXT DEFAULT NULL,
  wouaffId VARCHAR(50) DEFAULT NULL,
  publicKey TEXT DEFAULT NULL,
  status ENUM('online','offline','idle') DEFAULT 'offline',
  lastSeen BIGINT DEFAULT 0,
  createdAt BIGINT DEFAULT 0,
  emailVerified TINYINT(1) DEFAULT 0,
  social_links TEXT DEFAULT NULL,
  UNIQUE KEY uk_users_email (email)
);

-- Migrate existing accounts from the legacy `profiles` table into `users`.
-- Idempotent : runs only while `profiles` still exists, then drops it.
SET @hasProfiles = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'profiles');
SET @migrateSql = IF(@hasProfiles = 1,
  'INSERT INTO users (uid, pseudo, bio, email, passwordHash, avatar, banner, wouaffId, publicKey, status, lastSeen, createdAt, emailVerified, social_links)
   SELECT uid, pseudo, bio, email, passwordHash, avatar, banner, wouaffId, publicKey, status, lastSeen, createdAt, COALESCE(emailVerified, 0), social_links
   FROM profiles
   ON DUPLICATE KEY UPDATE
     pseudo = VALUES(pseudo), bio = VALUES(bio), email = VALUES(email), passwordHash = VALUES(passwordHash),
     avatar = VALUES(avatar), banner = VALUES(banner), wouaffId = VALUES(wouaffId), publicKey = VALUES(publicKey),
     status = VALUES(status), lastSeen = VALUES(lastSeen), createdAt = VALUES(createdAt),
     emailVerified = VALUES(emailVerified), social_links = VALUES(social_links)',
  'SELECT 1');
PREPARE stmt_migrate FROM @migrateSql;
EXECUTE stmt_migrate;
DEALLOCATE PREPARE stmt_migrate;

DROP TABLE IF EXISTS profiles;
