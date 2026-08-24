import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { getOne, query } from '../config/database.js';
import { createSession, verifyToken } from '../middleware/auth.js';
import { send2FAEmail } from '../services/email.js';
import {
  deletePasskey,
  findPasskeyByCredentialId,
  listPasskeys,
  savePasskey,
  updatePasskeyCounter,
} from '../services/passkeys.js';
import { isUserBanned } from '../services/rtdb.js';
import {
  consumeLoginChallenge,
  create2FAEmailCode,
  createLoginChallenge,
  generateBackupCodes,
  generateTotpSecret,
  get2FAStatus,
  getLoginChallengeUid,
  hasRecoveryCodes,
  setBackupCodes,
  totpUri,
  verify2FAEmailCode,
  verifyRecoveryCode,
  verifyTotp,
} from '../services/twoFA.js';
import type { AuthRequest } from '../types/index.js';

const router: Router = Router();

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const RP_NAME = 'Wouaff';
const RP_ID = new URL(APP_URL).hostname;
const ORIGIN = APP_URL.replace(/\/$/, '');
const isProd = process.env.NODE_ENV === 'production' || !!process.env.APP_URL;

function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie('session_id', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

async function verifyPassword(uid: string, password: string): Promise<boolean> {
  const row = await getOne<{ passwordHash: string | null }>('SELECT passwordHash FROM users WHERE uid=?', [uid]);
  if (!row?.passwordHash) return false;
  return bcrypt.compare(password, row.passwordHash);
}

/* ---- Challenges WebAuthn en mémoire (process unique) ---- */
const regChallenges = new Map<string, { uid: string; createdAt: number }>();
const authChallenges = new Map<string, { uid?: string; email?: string; createdAt: number }>();
const pendingTotp = new Map<string, { secret: string; createdAt: number }>();

const CHALLENGE_TTL = 10 * 60 * 1000;
function cleanChallenges(): void {
  const now = Date.now();
  for (const [key, value] of regChallenges) if (now - value.createdAt > CHALLENGE_TTL) regChallenges.delete(key);
  for (const [key, value] of authChallenges) if (now - value.createdAt > CHALLENGE_TTL) authChallenges.delete(key);
  for (const [key, value] of pendingTotp) if (now - value.createdAt > CHALLENGE_TTL) pendingTotp.delete(key);
}
setInterval(cleanChallenges, 5 * 60 * 1000).unref();

/* ================= 2FA : vérification à la connexion ================= */

/* POST /2fa/send-email  (pendant la connexion, 2FA email) */
router.post('/2fa/send-email', async (req: Request, res: Response) => {
  try {
    const { loginChallenge } = req.body as { loginChallenge?: string };
    const uid = loginChallenge ? await getLoginChallengeUid(loginChallenge) : null;
    if (!uid) {
      res.status(400).json({ error: 'Session de connexion invalide ou expirée' });
      return;
    }
    const status = await get2FAStatus(uid);
    if (!status.email2faEnabled) {
      res.status(400).json({ error: "La 2FA par email n'est pas activée sur ce compte" });
      return;
    }
    const user = await getOne<{ email: string | null }>('SELECT email FROM users WHERE uid=?', [uid]);
    if (!user?.email) {
      res.status(400).json({ error: 'Aucun email associé à ce compte' });
      return;
    }
    const code = await create2FAEmailCode(uid);
    const sent = await send2FAEmail(user.email, code);
    if (!sent) {
      res.status(500).json({ error: "Impossible d'envoyer l'email (SMTP). Réessayez." });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('2FA send-email error:', err);
    res.status(500).json({ error: "Erreur lors de l'envoi du code" });
  }
});

/* POST /2fa/verify  (pendant la connexion) */
router.post('/2fa/verify', async (req: Request, res: Response) => {
  try {
    const { loginChallenge, code, method } = req.body as {
      loginChallenge?: string;
      code?: string;
      method?: 'totp' | 'email' | 'recovery';
    };
    if (!loginChallenge || !code) {
      res.status(400).json({ error: 'Challenge et code requis' });
      return;
    }
    const uid = await consumeLoginChallenge(loginChallenge);
    if (!uid) {
      res.status(400).json({ error: 'Session de connexion invalide ou expirée' });
      return;
    }
    const status = await get2FAStatus(uid);
    const banned = await isUserBanned(uid);
    if (banned) {
      res.status(403).json({ error: 'Ce compte est banni.' });
      return;
    }

    let valid = false;
    if (await verifyRecoveryCode(uid, code)) {
      valid = true;
    } else if (method === 'totp' && status.totpEnabled) {
      const row = await getOne<{ totpSecret: string | null }>('SELECT totpSecret FROM users WHERE uid=?', [uid]);
      valid = await verifyTotp(code, row?.totpSecret || '');
    } else if (method === 'email' && status.email2faEnabled) {
      valid = await verify2FAEmailCode(uid, code);
    }

    if (!valid) {
      res.status(401).json({ error: 'Code invalide ou expiré' });
      return;
    }

    const profile = await getOne<{ uid: string; pseudo: string; avatar: string | null }>(
      'SELECT uid, pseudo, avatar FROM users WHERE uid=?',
      [uid],
    );
    if (!profile) {
      res.status(401).json({ error: 'Compte introuvable' });
      return;
    }
    const { sessionId } = await createSession(uid, {
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    setSessionCookie(res, sessionId);
    res.json({ uid: profile.uid, pseudo: profile.pseudo, avatar: profile.avatar });
  } catch (err) {
    console.error('2FA verify error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification' });
  }
});

/* ================= 2FA : gestion (connecté) ================= */

/* GET /2fa/status */
router.get('/2fa/status', verifyToken, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const status = await get2FAStatus(authReq.uid!);
  const passkeys = await listPasskeys(authReq.uid!);
  res.json({ ...status, passkeys: passkeys.map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt })) });
});

