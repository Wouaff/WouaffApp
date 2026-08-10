-- Convert users text columns to utf8mb4 so 4-byte chars (emojis) are accepted.

SET @usersBioIsUtf8mb3 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='bio' AND CHARACTER_SET_NAME='utf8');
SET @sqlBio = IF(@usersBioIsUtf8mb3>0, 'ALTER TABLE users MODIFY COLUMN bio TEXT CHARACTER SET utf8mb4 DEFAULT NULL', 'SELECT 1');
PREPARE stmtBio FROM @sqlBio;
EXECUTE stmtBio;
DEALLOCATE PREPARE stmtBio;

SET @usersPseudoIsUtf8mb3 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='pseudo' AND CHARACTER_SET_NAME='utf8');
SET @sqlPseudo = IF(@usersPseudoIsUtf8mb3>0, 'ALTER TABLE users MODIFY COLUMN pseudo VARCHAR(100) CHARACTER SET utf8mb4 DEFAULT ''''', 'SELECT 1');
PREPARE stmtPseudo FROM @sqlPseudo;
EXECUTE stmtPseudo;
DEALLOCATE PREPARE stmtPseudo;

SET @usersSocialIsUtf8mb3 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='social_links' AND CHARACTER_SET_NAME='utf8');
SET @sqlSocial = IF(@usersSocialIsUtf8mb3>0, 'ALTER TABLE users MODIFY COLUMN social_links TEXT CHARACTER SET utf8mb4 DEFAULT NULL', 'SELECT 1');
PREPARE stmtSocial FROM @sqlSocial;
EXECUTE stmtSocial;
DEALLOCATE PREPARE stmtSocial;
