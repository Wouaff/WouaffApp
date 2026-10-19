-- Medias : seules les adresses locales /uploads/... sont acceptees (la CSP bloque les images externes)
UPDATE users SET avatar = NULL WHERE avatar IS NOT NULL AND avatar NOT LIKE '/uploads/%';
UPDATE users SET banner = NULL WHERE banner IS NOT NULL AND banner NOT LIKE '/uploads/%';
UPDATE posts SET image = NULL WHERE image IS NOT NULL AND image NOT LIKE '/uploads/%';
UPDATE posts SET video = NULL WHERE video IS NOT NULL AND video NOT LIKE '/uploads/%'
