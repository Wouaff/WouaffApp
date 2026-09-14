import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { getOne, query } from '../config/database.js';
import {
  clearCachedSessionsForUid,
  createSession,
  destroySession,
  getSessionUid,
  verifyToken,
} from '../middleware/auth.js';
import { verifyCaptcha } from '../middleware/captcha.js';
import { rateLimitByKey } from '../middleware/rateLimitByKey.js';
import { clearAttempts, registerAttemptFailure, tooManyAttempts } from '../services/attemptLimiter.js';
import { enqueueNewUserAlert } from '../services/discordWebhook.js';
import { genCode, sendVerificationEmail } from '../services/email.js';
import { enqueueJob } from '../services/queue.js';
import { getStaffRole, isStaff, isUserBanned } from '../services/rtdb.js';
import { createLoginChallenge, get2FAStatus } from '../services/twoFA.js';
import { createWelcomePost } from '../services/welcomePost.js';
import type { AuthRequest } from '../types/index.js';
import { getClientIp } from '../utils/clientIp.js';
import { isValidEmail } from '../utils/emailValidation.js';

const router: Router = Router();

const DUMMY_PASSWORD_HASH = '$2b$10$SmCAEr8elAW0mz77ER94/OQ85aQX2MM8HrmitAy7zIHM/uEtIVKNu';
const VERIFY_CODE_WINDOW_MS = 15 * 60 * 1000;
const VERIFY_CODE_MAX_ATTEMPTS = 10;

function genUid(): string {
  return randomUUID().replace(/-/g, '').substring(0, 28);
}

