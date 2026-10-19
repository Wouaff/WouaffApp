-- Sessions : on stocke desormais le hash SHA-256 de l'identifiant du cookie (les sessions en cours restent valides)
UPDATE sessions SET id = SHA2(id, 256) WHERE id LIKE '%-%';
-- Secrets TOTP : place pour la version chiffree, et dernier pas consomme (anti-rejeu des codes)
ALTER TABLE users MODIFY totp_secret VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN totp_last_step BIGINT NULL;
-- Un seul repost par utilisateur et par post (doublons supprimes d'abord)
DELETE p1 FROM posts p1 JOIN posts p2 ON p1.uid = p2.uid AND p1.repost_of = p2.repost_of AND p1.id > p2.id WHERE p1.repost_of IS NOT NULL;
ALTER TABLE posts ADD UNIQUE KEY uk_posts_user_repost (uid, repost_of);
-- Un seul signalement par utilisateur et par post
DELETE r1 FROM reports r1 JOIN reports r2 ON r1.reporter_uid = r2.reporter_uid AND r1.post_id = r2.post_id AND r1.id > r2.id WHERE r1.post_id IS NOT NULL;
ALTER TABLE reports ADD UNIQUE KEY uk_reports_once (reporter_uid, post_id)
