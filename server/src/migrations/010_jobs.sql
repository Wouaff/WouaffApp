CREATE TABLE IF NOT EXISTS jobs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  payload LONGTEXT DEFAULT NULL,
  status ENUM('pending','running','done','failed') DEFAULT 'pending',
  attempts INT DEFAULT 0,
  maxAttempts INT DEFAULT 3,
  runAt BIGINT DEFAULT 0,
  lockedAt BIGINT DEFAULT NULL,
  lastError TEXT DEFAULT NULL,
  createdAt BIGINT DEFAULT 0,
  updatedAt BIGINT DEFAULT 0,
  INDEX idx_jobs_claim (status, runAt, lockedAt),
  INDEX idx_jobs_type (type)
);
