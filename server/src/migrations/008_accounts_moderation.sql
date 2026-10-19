-- Comptes : rôle, état (suspension / bannissement), confirmation d'âge, date du dernier changement de pseudo
ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN suspended_until BIGINT NULL;
ALTER TABLE users ADD COLUMN status_reason VARCHAR(500) NULL;
ALTER TABLE users ADD COLUMN age_confirmed_at BIGINT NULL;
ALTER TABLE users ADD COLUMN pseudo_changed_at BIGINT NULL;
-- Jetons à usage unique : donnée associée (nouvelle adresse e-mail en attente de confirmation)
ALTER TABLE auth_tokens ADD COLUMN payload VARCHAR(255) NULL;
-- Notifications système (modération) : texte libre sans acteur
ALTER TABLE notifications ADD COLUMN message VARCHAR(500) NULL;
-- Signalements : catégorie, traitement, extrait du contenu (conservé même si le post est supprimé)
ALTER TABLE reports ADD COLUMN category VARCHAR(24) NOT NULL DEFAULT 'other';
ALTER TABLE reports ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'open';
ALTER TABLE reports ADD COLUMN post_excerpt VARCHAR(300) NULL;
ALTER TABLE reports ADD COLUMN handled_by VARCHAR(128) NULL;
ALTER TABLE reports ADD COLUMN handled_at BIGINT NULL;
ALTER TABLE reports ADD COLUMN resolution VARCHAR(500) NULL;
ALTER TABLE reports ADD KEY idx_reports_status (status, created_at);
-- Codes de secours de la double authentification (seule l'empreinte est stockée)
CREATE TABLE IF NOT EXISTS recovery_codes (
  uid VARCHAR(128) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  used_at BIGINT NULL,
  PRIMARY KEY (uid, code_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Journal des actions de modération (conservé même si un compte est supprimé : obligation de traçabilité)
CREATE TABLE IF NOT EXISTS mod_actions (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_uid VARCHAR(128) NOT NULL,
  action VARCHAR(32) NOT NULL,
  target_uid VARCHAR(128) NULL,
  target_post_id BIGINT NULL,
  report_id BIGINT NULL,
  reason VARCHAR(500) NULL,
  created_at BIGINT NOT NULL,
  KEY idx_mod_actions_created (created_at),
  KEY idx_mod_actions_target (target_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Les tables sans clé étrangère prennent la collation de users.uid (base neuve : general_ci, base historique : celle d'origine)
SET @coll = (SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'uid');
SET @sql = (SELECT IF(COUNT(*) > 0 AND @coll LIKE 'utf8mb4%', CONCAT('ALTER TABLE `blocks` CONVERT TO CHARACTER SET utf8mb4 COLLATE ', @coll), 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'blocks' AND COLLATION_NAME IS NOT NULL AND COLLATION_NAME <> @coll);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) > 0 AND @coll LIKE 'utf8mb4%', CONCAT('ALTER TABLE `reports` CONVERT TO CHARACTER SET utf8mb4 COLLATE ', @coll), 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reports' AND COLLATION_NAME IS NOT NULL AND COLLATION_NAME <> @coll);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) > 0 AND @coll LIKE 'utf8mb4%', CONCAT('ALTER TABLE `auth_tokens` CONVERT TO CHARACTER SET utf8mb4 COLLATE ', @coll), 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_tokens' AND COLLATION_NAME IS NOT NULL AND COLLATION_NAME <> @coll);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) > 0 AND @coll LIKE 'utf8mb4%', CONCAT('ALTER TABLE `recovery_codes` CONVERT TO CHARACTER SET utf8mb4 COLLATE ', @coll), 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recovery_codes' AND COLLATION_NAME IS NOT NULL AND COLLATION_NAME <> @coll);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) > 0 AND @coll LIKE 'utf8mb4%', CONCAT('ALTER TABLE `mod_actions` CONVERT TO CHARACTER SET utf8mb4 COLLATE ', @coll), 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mod_actions' AND COLLATION_NAME IS NOT NULL AND COLLATION_NAME <> @coll);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt
