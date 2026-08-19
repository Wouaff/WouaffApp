ALTER TABLE users
  ADD COLUMN onboardingCompletedAt BIGINT DEFAULT 0,
  ADD COLUMN phone VARCHAR(32) DEFAULT NULL,
  ADD COLUMN contactsSyncedAt BIGINT DEFAULT 0;

CREATE INDEX idx_users_phone ON users (phone);