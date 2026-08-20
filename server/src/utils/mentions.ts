import { getOne, query } from '../config/database.js';

const MENTION_RE = /(^|\s)@([a-z0-9_]{1,50})/gi;
const MAX_MENTIONS = 20;

export function extractMentionHandles(text: string): string[] {
  const handles = new Set<string>();
  MENTION_RE.lastIndex = 0;
  let match = MENTION_RE.exec(text);
  while (match) {
    handles.add(match[2].toLowerCase());
    match = MENTION_RE.exec(text);
    if (handles.size >= MAX_MENTIONS) break;
  }
  return [...handles];
}

async function resolveUid(handle: string): Promise<string | null> {
  const wouaffId = handle.startsWith('@') ? `@${handle.slice(1).toLowerCase()}` : `@${handle.toLowerCase()}`;
  const row = await getOne<{ uid: string }>('SELECT uid FROM wouaff_id_index WHERE wouaffId = ?', [wouaffId]);
  return row?.uid || null;
}

export async function resolveMentions(text: string): Promise<string[]> {
  const handles = extractMentionHandles(text);
  const uids: string[] = [];
  for (const handle of handles) {
    const uid = await resolveUid(handle);
    if (uid) uids.push(uid);
  }
  return uids;
}

export async function insertPostMentions(postId: string, text: string): Promise<void> {
  const uids = await resolveMentions(text);
  if (uids.length === 0) return;
  const now = Date.now();
  const values: Array<string | number> = [];
  const placeholders = uids.map((uid) => {
    values.push(postId, uid, now);
    return '(?,?,?)';
  });
  await query(`INSERT IGNORE INTO post_mentions (postId, uid, createdAt) VALUES ${placeholders.join(',')}`, values);
}

export async function insertCommentMentions(commentId: number, text: string): Promise<void> {
  const uids = await resolveMentions(text);
  if (uids.length === 0) return;
  const now = Date.now();
  const values: Array<string | number> = [];
  const placeholders = uids.map((uid) => {
    values.push(commentId, uid, now);
    return '(?,?,?)';
  });
  await query(
    `INSERT IGNORE INTO comment_mentions (commentId, uid, createdAt) VALUES ${placeholders.join(',')}`,
    values,
  );
}
