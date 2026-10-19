import { Router } from 'express';
import { authMiddleware, currentUser } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { fetchPosts, filters } from '../services/postQuery.js';
import {
  createComment,
  createNotification,
  createPost,
  createReport,
  deleteComment,
  deletePost,
  findPostById,
  getComments,
  isBlockedEitherWay,
  notifyMentions,
  toggleLike,
  toggleRepost,
} from '../services/rtdb.js';
import { isSafeUploadPath, toInt } from '../utils/validation.js';

const router = Router();
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: 'Tu publies trop vite, patiente un peu' });

/* Résout l'id reçu vers le post d'origine : on ne like/commente jamais une ligne de repost. */
async function resolveSourcePost(rawId: unknown) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const post = await findPostById(id);
  if (!post) return null;
  return post.repost_of ? findPostById(post.repost_of) : post;
}

router.get('/feed', authMiddleware, async (req, res) => {
  try {
    const uid = currentUser(req).uid;
    const limit = toInt(req.query.limit, 20, 1, 100);
    const offset = toInt(req.query.offset, 0, 0, 100000);
    const tag = typeof req.query.tag === 'string' ? req.query.tag.replace(/^#/, '') : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    let filter = filters.all();
    if (tag) {
      if (!/^[\p{L}\p{N}_]{1,80}$/u.test(tag)) return res.json([]);
      filter = filters.tag(tag);
    } else if (q) {
      filter = filters.search(q.slice(0, 100));
    } else if (req.query.tab === 'following') {
      filter = filters.following(uid);
    }
    res.json(await fetchPosts(uid, filter, limit, offset));
  } catch (err) {
    console.error('[POSTS] Feed error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', authMiddleware, writeLimiter, async (req, res) => {
  try {
    const { text, image, video } = req.body ?? {};
    const uid = currentUser(req).uid;
    const cleanText = typeof text === 'string' ? text.trim() : '';
    if (!cleanText && !image && !video) {
      return res.status(400).json({ error: 'Le post ne peut pas être vide' });
    }
    if (cleanText.length > 280) {
      return res.status(400).json({ error: 'Le post ne peut pas dépasser 280 caractères' });
    }
    if ((image && !isSafeUploadPath(image)) || (video && !isSafeUploadPath(video))) {
      return res.status(400).json({ error: 'Média invalide' });
    }
    if (image && video) {
      return res.status(400).json({ error: 'Un seul média par post' });
    }
    const postId = await createPost(uid, cleanText || null, image || null, video || null);
    if (cleanText) await notifyMentions(cleanText, uid, postId);
    res.json({ id: postId });
  } catch (err) {
    console.error('[POSTS] Create error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* Ligne du fil (post ou repost) appartenant à l'utilisateur. */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const ok = await deletePost(Number(req.params.id), currentUser(req).uid);
    if (!ok) return res.status(404).json({ error: 'Post introuvable' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[POSTS] Delete error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/like', authMiddleware, writeLimiter, async (req, res) => {
  try {
    const uid = currentUser(req).uid;
    const post = await resolveSourcePost(req.params.id);
    if (!post || (await isBlockedEitherWay(uid, post.uid))) return res.status(404).json({ error: 'Post introuvable' });
    const liked = await toggleLike(uid, post.id);
    if (liked) await createNotification(post.uid, 'like', uid, post.id);
    res.json({ liked });
  } catch (err) {
    console.error('[POSTS] Like error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/repost', authMiddleware, writeLimiter, async (req, res) => {
  try {
    const uid = currentUser(req).uid;
    const post = await resolveSourcePost(req.params.id);
    if (!post || (await isBlockedEitherWay(uid, post.uid))) return res.status(404).json({ error: 'Post introuvable' });
    const reposted = await toggleRepost(uid, post.id);
    if (reposted) await createNotification(post.uid, 'repost', uid, post.id);
    res.json({ reposted });
  } catch (err) {
    console.error('[POSTS] Repost error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/report', authMiddleware, rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }), async (req, res) => {
  try {
    const post = await resolveSourcePost(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post introuvable' });
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : null;
    await createReport(currentUser(req).uid, post.id, post.uid, reason || null);
    res.json({ ok: true });
  } catch (err) {
    console.error('[POSTS] Report error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/comment', authMiddleware, writeLimiter, async (req, res) => {
  try {
    const uid = currentUser(req).uid;
    const post = await resolveSourcePost(req.params.id);
    if (!post || (await isBlockedEitherWay(uid, post.uid))) return res.status(404).json({ error: 'Post introuvable' });
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 280) {
      return res.status(400).json({ error: 'Commentaire invalide (1 à 280 caractères)' });
    }
    const commentId = await createComment(post.id, uid, text);
    await createNotification(post.uid, 'comment', uid, post.id);
    await notifyMentions(text, uid, post.id, [post.uid]);
    res.json({ id: commentId });
  } catch (err) {
    console.error('[POSTS] Comment error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const post = await resolveSourcePost(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post introuvable' });
    const rows = await getComments(
      post.id,
      currentUser(req).uid,
      toInt(req.query.limit, 50, 1, 100),
      toInt(req.query.offset, 0, 0, 100000),
    );
    res.json(
      rows.map((c) => ({
        id: c.id,
        text: c.text,
        createdAt: c.created_at,
        user: { uid: c.uid, pseudo: c.pseudo, displayName: c.displayName, avatar: c.avatar, verified: !!c.verified },
      })),
    );
  } catch (err) {
    console.error('[POSTS] Comments error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id/comments/:commentId', authMiddleware, async (req, res) => {
  try {
    const ok = await deleteComment(Number(req.params.commentId), Number(req.params.id), currentUser(req).uid);
    if (!ok) return res.status(404).json({ error: 'Commentaire introuvable' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[POSTS] Delete comment error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Post introuvable' });
    const [post] = await fetchPosts(currentUser(req).uid, filters.single(id), 1, 0);
    if (!post) return res.status(404).json({ error: 'Post introuvable' });
    res.json(post);
  } catch (err) {
    console.error('[POSTS] Get error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
