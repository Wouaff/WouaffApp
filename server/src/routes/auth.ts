import bcrypt from 'bcryptjs';
import { type Request, type Response, Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authMiddleware, currentUser } from '../middleware/auth.js';
import { verifyCaptcha } from '../middleware/captcha.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { isMailEnabled, sendMail } from '../services/mailer.js';
import {
  consumeAuthToken,
  createAuthToken,
  createSession,
  createUser,
  deleteAccount,
  deleteSession,
  deleteSessionOfUser,
  deleteUserSessions,
  exportUserData,
  findUserByEmail,
  findUserByPseudo,
  listSessions,
  updateUser,
} from '../services/rtdb.js';
import { generateTotpSecret, totpUri, verifyTotp } from '../utils/totp.js';
import { EMAIL_RE, PSEUDO_RE, RESERVED_PSEUDOS } from '../utils/validation.js';

const router = Router();

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;
/* Hash factice : on compare toujours, que le compte existe ou non (pas d'écart de timing). */
const DUMMY_HASH = bcrypt.hashSync('wouaff-dummy-password', BCRYPT_ROUNDS);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Trop de tentatives, réessaie dans 15 minutes',
});
const loginByEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Trop de tentatives sur ce compte, réessaie dans 15 minutes',
  key: (req) => `login:${String((req.body as { email?: unknown })?.email ?? '').toLowerCase()}`,
});
const mailLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Trop de demandes, réessaie plus tard' });

function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:7285').replace(/\/$/, '');
}

async function startSession(req: Request, res: Response, uid: string) {
  const sessionId = uuid();
  await createSession(sessionId, uid, Date.now() + SESSION_MS, req.headers['user-agent']);
  res.cookie('session_id', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && !req.hostname.includes('localhost'),
    maxAge: SESSION_MS,
  });
}

async function sendVerificationEmail(uid: string, email: string): Promise<boolean> {
  const token = await createAuthToken(uid, 'verify', 24 * 60 * 60 * 1000);
  return sendMail(
    email,
    'Confirme ton adresse e-mail — Wouaff',
    `Bienvenue sur Wouaff !\n\nConfirme ton adresse e-mail en ouvrant ce lien (valable 24 h) :\n${appUrl()}/verify-email?token=${token}\n\nSi tu n'es pas à l'origine de cette inscription, ignore ce message.`,
  );
}

router.post('/register', authLimiter, verifyCaptcha, async (req, res) => {
  try {
    const { pseudo, email, password } = req.body ?? {};
    if (typeof pseudo !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }
    if (!PSEUDO_RE.test(pseudo)) {
      return res
        .status(400)
        .json({ error: 'Le pseudo doit faire 3 à 30 caractères (lettres, chiffres et underscores uniquement)' });
    }
    if (RESERVED_PSEUDOS.has(pseudo.toLowerCase())) {
      return res.status(400).json({ error: 'Ce pseudo est réservé' });
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 255) {
      return res.status(400).json({ error: 'Adresse e-mail invalide' });
    }
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: 'Le mot de passe doit faire entre 8 et 72 caractères' });
    }
    if (await findUserByEmail(cleanEmail)) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }
    if (await findUserByPseudo(pseudo)) {
      return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
    }
    const uid = uuid();
    try {
      await createUser(uid, pseudo, cleanEmail, await bcrypt.hash(password, BCRYPT_ROUNDS));
    } catch (err) {
      /* Course entre deux inscriptions simultanées : l'index UNIQUE tranche. */
      if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Pseudo ou email déjà utilisé' });
      }
      throw err;
    }
    await startSession(req, res, uid);
    if (isMailEnabled()) void sendVerificationEmail(uid, cleanEmail);
    res.json({ uid, pseudo });
  } catch (err) {
    console.error('[AUTH] Register error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/login', authLimiter, loginByEmailLimiter, async (req, res) => {
  try {
    const { email, password, code } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    const user = await findUserByEmail(email);
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    if (user.totp_enabled && user.totp_secret) {
      if (typeof code !== 'string' || !code.trim()) {
        return res.status(401).json({ error: 'Code de double authentification requis', needs2fa: true });
      }
      if (!verifyTotp(user.totp_secret, code.trim())) {
        return res.status(401).json({ error: 'Code de double authentification invalide', needs2fa: true });
      }
    }
    await startSession(req, res, user.uid);
    res.json({ uid: user.uid, pseudo: user.pseudo });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/logout', async (req, res) => {
  const sessionId = req.cookies?.session_id;
  if (sessionId) await deleteSession(sessionId).catch(() => {});
  res.clearCookie('session_id');
  res.json({ ok: true });
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = currentUser(req);
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
    emailVerified: !!user.emailVerified,
    totpEnabled: !!user.totp_enabled,
    mailEnabled: isMailEnabled(),
    createdAt: user.createdAt,
  });
});

/* ── Vérification de l'e-mail ───────────────────────────────────────────────── */

router.post('/verify-email', authLimiter, async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const uid = token ? await consumeAuthToken(token, 'verify') : null;
  if (!uid) return res.status(400).json({ error: 'Lien invalide ou expiré' });
  await updateUser(uid, { emailVerified: 1 });
  res.json({ ok: true });
});

router.post('/resend-verification', authMiddleware, mailLimiter, async (req, res) => {
  const user = currentUser(req);
  if (user.emailVerified) return res.json({ ok: true });
  if (!isMailEnabled()) return res.status(503).json({ error: "L'envoi d'e-mails n'est pas configuré" });
  const sent = await sendVerificationEmail(user.uid, user.email);
  if (!sent) return res.status(502).json({ error: "Impossible d'envoyer l'e-mail" });
  res.json({ ok: true });
});

