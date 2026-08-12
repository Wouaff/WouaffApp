import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { getOne, query } from '../config/database.js';
import { createSession, verifyToken } from '../middleware/auth.js';
import { verifyCaptcha } from '../middleware/captcha.js';
import { enqueueNewUserAlert } from '../services/discordWebhook.js';
import { genCode, getLastEmailError, sendVerificationEmail } from '../services/email.js';
import { enqueueJob } from '../services/queue.js';
import { getStaffRole, isStaff, isUserBanned } from '../services/rtdb.js';
import type { AuthRequest } from '../types/index.js';

const router: Router = Router();

function genUid(): string {
  return randomUUID().replace(/-/g, '').substring(0, 28);
}

function genToken(): string {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
}

function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie('session_id', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

/* POST /auth/register */
router.post('/register', verifyCaptcha, async (req: Request, res: Response) => {
  try {
    const { email, password, pseudo } = req.body as { email?: string; password?: string; pseudo?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' });
      return;
    }
    const existing = await getOne<{ uid: string }>('SELECT uid FROM users WHERE email = ?', [email]);
    if (existing) {
      res.status(409).json({ error: 'Cet email est déjà utilisé' });
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
    const uid = genUid();
    const finalPseudo = basePseudo;
    const passwordHash = await bcrypt.hash(password, 10);
    const wouaffId = `@${finalPseudo}`;
    await query(
      'INSERT INTO users (uid, pseudo, email, passwordHash, wouaffId, createdAt, emailVerified) VALUES (?,?,?,?,?,?,?)',
      [uid, finalPseudo, email, passwordHash, wouaffId, Date.now(), 0],
    );
    await query('INSERT INTO wouaff_id_index (wouaffId, uid) VALUES (?,?) ON DUPLICATE KEY UPDATE uid=VALUES(uid)', [
      wouaffId,
      uid,
    ]);

    /* Notifier l'inscription sur Discord (via la file, sans bloquer l'inscription) */
    enqueueNewUserAlert({ pseudo: finalPseudo, wouaffId, uid }).catch(() => {});

    const { sessionId } = await createSession(uid, {
      ip: req.ip,
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
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis' });
      return;
    }
    const profile = await getOne<{ uid: string; pseudo: string; passwordHash: string | null; avatar: string | null }>(
      'SELECT uid, pseudo, passwordHash, avatar FROM users WHERE email = ?',
      [email],
    );
    if (!profile) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }
    if (!profile.passwordHash) {
      res.status(401).json({ error: 'Compte migré, connexion temporairement indisponible' });
      return;
    }
    const valid = await bcrypt.compare(password, profile.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }
    const banned = await isUserBanned(profile.uid);
    if (banned) {
      res.status(403).json({ error: 'Ce compte est banni.' });
      return;
    }
    const { sessionId } = await createSession(profile.uid, {
      ip: req.ip,
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
    await query('DELETE FROM sessions WHERE sessionId = ?', [sessionId]);
  }
  res.clearCookie('session_id');
  res.json({ success: true });
});

/* POST /auth/forgot-password */
router.post('/forgot-password', verifyCaptcha, async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
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
    const token = genToken();
    await query('INSERT INTO email_tokens (uid, token, type, expiresAt, createdAt) VALUES (?,?,?,?,?)', [
      profile.uid,
      token,
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
    if (password.length < 6) {
      res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' });
      return;
    }
    const row = await getOne<{ uid: string; id: number }>(
      'SELECT uid, id FROM email_tokens WHERE token=? AND type=? AND used=0 AND expiresAt>?',
      [token, 'reset', Date.now()],
    );
    if (!row) {
      res.status(400).json({ error: 'Token invalide ou expiré' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await query('UPDATE users SET passwordHash=? WHERE uid=?', [passwordHash, row.uid]);
    await query('UPDATE email_tokens SET used=1 WHERE id=?', [row.id]);
    /* Destroy all existing sessions for security */
    await query('DELETE FROM sessions WHERE uid=?', [row.uid]);
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
        error: `Impossible d'envoyer l'email (SMTP). Détail : ${getLastEmailError() || 'inconnu'}`,
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
    const row = await getOne<{ uid: string; id: number; used: number; expiresAt: number }>(
      'SELECT uid, id, used, expiresAt FROM email_tokens WHERE token=? AND type=? ORDER BY id DESC LIMIT 1',
      [value, 'verify'],
    );
    if (!row) {
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
        res.json({ success: true, alreadyVerified: true });
        return;
      }
      res.status(400).json({ error: 'Code déjà utilisé' });
      return;
    }
    await query('UPDATE users SET emailVerified=1 WHERE uid=?', [row.uid]);
    await query('UPDATE email_tokens SET used=1 WHERE id=?', [row.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Verify-email error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification' });
  }
});

export default router;
