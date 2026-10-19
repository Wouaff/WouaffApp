-- Aligne les tables creees par l'app sur utf8mb4_unicode_ci (collation des tables historiques, qu'on ne touche pas)
ALTER TABLE `blocks` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `reports` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `auth_tokens` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
