-- La table historique avait un ENUM pour type : on passe en VARCHAR pour accepter like, repost, follow, comment, mention
ALTER TABLE `notifications` MODIFY `type` VARCHAR(32) NOT NULL;
