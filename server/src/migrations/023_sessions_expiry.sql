ALTER TABLE sessions ADD COLUMN expiresAt BIGINT DEFAULT NULL;
CREATE INDEX idx_sessions_expiresAt ON sessions (expiresAt);
UPDATE sessions SET expiresAt = createdAt + 2592000000 WHERE expiresAt IS NULL AND createdAt > 0;