/* ── Mot de passe oublié / changement ───────────────────────────────────────── */

router.post('/forgot-password', mailLimiter, async (req, res) => {
  if (!isMailEnabled()) return res.status(503).json({ error: "L'envoi d'e-mails n'est pas configuré sur ce serveur" });
  const email = typeof req.body?.email === 'string' ? req.body.email : '';
  const user = email ? await findUserByEmail(email) : null;
  if (user) {
    const token = await createAuthToken(user.uid, 'reset', 60 * 60 * 1000);
    await sendMail(
      user.email,
      'Réinitialisation de ton mot de passe — Wouaff',
      `Tu as demandé à réinitialiser ton mot de passe.\n\nOuvre ce lien (valable 1 h) :\n${appUrl()}/reset-password?token=${token}\n\nSi ce n'est pas toi, ignore ce message : ton mot de passe reste inchangé.`,
    );
  }
  /* Même réponse que le compte existe ou non. */
  res.json({ ok: true });
});

router.post('/reset-password', authLimiter, async (req, res) => {
  const { token, password } = req.body ?? {};
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return res.status(400).json({ error: 'Le mot de passe doit faire entre 8 et 72 caractères' });
  }
  const uid = typeof token === 'string' && token ? await consumeAuthToken(token, 'reset') : null;
  if (!uid) return res.status(400).json({ error: 'Lien invalide ou expiré' });
  await updateUser(uid, { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) });
  await deleteUserSessions(uid);
  res.json({ ok: true });
});

router.post('/password', authMiddleware, authLimiter, async (req, res) => {
  const user = currentUser(req);
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }
  if (newPassword.length < 8 || newPassword.length > 72) {
    return res.status(400).json({ error: 'Le mot de passe doit faire entre 8 et 72 caractères' });
  }
  const full = await findUserByEmail(user.email);
  if (!full || !(await bcrypt.compare(currentPassword, full.passwordHash))) {
    return res.status(403).json({ error: 'Mot de passe actuel incorrect' });
  }
  await updateUser(user.uid, { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) });
  await deleteUserSessions(user.uid, (req as unknown as { sessionId: string }).sessionId);
  res.json({ ok: true });
});

/* ── Double authentification (appli d'authentification, TOTP) ───────────────── */

router.post('/2fa/setup', authMiddleware, async (req, res) => {
  const user = currentUser(req);
  if (user.totp_enabled) return res.status(409).json({ error: 'La double authentification est déjà active' });
  const secret = generateTotpSecret();
  await updateUser(user.uid, { totp_secret: secret, totp_enabled: 0 });
  res.json({ secret, uri: totpUri(secret, user.email) });
});

router.post('/2fa/enable', authMiddleware, authLimiter, async (req, res) => {
  const user = currentUser(req);
  const full = await findUserByEmail(user.email);
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!full?.totp_secret || !verifyTotp(full.totp_secret, code)) {
    return res.status(400).json({ error: 'Code invalide' });
  }
  await updateUser(user.uid, { totp_enabled: 1 });
  res.json({ ok: true });
});

router.post('/2fa/disable', authMiddleware, authLimiter, async (req, res) => {
  const user = currentUser(req);
  const full = await findUserByEmail(user.email);
  const { password, code } = req.body ?? {};
  if (!full || typeof password !== 'string' || !(await bcrypt.compare(password, full.passwordHash))) {
    return res.status(403).json({ error: 'Mot de passe incorrect' });
  }
  if (full.totp_secret && (typeof code !== 'string' || !verifyTotp(full.totp_secret, code.trim()))) {
    return res.status(400).json({ error: 'Code invalide' });
  }
  await updateUser(user.uid, { totp_secret: null, totp_enabled: 0 });
  res.json({ ok: true });
});

/* ── Sessions ───────────────────────────────────────────────────────────────── */

router.get('/sessions', authMiddleware, async (req, res) => {
  const current = (req as unknown as { sessionId: string }).sessionId;
  const sessions = await listSessions(currentUser(req).uid);
  res.json(
    sessions.map((s) => ({
      id: s.id,
      userAgent: s.user_agent,
      createdAt: s.created_at,
      expiresAt: s.expires_at,
      current: s.id === current,
    })),
  );
});

router.delete('/sessions/:id', authMiddleware, async (req, res) => {
  await deleteSessionOfUser(currentUser(req).uid, req.params.id);
  res.json({ ok: true });
});

router.post('/sessions/revoke-others', authMiddleware, async (req, res) => {
  await deleteUserSessions(currentUser(req).uid, (req as unknown as { sessionId: string }).sessionId);
  res.json({ ok: true });
});

/* ── RGPD : export et suppression du compte ─────────────────────────────────── */

router.get('/export', authMiddleware, mailLimiter, async (req, res) => {
  const data = await exportUserData(currentUser(req).uid);
  res.setHeader('Content-Disposition', 'attachment; filename="wouaff-export.json"');
  res.json(data);
});

router.delete('/account', authMiddleware, authLimiter, async (req, res) => {
  const user = currentUser(req);
  const full = await findUserByEmail(user.email);
  const { password, code } = req.body ?? {};
  if (!full || typeof password !== 'string' || !(await bcrypt.compare(password, full.passwordHash))) {
    return res.status(403).json({ error: 'Mot de passe incorrect' });
  }
  if (
    full.totp_enabled &&
    full.totp_secret &&
    (typeof code !== 'string' || !verifyTotp(full.totp_secret, code.trim()))
  ) {
    return res.status(400).json({ error: 'Code de double authentification invalide' });
  }
  await deleteAccount(user.uid);
  res.clearCookie('session_id');
  res.json({ ok: true });
});

export default router;
