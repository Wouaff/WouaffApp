CREATE INDEX idx_users_wouaffId ON users (wouaffId);
CREATE INDEX idx_messages_conv_time ON messages (convId, time);
CREATE INDEX idx_group_messages_gid_time ON group_messages (gid, time);
CREATE INDEX idx_post_likes_post ON post_likes (postId);
CREATE INDEX idx_post_reposts_post ON post_reposts (postId);
CREATE INDEX idx_hashtag_created_tag ON hashtag_occurrences (createdAt, tag);
CREATE INDEX idx_post_comments_post_time ON post_comments (postId, createdAt);
