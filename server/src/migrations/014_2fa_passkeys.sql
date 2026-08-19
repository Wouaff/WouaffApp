-- 2FA (email + application TOTP) et clés d'accès (passkeys / WebAuthn)
-- Chaque ALTER est idempotent grâce au runner de migrations (ignore ER_DUP_FIELDNAME).
ALTER TABLE users ADD COLUMN totpSecret VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN totpEnabled TINYINT(1) DEFAULT 0;
ALTER TABLE users ADD COLUMN email2faEnabled TINYINT(1) DEFAULT 0;
ALTER TABLE users ADD COLUMN backupCodes TEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS passkeys (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  name VARCHAR(100) DEFAULT '',
  credentialId VARCHAR(255) NOT NULL,
  publicKey LONGTEXT NOT NULL,
  counter BIGINT DEFAULT 0,
  transports TEXT DEFAULT NULL,
  createdAt BIGINT DEFAULT 0,
  lastUsedAt BIGINT DEFAULT 0,
  UNIQUE KEY uk_passkeys_credential (credentialId),
  INDEX idx_passkeys_uid (uid)
);

CREATE TABLE IF NOT EXISTS login_challenges (
  challenge VARCHAR(64) PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  createdAt BIGINT NOT NULL,
  expiresAt BIGINT NOT NULL,
  INDEX idx_login_challenges_uid (uid)
);

ALTER TABLE email_tokens MODIFY COLUMN type ENUM('verify','reset','2fa') NOT NULL;
