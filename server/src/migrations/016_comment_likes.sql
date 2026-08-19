ALTER TABLE post_comments ADD COLUMN likesCount INT NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS comment_likes (
  commentId BIGINT NOT NULL,
  uid VARCHAR(128) NOT NULL,
  createdAt BIGINT DEFAULT 0,
  PRIMARY KEY (commentId, uid)
);