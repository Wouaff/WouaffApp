import { Router } from 'express';
import { getOne, query } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  createComment,
  createNotification,
  createPost,
  deletePost,
  findPostById,
  getComments,
  toggleLike,
  toggleRepost,
} from '../services/rtdb.js';

const router = Router();

function enrichPost(p: any, userId: string) {
  return {
    id: p.id,
    text: p.text,
    image: p.image,
    createdAt: p.created_at,
    likesCount: p.likes_count,
    repostsCount: p.reposts_count,
    commentsCount: p.comments_count,
    userLiked: !!p.user_liked,
    userReposted: !!p.user_reposted,
    repostOf: p.repost_of,
    user: {
      uid: p.uid,
      pseudo: p.pseudo,
      displayName: p.displayName,
      avatar: p.avatar,
      verified: !!p.verified,
    },
  };
}

router.get('/feed', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const tab = (req.query.tab as string) || 'for-you';
    const uid = (req as any).user.uid;

    let sql: string;
    let params: any[];

    if (tab === 'following') {
      sql = `SELECT p.*, u.pseudo, u.displayName, u.avatar, u.verified,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM posts WHERE repost_of = p.id) as reposts_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND uid = ?) as user_liked,
        (SELECT COUNT(*) FROM posts WHERE uid = ? AND repost_of = p.id) as user_reposted
        FROM posts p
        JOIN users u ON p.uid = u.uid
        WHERE p.uid IN (SELECT followed_uid FROM follows WHERE follower_uid = ?)
        AND p.repost_of IS NULL
        ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
      params = [uid, uid, uid, limit, offset];
    } else {
      sql = `SELECT p.*, u.pseudo, u.displayName, u.avatar, u.verified,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM posts WHERE repost_of = p.id) as reposts_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND uid = ?) as user_liked,
        (SELECT COUNT(*) FROM posts WHERE uid = ? AND repost_of = p.id) as user_reposted
        FROM posts p
        JOIN users u ON p.uid = u.uid
        ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
      params = [uid, uid, limit, offset];
    }

    const posts = await query<any[]>(sql, params);
    res.json(posts.map((p) => enrichPost(p, uid)));
  } catch (err) {
    console.error('[POSTS] Feed error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { text, image, repostOf } = req.body;
    const uid = (req as any).user.uid;
    if (!text && !image && !repostOf) {
      return res.status(400).json({ error: 'Le tweet ne peut pas être vide' });
    }
    if (text && text.length > 280) {
      return res.status(400).json({ error: 'Le tweet ne peut pas dépasser 280 caractères' });
    }
    const postId = await createPost(uid, text || null, image || null, repostOf);
    res.json({ id: postId });
  } catch (err) {
    console.error('[POSTS] Create error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const uid = (req as any).user.uid;
    await deletePost(postId, uid);
    res.json({ ok: true });
  } catch (err) {
    console.error('[POSTS] Delete error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const uid = (req as any).user.uid;
    const liked = await toggleLike(uid, postId);
    if (liked) {
      const post = await findPostById(postId);
      if (post) createNotification(post.uid, 'like', uid, postId);
    }
    res.json({ liked });
  } catch (err) {
    console.error('[POSTS] Like error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/repost', authMiddleware, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const uid = (req as any).user.uid;
    const reposted = await toggleRepost(uid, postId);
    if (reposted) {
      const post = await findPostById(postId);
      if (post) createNotification(post.uid, 'repost', uid, postId);
    }
    res.json({ reposted });
  } catch (err) {
    console.error('[POSTS] Repost error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/comment', authMiddleware, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const uid = (req as any).user.uid;
    const { text } = req.body;
    if (!text || text.length > 280) {
      return res.status(400).json({ error: 'Commentaire invalide' });
    }
    const commentId = await createComment(postId, uid, text);
    const post = await findPostById(postId);
    if (post) createNotification(post.uid, 'mention', uid, postId);
    res.json({ id: commentId });
  } catch (err) {
    console.error('[POSTS] Comment error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const comments = await getComments(postId);
    res.json(comments);
  } catch (err) {
    console.error('[POSTS] Comments error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const uid = (req as any).user.uid;
    const post = await findPostById(postId);
    if (!post) return res.status(404).json({ error: 'Post introuvable' });
    const user = await getOne<any>('SELECT uid, pseudo, displayName, avatar, verified FROM users WHERE uid = ?', [
      post.uid,
    ]);
    const likesCount = await getOne<{ count: number }>('SELECT COUNT(*) as count FROM likes WHERE post_id = ?', [
      postId,
    ]);
    const repostsCount = await getOne<{ count: number }>('SELECT COUNT(*) as count FROM posts WHERE repost_of = ?', [
      postId,
    ]);
    const commentsCount = await getOne<{ count: number }>('SELECT COUNT(*) as count FROM comments WHERE post_id = ?', [
      postId,
    ]);
    const userLiked = await getOne<any>('SELECT uid FROM likes WHERE uid = ? AND post_id = ?', [uid, postId]);
    const userReposted = await getOne<any>('SELECT uid FROM posts WHERE uid = ? AND repost_of = ?', [uid, postId]);
    res.json({
      id: post.id,
      text: post.text,
      image: post.image,
      createdAt: post.created_at,
      likesCount: likesCount?.count || 0,
      repostsCount: repostsCount?.count || 0,
      commentsCount: commentsCount?.count || 0,
      userLiked: !!userLiked,
      userReposted: !!userReposted,
      repostOf: post.repost_of,
      user: user
        ? {
            uid: user.uid,
            pseudo: user.pseudo,
            displayName: user.displayName,
            avatar: user.avatar,
            verified: !!user.verified,
          }
        : null,
    });
  } catch (err) {
    console.error('[POSTS] Get error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