function genToken(): string {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function setSessionCookie(res: Response, sessionId: string): void {
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.APP_URL;
  res.cookie('session_id', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

/* Rate limit par email : 3 inscriptions max par email dans la fenêtre */
const registerEmailLimit = rateLimitByKey({
  windowMs: 3600000,
  max: 3,
  keyFn: (req) => {
    const email = (((req.body as Record<string, unknown>)?.email as string) || '').toLowerCase().trim();
    return email ? `reg:${email}` : '';
  },
  message: "Trop d'inscriptions avec cet email, réessayez plus tard.",
});

/* POST /auth/register */
router.post('/register', registerEmailLimit, verifyCaptcha, async (req: Request, res: Response) => {
  try {
    /* Honeypot : si rempli par un bot, on fait semblant de marcher mais on rejette */
    const honeypot = (req.body as Record<string, unknown>).website as string | undefined;
    if (honeypot) {
      res.status(201).json({ uid: 'fake', pseudo: 'bot', wouaffId: '@fake', emailVerified: false });
      return;
    }

    const { email: rawEmail, password, pseudo } = req.body as { email?: string; password?: string; pseudo?: string };
    const email = (rawEmail || '').trim();
    if (!email || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Adresse email invalide ou non autorisée' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum)' });
      return;
    }
    if (password.length > 72) {
      res.status(400).json({ error: 'Mot de passe trop long (72 caractères maximum)' });
      return;
    }
    const existing = await getOne<{ uid: string }>('SELECT uid FROM users WHERE email = ?', [email]);
    if (existing) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      res.status(400).json({ error: 'Impossible de créer le compte. Si vous avez déjà un compte, connectez-vous.' });
      return;
    }
    if (pseudo && /[A-Z]/.test(pseudo)) {
      res.status(400).json({ error: 'Le pseudo ne peut pas contenir de majuscules' });
      return;
    }
    const basePseudo = (pseudo || email.split('@')[0]).toLowerCase();
    if (basePseudo.length > 49) {
      res.status(400).json({ error: 'Pseudo trop long (49 caractères maximum)' });
      return;
    }
    if (basePseudo.length < 3) {
      res.status(400).json({ error: 'Pseudo trop court (3 caractères minimum)' });
      return;
    }
    if (!/^[a-z0-9_]+$/.test(basePseudo)) {
      res.status(400).json({ error: 'Le pseudo ne peut contenir que des lettres minuscules, chiffres et underscores' });
      return;
    }

    /* Vérifier l'unicité du pseudo avant INSERT (évite l'overwrite de l'index) */
    const pseudoTaken = await getOne<{ uid: string }>('SELECT uid FROM wouaff_id_index WHERE wouaffId = ?', [
      `@${basePseudo}`,
    ]);
    if (pseudoTaken) {
      res.status(409).json({ error: 'Ce pseudo est déjà pris' });
      return;
    }

    /* Délai artificiel pour ralentir les scripts (500ms) */
    await new Promise((r) => setTimeout(r, 500));

    const uid = genUid();
    const finalPseudo = basePseudo;
    const passwordHash = await bcrypt.hash(password, 10);
    const wouaffId = `@${finalPseudo}`;
    await query(
      'INSERT INTO users (uid, pseudo, email, passwordHash, wouaffId, createdAt, emailVerified) VALUES (?,?,?,?,?,?,?)',
      [uid, finalPseudo, email, passwordHash, wouaffId, Date.now(), 0],
    );
    await query('INSERT INTO wouaff_id_index (wouaffId, uid) VALUES (?,?)', [wouaffId, uid]);

    /* Notifier l'inscription sur Discord (via la file, sans bloquer l'inscription) */
    enqueueNewUserAlert({ pseudo: finalPseudo, wouaffId, uid }).catch(() => {});

    const { sessionId } = await createSession(uid, {
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    setSessionCookie(res, sessionId);

    /* Send verification email (via la file asynchrone) */
    const code = genCode();
    await query('INSERT INTO email_tokens (uid, token, type, expiresAt, createdAt) VALUES (?,?,?,?,?)', [
      uid,
      code,
      'verify',
      Date.now() + 900000,
      Date.now(),
    ]);
    enqueueJob('email', { kind: 'verify', to: email, code }).catch(() => {});

    res.status(201).json({ uid, pseudo: finalPseudo, wouaffId, emailVerified: false });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
});

/* POST /auth/login */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email: rawEmail, password } = req.body as { email?: string; password?: string };
    const email = (rawEmail || '').trim();
    if (!email || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis' });
      return;
    }
    const profile = await getOne<{ uid: string; pseudo: string; passwordHash: string | null; avatar: string | null }>(
      'SELECT uid, pseudo, passwordHash, avatar FROM users WHERE email = ?',
      [email],
    );
    if (!profile) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }
    const attemptKey = `login-account:${profile.uid}`;
    if (tooManyAttempts(attemptKey, 8)) {
      res.status(429).json({ error: 'Trop de tentatives pour ce compte, réessayez plus tard' });
      return;
    }
    if (!profile.passwordHash) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }
    const valid = await bcrypt.compare(password, profile.passwordHash);
    if (!valid) {
      registerAttemptFailure(attemptKey, 15 * 60 * 1000);
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }
    clearAttempts(attemptKey);
    const banned = await isUserBanned(profile.uid);
    if (banned) {
      res.status(403).json({ error: 'Ce compte est banni.' });
      return;
    }
    const twoFA = await get2FAStatus(profile.uid);
    if (twoFA.totpEnabled || twoFA.email2faEnabled) {
      const loginChallenge = await createLoginChallenge(profile.uid);
      res.json({
        twoFactorRequired: true,
        loginChallenge,
        twoFactorMethods: {
          totp: twoFA.totpEnabled,
          email: twoFA.email2faEnabled,
          recovery: twoFA.recoveryCodesGenerated,
        },
      });
      return;
    }
    const { sessionId } = await createSession(profile.uid, {
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    setSessionCookie(res, sessionId);
    res.json({ uid: profile.uid, pseudo: profile.pseudo, avatar: profile.avatar });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

/* GET /auth/me */
router.get('/me', verifyToken, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const profile = await getOne<Record<string, unknown>>(
    'SELECT uid, pseudo, email, avatar, banner, bio, wouaffId, status, lastSeen, createdAt, emailVerified FROM users WHERE uid = ?',
    [authReq.uid!],
  );
  if (!profile) {
    res.status(404).json({ error: 'Profil introuvable' });
    return;
  }
  const staff = await isStaff(authReq.uid!);
  const staffRole = staff ? await getStaffRole(authReq.uid!) : null;
  res.json({ ...profile, staff, staffRole, emailVerified: !!profile.emailVerified });
});

/* POST /auth/logout */
router.post('/logout', async (req: Request, res: Response) => {
  const sessionId = req.cookies?.session_id;
  if (sessionId) {
    const session = await getOne<{ uid: string }>('SELECT uid FROM sessions WHERE sessionId = ?', [sessionId]);
    if (session) {
      await query("UPDATE users SET status='offline', lastSeen=? WHERE uid=?", [Date.now(), session.uid]);
    }
    await destroySession(sessionId);
  }
  res.clearCookie('session_id');
  res.json({ success: true });
});

/* POST /auth/forgot-password */
router.post('/forgot-password', verifyCaptcha, async (req: Request, res: Response) => {
  try {
    const { email: rawEmail } = req.body as { email?: string };
    const email = (rawEmail || '').trim();
    if (!email) {
      res.status(400).json({ error: 'Email requis' });
      return;
    }
    const profile = await getOne<{ uid: string }>('SELECT uid FROM users WHERE email = ?', [email]);
    if (!profile) {
      /* Don't reveal if email exists */
      res.json({ success: true });
      return;
    }
    await query("UPDATE email_tokens SET used=1 WHERE uid=? AND type='reset' AND used=0", [profile.uid]);
    const token = genToken();
    await query('INSERT INTO email_tokens (uid, token, type, expiresAt, createdAt) VALUES (?,?,?,?,?)', [
      profile.uid,
      hashToken(token),
      'reset',
      Date.now() + 3600000,
      Date.now(),
    ]);
    /* Envoi de l'email de réinitialisation via la file asynchrone */
    enqueueJob('email', { kind: 'reset', to: email, token }).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    console.error('Forgot-password error:', err);
    res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
  }
});

/* POST /auth/reset-password */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password) {
      res.status(400).json({ error: 'Token et mot de passe requis' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum)' });
      return;
    }
    if (password.length > 72) {
      res.status(400).json({ error: 'Mot de passe trop long (72 caractères maximum)' });
      return;
    }
    const row = await getOne<{ uid: string; id: number }>(
      'SELECT uid, id FROM email_tokens WHERE token=? AND type=? AND used=0 AND expiresAt>?',
      [hashToken(token), 'reset', Date.now()],
    );
    if (!row) {
      res.status(400).json({ error: 'Token invalide ou expiré' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await query('UPDATE users SET passwordHash=? WHERE uid=?', [passwordHash, row.uid]);
    await query("UPDATE email_tokens SET used=1 WHERE uid=? AND type='reset'", [row.uid]);
    /* Destroy all existing sessions for security */
    await query('DELETE FROM sessions WHERE uid=?', [row.uid]);
    clearCachedSessionsForUid(row.uid);
    res.json({ success: true });
  } catch (err) {
    console.error('Reset-password error:', err);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
  }
});

/* POST /auth/send-verification */
router.post('/send-verification', verifyToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const profile = await getOne<{ email: string | null; emailVerified: number }>(
      'SELECT email, emailVerified FROM users WHERE uid=?',
      [authReq.uid!],
    );
    if (!profile?.email) {
      res.status(400).json({ error: 'Aucun email associé à ce compte' });
      return;
    }
    if (profile.emailVerified) {
      res.json({ success: true, alreadyVerified: true });
      return;
    }
    const code = genCode();
    await query("UPDATE email_tokens SET used=1 WHERE uid=? AND type='verify' AND used=0", [authReq.uid!]);
    await query('INSERT INTO email_tokens (uid, token, type, expiresAt, createdAt) VALUES (?,?,?,?,?)', [
      authReq.uid!,
      code,
      'verify',
      Date.now() + 900000,
      Date.now(),
    ]);
    const sent = await sendVerificationEmail(profile.email, code);
    if (!sent) {
      res.status(500).json({
        error: "Impossible d'envoyer l'email. Réessayez plus tard.",
      });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Send-verification error:', err);
    res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
  }
});

