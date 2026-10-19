/* Attribue un rôle à un compte, en ligne de commande (seul moyen de créer le premier administrateur) :
     npm --prefix server run role -- <pseudo> <user|moderator|admin>
   Utilise la même configuration que le serveur (variables DB_* de server/.env). */
import pool from '../config/database.js';

const [pseudo, role] = process.argv.slice(2);
if (!pseudo || !['user', 'moderator', 'admin'].includes(role ?? '')) {
  console.error('Usage : npm --prefix server run role -- <pseudo> <user|moderator|admin>');
  process.exit(2);
}
const [result] = (await pool.query('UPDATE users SET role = ? WHERE pseudo = ?', [role, pseudo])) as [
  { affectedRows: number },
  unknown,
];
console.log(result.affectedRows === 1 ? `✔ ${pseudo} est maintenant « ${role} »` : `✘ Aucun compte « ${pseudo} »`);
await pool.end();
process.exit(result.affectedRows === 1 ? 0 : 1);
