CREATE TABLE IF NOT EXISTS ip_bans (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(64) NOT NULL,
  reason TEXT DEFAULT NULL,
  bannedBy VARCHAR(128) NOT NULL,
  createdAt BIGINT DEFAULT 0,
  expiresAt BIGINT DEFAULT NULL,
  UNIQUE KEY uk_ipbans_ip (ip),
  INDEX idx_ipbans_expires (expiresAt)
);