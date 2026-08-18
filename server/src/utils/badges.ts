import { query } from '../config/database.js';

export async function fetchBadgesMap(uids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const unique = [...new Set(uids.filter((u): u is string => !!u))];
  if (unique.length === 0) return map;
  const placeholders = unique.map(() => '?').join(',');
  const rows = await query<Array<{ uid: string; badgeId: string }>>(
    `SELECT uid, badgeId FROM user_badges WHERE uid IN (${placeholders}) ORDER BY sortOrder ASC`,
    unique,
  );
  for (const r of rows) {
    const arr = map.get(r.uid);
    if (arr) arr.push(r.badgeId);
    else map.set(r.uid, [r.badgeId]);
  }
  return map;
}