/* POST /2fa/email/setup  { password, enabled } */
router.post('/2fa/email/setup', verifyToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { password, enabled } = req.body as { password?: string; enabled?: boolean };
    if (!password) {
      res.status(400).json({ error: 'Mot de passe requis' });
      return;
    }
    if (!(await verifyPassword(authReq.uid!, password))) {
      res.status(401).json({ error: 'Mot de passe incorrect' });
      return;
    }
    if (enabled) {
      const user = await getOne<{ email: string | null; emailVerified: number }>(
        'SELECT email, emailVerified FROM users WHERE uid=?',
        [authReq.uid!],
      );
      if (!user?.email || !user.emailVerified) {
        res.status(400).json({ error: "Vous devez d'abord vérifier votre adresse email." });
        return;
      }
      await query('UPDATE users SET email2faEnabled=1 WHERE uid=?', [authReq.uid!]);
      let newRecoveryCodes: string[] | null = null;
      if (!(await hasRecoveryCodes(authReq.uid!))) {
        const codes = generateBackupCodes();
        await setBackupCodes(authReq.uid!, codes.hashed);
        newRecoveryCodes = codes.plain;
      }
      res.json({ success: true, enabled: true, newRecoveryCodes });
      return;
    }
    await query('UPDATE users SET email2faEnabled=0 WHERE uid=?', [authReq.uid!]);
    res.json({ success: true, enabled: false });
  } catch (err) {
    console.error('2FA email setup error:', err);
    res.status(500).json({ error: 'Erreur lors de la configuration' });
  }
});

/* POST /2fa/totp/setup  -> génère un secret en attente */
router.post('/2fa/totp/setup', verifyToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const user = await getOne<{ email: string | null }>('SELECT email FROM users WHERE uid=?', [authReq.uid!]);
    const secret = generateTotpSecret();
    pendingTotp.set(authReq.uid!, { secret, createdAt: Date.now() });
    res.json({ secret, otpauthUrl: totpUri(user?.email || authReq.uid!, secret) });
  } catch (err) {
    console.error('2FA totp setup error:', err);
    res.status(500).json({ error: 'Erreur lors de la configuration' });
  }
});

/* POST /2fa/totp/confirm  { code, password } */
router.post('/2fa/totp/confirm', verifyToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { code, password } = req.body as { code?: string; password?: string };
    if (!code || !password) {
      res.status(400).json({ error: 'Code et mot de passe requis' });
      return;
    }
    if (!(await verifyPassword(authReq.uid!, password))) {
      res.status(401).json({ error: 'Mot de passe incorrect' });
      return;
    }
    const pending = pendingTotp.get(authReq.uid!);
    if (!pending) {
      res.status(400).json({ error: 'Aucun secret en attente. Recommencez la configuration.' });
      return;
    }
    if (!(await verifyTotp(code, pending.secret))) {
      res.status(401).json({ error: "Code invalide. Vérifiez l'heure de votre appareil." });
      return;
    }
    await query('UPDATE users SET totpSecret=?, totpEnabled=1 WHERE uid=?', [pending.secret, authReq.uid!]);
    pendingTotp.delete(authReq.uid!);
    let newRecoveryCodes: string[] | null = null;
    if (!(await hasRecoveryCodes(authReq.uid!))) {
      const codes = generateBackupCodes();
      await setBackupCodes(authReq.uid!, codes.hashed);
      newRecoveryCodes = codes.plain;
    }
    res.json({ success: true, enabled: true, newRecoveryCodes });
  } catch (err) {
    console.error('2FA totp confirm error:', err);
    res.status(500).json({ error: 'Erreur lors de la validation' });
  }
});

