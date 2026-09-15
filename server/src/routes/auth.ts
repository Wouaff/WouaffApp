import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import {
  createSession,
  createUser,
  deleteSession,
  findSession,
  findUserByEmail,
  findUserByPseudo,
} from '../services/rtdb.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { pseudo, email, password } = req.body;
    if (!pseudo || !email || !password) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }
    if (pseudo.length < 3 || pseudo.length > 30) {
      return res.status(400).json({ error: 'Le pseudo doit faire entre 3 et 30 caractères' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(pseudo)) {
      return res.status(400).json({ error: 'Le pseudo ne peut contenir que des lettres, chiffres et underscores' });
    }
    const existingEmail = await findUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }
    const existingPseudo = await findUserByPseudo(pseudo);
    if (existingPseudo) {
      return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
    }
    const uid = uuid();
    const passwordHash = await bcrypt.hash(password, 10);
    await createUser(uid, pseudo, email.toLowerCase(), passwordHash);
    const sessionId = uuid();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await createSession(sessionId, uid, expiresAt, req.headers['user-agent']);
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && !req.hostname.includes('localhost'),
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json({ uid, pseudo });
  } catch (err) {
    console.error('[AUTH] Register error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    const user = await findUserByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    const sessionId = uuid();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await createSession(sessionId, user.uid, expiresAt, req.headers['user-agent']);
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && !req.hostname.includes('localhost'),
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json({ uid: user.uid, pseudo: user.pseudo });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/logout', async (req, res) => {
  const sessionId = req.cookies?.session_id;
  if (sessionId) await deleteSession(sessionId);
  res.clearCookie('session_id');
  res.json({ ok: true });
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = (req as any).user;
  res.json({
    uid: user.uid,
    pseudo: user.pseudo,
    email: user.email,
    displayName: user.displayName,
    avatar: user.avatar,
    banner: user.banner,
    bio: user.bio,
    location: user.location,
    website: user.website,
    verified: !!user.verified,
    createdAt: user.createdAt,
  });
});

export default router;
