-- Nettoyer les follows orphelins (utilisateurs supprimés mais followsrestants)
DELETE f FROM follows f
LEFT JOIN users u1 ON u1.uid = f.followerUid
LEFT JOIN users u2 ON u2.uid = f.followedUid
WHERE u1.uid IS NULL OR u2.uid IS NULL;
