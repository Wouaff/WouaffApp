import { createHash } from 'node:crypto';

export const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

/* En base on ne stocke jamais l'identifiant de session brut (celui du cookie), seulement son hash :
   une fuite de la table `sessions` ne permet alors pas de se faire passer pour un utilisateur. */
export const hashSessionId = sha256Hex;