/* POST /auth/verify-email */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { code, token } = req.body as { code?: string; token?: string };
    const value = (code || token || '').trim();
    if (!value) {
      res.status(400).json({ error: 'Code requis' });
      return;
    }
    const sessionUid = await getSessionUid(req);
    const attemptKey = sessionUid ? `verify-code:${sessionUid}` : `verify-code:ip:${getClientIp(req)}`;
    if (tooManyAttempts(attemptKey, VERIFY_CODE_MAX_ATTEMPTS)) {
      res.status(429).json({ error: 'Trop de tentatives. Demandez un nouveau code.' });
      return;
    }
    const row = sessionUid
      ? await getOne<{ uid: string; id: number; used: number; expiresAt: number }>(
          'SELECT uid, id, used, expiresAt FROM email_tokens WHERE token=? AND type=? AND uid=? ORDER BY id DESC LIMIT 1',
          [value, 'verify', sessionUid],
        )
      : await getOne<{ uid: string; id: number; used: number; expiresAt: number }>(
          'SELECT uid, id, used, expiresAt FROM email_tokens WHERE token=? AND type=? ORDER BY id DESC LIMIT 1',
          [value, 'verify'],
        );
    if (!row) {
      registerAttemptFailure(attemptKey, VERIFY_CODE_WINDOW_MS);
      res.status(400).json({ error: 'Code invalide' });
      return;
    }
    if (row.expiresAt <= Date.now()) {
      res.status(400).json({ error: 'Code expiré. Demandez un nouveau code.' });
      return;
    }
    if (row.used) {
      const user = await getOne<{ emailVerified: number }>('SELECT emailVerified FROM users WHERE uid=?', [row.uid]);
      if (user?.emailVerified) {
        clearAttempts(attemptKey);
        res.json({ success: true, alreadyVerified: true });
        return;
      }
      registerAttemptFailure(attemptKey, VERIFY_CODE_WINDOW_MS);
      res.status(400).json({ error: 'Code déjà utilisé' });
      return;
    }
    clearAttempts(attemptKey);
    await query('UPDATE users SET emailVerified=1 WHERE uid=?', [row.uid]);
    await query('UPDATE email_tokens SET used=1 WHERE id=?', [row.id]);

    /* Créer le post de bienvenue après vérification de l'email */
    const user = await getOne<{ pseudo: string }>('SELECT pseudo FROM users WHERE uid=?', [row.uid]);
    if (user?.pseudo) {
      const io = req.app.get('io');
      createWelcomePost(io || null, row.uid, user.pseudo).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Verify-email error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification' });
  }
});

export default router;