/* POST /2fa/totp/disable  { password } */
router.post('/2fa/totp/disable', verifyToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { password } = req.body as { password?: string };
    if (!password || !(await verifyPassword(authReq.uid!, password))) {
      res.status(401).json({ error: 'Mot de passe incorrect' });
      return;
    }
    await query('UPDATE users SET totpSecret=NULL, totpEnabled=0 WHERE uid=?', [authReq.uid!]);
    res.json({ success: true, enabled: false });
  } catch (err) {
    console.error('2FA totp disable error:', err);
    res.status(500).json({ error: 'Erreur lors de la configuration' });
  }
});

/* POST /2fa/recovery/generate  { password } -> régénère les codes */
router.post('/2fa/recovery/generate', verifyToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { password } = req.body as { password?: string };
    if (!password || !(await verifyPassword(authReq.uid!, password))) {
      res.status(401).json({ error: 'Mot de passe incorrect' });
      return;
    }
    const codes = generateBackupCodes();
    await setBackupCodes(authReq.uid!, codes.hashed);
    res.json({ success: true, recoveryCodes: codes.plain });
  } catch (err) {
    console.error('2FA recovery generate error:', err);
    res.status(500).json({ error: 'Erreur lors de la génération' });
  }
});

/* ================= Clés d'accès (passkeys / WebAuthn) ================= */

/* POST /passkey/register/start */
router.post('/passkey/register/start', verifyToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const user = await getOne<{ uid: string; pseudo: string }>('SELECT uid, pseudo FROM users WHERE uid=?', [
      authReq.uid!,
    ]);
    if (!user) {
      res.status(401).json({ error: 'Compte introuvable' });
      return;
    }
    const existing = await listPasskeys(user.uid);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.pseudo,
      userDisplayName: user.pseudo,
      userID: isoBuffer(user.uid),
      attestationType: 'none',
      excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: parseTransports(p.transports) })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    regChallenges.set(options.challenge, { uid: user.uid, createdAt: Date.now() });
    res.json(options);
  } catch (err) {
    console.error('Passkey register start error:', err);
    res.status(500).json({ error: "Erreur lors de l'initialisation" });
  }
});

/* POST /passkey/register/complete  { response, name } */
router.post('/passkey/register/complete', verifyToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { response, name } = req.body as { response?: unknown; name?: string };
    if (!response) {
      res.status(400).json({ error: 'Réponse WebAuthn manquante' });
      return;
    }
    const expectedChallenge = findExpectedChallenge(regChallenges, response);
    if (!expectedChallenge) {
      res.status(400).json({ error: 'Challenge expiré. Réessayez.' });
      return;
    }
    const { uid } = regChallenges.get(expectedChallenge)!;
    if (uid !== authReq.uid!) {
      res.status(403).json({ error: 'Challenge invalide' });
      return;
    }
    const verification = await verifyRegistrationResponse({
      response: response as never,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: "La clé d'accès n'a pas pu être validée" });
      return;
    }
    const { credential } = verification.registrationInfo;
    await savePasskey(uid, (name || "Clé d'accès").slice(0, 100), credential);
    regChallenges.delete(expectedChallenge);
    res.json({ success: true, id: credential.id });
  } catch (err) {
    console.error('Passkey register complete error:', err);
    res.status(400).json({ error: 'Erreur lors de la validation de la clé' });
  }
});

/* GET /passkey/list */
router.get('/passkey/list', verifyToken, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const passkeys = await listPasskeys(authReq.uid!);
  res.json(passkeys.map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt, lastUsedAt: p.lastUsedAt })));
});

