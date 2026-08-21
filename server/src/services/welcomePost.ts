import { randomUUID } from 'node:crypto';
import type { Server } from 'socket.io';
import { getOne, query } from '../config/database.js';
import { createNotification } from './notifications.js';

const BOT_UID = 'system_welcome_bot';
const BOT_PSEUDO = 'Wouaff';
const BOT_HANDLE = '@wouaff';

const WELCOME_MESSAGES = [
  'Bienvenue sur Wouaff ! Ravi de te compter parmi nous @',
  'Hey @, bienvenue dans la communauté Wouaff !',
  'Un nouveau membre ! Bienvenue @ et amuse-toi bien sur Wouaff !',
  "Salut @, content de t'accueillir sur Wouaff !",
  'Welcome @ ! Prépare-toi pour une belle aventure sur Wouaff !',
];

async function ensureBotExists(): Promise<void> {
  const existing = await getOne<{ uid: string }>('SELECT uid FROM users WHERE uid = ?', [BOT_UID]);
  if (existing) return;
  await query(
    'INSERT IGNORE INTO users (uid, pseudo, email, wouaffId, createdAt, emailVerified) VALUES (?,?,?,?,?,?)',
    [BOT_UID, BOT_PSEUDO, null, BOT_HANDLE, Date.now(), 1],
  );
  await query(
    'INSERT IGNORE INTO wouaff_id_index (wouaffId, uid) VALUES (?,?) ON DUPLICATE KEY UPDATE uid=VALUES(uid)',
    [BOT_HANDLE, BOT_UID],
  );
}

function pickMessage(): string {
  return WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
}

export async function createWelcomePost(io: Server | null, newUid: string, newPseudo: string): Promise<void> {
  try {
    await ensureBotExists();

    const handle = `@${newPseudo}`;
    const text = `${pickMessage()}${handle}`;
    const id = randomUUID();
    const now = Date.now();

    await query(
      'INSERT INTO posts (id, uid, text, image, audio, audioDuration, poll, likesCount, repostsCount, commentsCount, createdAt) VALUES (?,?,?,?,?,?,?,0,0,0,?)',
      [id, BOT_UID, text, null, null, 0, null, now],
    );

    await query('INSERT IGNORE INTO post_mentions (postId, uid, createdAt) VALUES (?,?,?)', [id, newUid, now]);

    await createNotification(io, {
      uid: newUid,
      actorUid: BOT_UID,
      type: 'mention',
      postId: id,
    });

    if (io) {
      const post = {
        id,
        uid: BOT_UID,
        pseudo: BOT_PSEUDO,
        handle: BOT_HANDLE,
        avatar: null,
        time: now,
        text,
        likes: 0,
        reposts: 0,
        comments: 0,
        myReaction: null,
        reactions: [],
        reposted: false,
        verified: false,
      };
      io.emit('post:new', post);
    }
  } catch (err) {
    console.error('[WELCOME] Failed to create welcome post:', (err as Error).message);
  }
}
