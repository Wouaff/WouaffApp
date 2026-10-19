import { query } from '../config/database.js';
import { escapeLike } from '../utils/validation.js';

export interface FeedPost {
  /* id du post d'origine : celui sur lequel on like / commente / reposte */
  id: number;
  /* id de la ligne dans `posts` (= celui du repost s'il s'agit d'un repost) : clé React + suppression */
  feedId: number;
  text: string | null;
  image: string | null;
  video: string | null;
  createdAt: string;
  feedAt: string;
  likesCount: number;
  repostsCount: number;
  commentsCount: number;
  userLiked: boolean;
  userReposted: boolean;
  repostOf: number | null;
  repostedBy: { uid: string; pseudo: string; displayName: string | null } | null;
  user: { uid: string; pseudo: string; displayName: string | null; avatar: string | null; verified: boolean };
}

interface Filter {
  where: string;
  params: unknown[];
}

/* Filtres prêts à l'emploi : toujours exprimés sur `p` (ligne du fil) et `s` (post d'origine). */
export const filters = {
  all: (): Filter => ({ where: '1=1', params: [] }),
  following: (uid: string): Filter => ({
    where: '(p.uid IN (SELECT followed_uid FROM follows WHERE follower_uid = ?) OR p.uid = ?)',
    params: [uid, uid],
  }),
  profilePosts: (uid: string): Filter => ({ where: 'p.uid = ? AND p.repost_of IS NULL', params: [uid] }),
  profileReposts: (uid: string): Filter => ({ where: 'p.uid = ? AND p.repost_of IS NOT NULL', params: [uid] }),
  single: (id: number): Filter => ({ where: 'p.id = ? AND p.repost_of IS NULL', params: [id] }),
  /* tag : uniquement lettres/chiffres/_ (validé en amont) */
  tag: (tag: string): Filter => ({
    where: 'p.repost_of IS NULL AND s.text REGEXP ?',
    params: [`#${tag}([^\\p{L}\\p{N}_]|$)`],
  }),
  search: (q: string): Filter => ({
    where: "p.repost_of IS NULL AND s.text LIKE ? ESCAPE '!'",
    params: [`%${escapeLike(q)}%`],
  }),
};

interface Row {
  feed_id: number;
  feed_at: string;
  repost_of: number | null;
  actor_uid: string;
  actor_pseudo: string;
  actor_name: string | null;
  id: number;
  text: string | null;
  image: string | null;
  video: string | null;
  created_at: string;
  uid: string;
  pseudo: string;
  displayName: string | null;
  avatar: string | null;
  verified: number;
  likes_count: number;
  reposts_count: number;
  comments_count: number;
  user_liked: number;
  user_reposted: number;
}

export async function fetchPosts(
  viewerUid: string,
  filter: Filter,
  limit: number,
  offset: number,
): Promise<FeedPost[]> {
  const lim = Math.max(1, Math.min(100, Math.trunc(limit)));
  const off = Math.max(0, Math.trunc(offset));
  const rows = await query<Row[]>(
    `SELECT p.id AS feed_id, p.created_at AS feed_at, p.repost_of,
            ru.uid AS actor_uid, ru.pseudo AS actor_pseudo, ru.displayName AS actor_name,
            s.id AS id, s.text, s.image, s.video, s.created_at,
            su.uid AS uid, su.pseudo, su.displayName, su.avatar, su.verified,
            (SELECT COUNT(*) FROM likes WHERE post_id = s.id) AS likes_count,
            (SELECT COUNT(*) FROM posts WHERE repost_of = s.id) AS reposts_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = s.id) AS comments_count,
            (SELECT COUNT(*) FROM likes WHERE post_id = s.id AND uid = ?) AS user_liked,
            (SELECT COUNT(*) FROM posts WHERE uid = ? AND repost_of = s.id) AS user_reposted
     FROM posts p
     JOIN users ru ON ru.uid = p.uid
     JOIN posts s ON s.id = COALESCE(p.repost_of, p.id)
     JOIN users su ON su.uid = s.uid
     WHERE NOT EXISTS (
             SELECT 1 FROM blocks b
             WHERE (b.blocker_uid = ? AND b.blocked_uid IN (p.uid, s.uid))
                OR (b.blocked_uid = ? AND b.blocker_uid IN (p.uid, s.uid)))
       AND ${filter.where}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ${lim} OFFSET ${off}`,
    [viewerUid, viewerUid, viewerUid, viewerUid, ...filter.params],
  );
  return rows.map((r) => ({
    id: r.id,
    feedId: r.feed_id,
    text: r.text,
    image: r.image,
    video: r.video,
    createdAt: r.created_at,
    feedAt: r.feed_at,
    likesCount: r.likes_count,
    repostsCount: r.reposts_count,
    commentsCount: r.comments_count,
    userLiked: !!r.user_liked,
    userReposted: !!r.user_reposted,
    repostOf: r.repost_of,
    repostedBy: r.repost_of ? { uid: r.actor_uid, pseudo: r.actor_pseudo, displayName: r.actor_name } : null,
    user: { uid: r.uid, pseudo: r.pseudo, displayName: r.displayName, avatar: r.avatar, verified: !!r.verified },
  }));
}