/* DELETE /passkey/:id */
router.delete('/passkey/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'Identifiant invalide' });
      return;
    }
    const ok = await deletePasskey(id, authReq.uid!);
    if (!ok) {
      res.status(404).json({ error: "Clé d'accès introuvable" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Passkey delete error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

/* POST /passkey/login/start  { email? } */
router.post('/passkey/login/start', async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    let uid: string | null = null;
    let allowCredentials: { id: string; transports: Transport[] }[] = [];
    if (email) {
      const profile = await getOne<{ uid: string }>('SELECT uid FROM users WHERE email=?', [email.trim()]);
      if (profile) {
        uid = profile.uid;
        const existing = await listPasskeys(uid);
        allowCredentials = existing.map((p) => ({ id: p.credentialId, transports: parseTransports(p.transports) }));
      }
    }
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: 'preferred',
    });
    authChallenges.set(options.challenge, {
      uid: uid ?? undefined,
      email: email?.trim() || undefined,
      createdAt: Date.now(),
    });
    res.json(options);
  } catch (err) {
    console.error('Passkey login start error:', err);
    res.status(500).json({ error: "Erreur lors de l'initialisation" });
  }
});

/* POST /passkey/login/complete  { response } */
router.post('/passkey/login/complete', async (req: Request, res: Response) => {
  try {
    const { response } = req.body as { response?: unknown };
    if (!response) {
      res.status(400).json({ error: 'Réponse WebAuthn manquante' });
      return;
    }
    const expectedChallenge = findExpectedChallenge(authChallenges, response);
    if (!expectedChallenge) {
      res.status(400).json({ error: 'Challenge expiré. Réessayez.' });
      return;
    }
    const entry = authChallenges.get(expectedChallenge)!;
    const credentialId = (response as { id?: string }).id;
    if (!credentialId) {
      res.status(400).json({ error: 'Identifiant de clé manquant' });
      return;
    }
    const passkey = await findPasskeyByCredentialId(credentialId);
    if (!passkey) {
      res.status(400).json({ error: "Cette clé d'accès n'est pas reconnue" });
      return;
    }
    const verification = await verifyAuthenticationResponse({
      response: response as never,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: passkey.credentialId,
        publicKey: isoBase64URL.toBuffer(passkey.publicKey),
        counter: passkey.counter,
        transports: parseTransports(passkey.transports),
      },
    });
    if (!verification.verified) {
      res.status(400).json({ error: 'Signature de la clé invalide' });
      return;
    }
    await updatePasskeyCounter(passkey.id, verification.authenticationInfo.newCounter);
    authChallenges.delete(expectedChallenge);

    const uid = entry.uid || passkey.uid;
    const banned = await isUserBanned(uid);
    if (banned) {
      res.status(403).json({ error: 'Ce compte est banni.' });
      return;
    }
    const status = await get2FAStatus(uid);
    if (status.totpEnabled || status.email2faEnabled) {
      const loginChallenge = await createLoginChallenge(uid);
      res.json({
        twoFactorRequired: true,
        loginChallenge,
        twoFactorMethods: {
          totp: status.totpEnabled,
          email: status.email2faEnabled,
          recovery: status.recoveryCodesGenerated,
        },
      });
      return;
    }
    const profile = await getOne<{ uid: string; pseudo: string; avatar: string | null }>(
      'SELECT uid, pseudo, avatar FROM users WHERE uid=?',
      [uid],
    );
    const { sessionId } = await createSession(uid, {
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    setSessionCookie(res, sessionId);
    res.json({
      uid,
      pseudo: profile?.pseudo ?? '',
      avatar: profile?.avatar ?? null,
    });
  } catch (err) {
    console.error('Passkey login complete error:', err);
    res.status(400).json({ error: "La clé d'accès n'a pas pu être validée" });
  }
});

function isoBuffer(value: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(value) as unknown as Uint8Array<ArrayBuffer>;
}

type Transport = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';

function parseTransports(raw: string | null): Transport[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? (parsed.filter((t): t is Transport => isValidTransport(t)) as Transport[]) : [];
  } catch {
    return [];
  }
}

function isValidTransport(value: string): value is Transport {
  return (
    value === 'ble' ||
    value === 'cable' ||
    value === 'hybrid' ||
    value === 'internal' ||
    value === 'nfc' ||
    value === 'smart-card' ||
    value === 'usb'
  );
}

function findExpectedChallenge<T extends { createdAt: number }>(map: Map<string, T>, response: unknown): string | null {
  const clientData = (response as { clientDataJSON?: string }).clientDataJSON;
  if (!clientData) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(isoBase64URL.toBuffer(clientData))) as { challenge?: string };
    if (parsed.challenge && map.has(parsed.challenge)) return parsed.challenge;
  } catch {
    /* ignore */
  }
  return null;
}

export default router;
