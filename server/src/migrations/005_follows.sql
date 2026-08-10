CREATE TABLE IF NOT EXISTS follows (
  followerUid VARCHAR(128) NOT NULL,
  followedUid VARCHAR(128) NOT NULL,
  createdAt BIGINT DEFAULT 0,
  PRIMARY KEY (followerUid, followedUid),
  INDEX idx_follows_followed (followedUid)
);
