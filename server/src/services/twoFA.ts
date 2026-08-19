import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verify } from 'otplib';
import { getOne, query } from '../config/database.js';

export const TOTP_ISSUER = 'Wouaff';

export function generateTotpSecret(): string {
  return generateSecret();
}

export function totpUri(account: string, secret: string): string {
  return generateURI({ issuer: TOTP_ISSUER, label: `${TOTP_ISSUER}:${account}`, secret });
}

export async function verifyTotp(code: string, secret: string): Promise<boolean> {
  if (!secret) return false;
  try {
    const result = await verify({ secret, token: code.replace(/\s/g, '') });
    return result.valid;
  } catch {
    return false;
  }
}

function backupChunk(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(4);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function formatBackupCode(): string {
  return [backupChunk(), backupChunk(), backupChunk()].join('-');
}

export function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function generateBackupCodes(count = 10): { plain: string[]; hashed: string[] } {
  const plain = Array.from({ length: count }, () => formatBackupCode());
  const hashed = plain.map((c) => bcrypt.hashSync(normalizeRecoveryCode(c), 8));
  return { plain, hashed };
}

export async function verifyRecoveryCode(uid: string, code: string): Promise<boolean> {
  const row = await getOne<{ backupCodes: string | null }>('SELECT backupCodes FROM users WHERE uid=?', [uid]);
  if (!row?.backupCodes) return false;
  let hashes: string[] = [];
  try {
    hashes = JSON.parse(row.backupCodes) as string[];
  } catch {
    return false;
  }
  const normalized = normalizeRecoveryCode(code);
  let matched = false;
  const remaining: string[] = [];
  for (const hash of hashes) {
    if (!matched && (await bcrypt.compare(normalized, hash))) {
      matched = true;
      continue;
    }
    remaining.push(hash);
  }
  if (matched) {
    await query('UPDATE users SET backupCodes=? WHERE uid=?', [JSON.stringify(remaining), uid]);
  }
  return matched;
}

export async function hasRecoveryCodes(uid: string): Promise<boolean> {
  const row = await getOne<{ backupCodes: string | null }>('SELECT backupCodes FROM users WHERE uid=?', [uid]);
  return !!row?.backupCodes;
}

export type TwoFAStatus = {
  totpEnabled: boolean;
  email2faEnabled: boolean;
  recoveryCodesGenerated: boolean;
};

export async function get2FAStatus(uid: string): Promise<TwoFAStatus> {
  const row = await getOne<{ totpEnabled: number; email2faEnabled: number; backupCodes: string | null }>(
    'SELECT totpEnabled, email2faEnabled, backupCodes FROM users WHERE uid=?',
    [uid],
  );
  return {
    totpEnabled: !!row?.totpEnabled,
    email2faEnabled: !!row?.email2faEnabled,
    recoveryCodesGenerated: !!row?.backupCodes,
  };
}

export async function setBackupCodes(uid: string, hashed: string[]): Promise<void> {
  await query('UPDATE users SET backupCodes=? WHERE uid=?', [JSON.stringify(hashed), uid]);
}

/* ---- Challenge de connexion en attente de 2FA ---- */

export async function createLoginChallenge(uid: string): Promise<string> {
  const challenge = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').substring(0, 12);
  const now = Date.now();
  await query('INSERT INTO login_challenges (challenge, uid, createdAt, expiresAt) VALUES (?,?,?,?)', [
    challenge,
    uid,
    now,
    now + 5 * 60 * 1000,
  ]);
  return challenge;
}

export async function getLoginChallengeUid(challenge: string): Promise<string | null> {
  const row = await getOne<{ uid: string }>('SELECT uid FROM login_challenges WHERE challenge=? AND expiresAt>?', [
    challenge,
    Date.now(),
  ]);
  return row?.uid ?? null;
}

export async function consumeLoginChallenge(challenge: string): Promise<string | null> {
  const row = await getOne<{ uid: string }>('SELECT uid FROM login_challenges WHERE challenge=? AND expiresAt>?', [
    challenge,
    Date.now(),
  ]);
  if (!row) return null;
  await query('DELETE FROM login_challenges WHERE challenge=?', [challenge]);
  return row.uid;
}

/* ---- Code 2FA par email ---- */

export async function create2FAEmailCode(uid: string): Promise<string> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await query('INSERT INTO email_tokens (uid, token, type, expiresAt, createdAt) VALUES (?,?,?,?,?)', [
    uid,
    code,
    '2fa',
    Date.now() + 10 * 60 * 1000,
    Date.now(),
  ]);
  return code;
}

export async function verify2FAEmailCode(uid: string, code: string): Promise<boolean> {
  const row = await getOne<{ id: number; used: number; expiresAt: number }>(
    'SELECT id, used, expiresAt FROM email_tokens WHERE uid=? AND token=? AND type=? ORDER BY id DESC LIMIT 1',
    [uid, code.trim(), '2fa'],
  );
  if (!row || row.used || row.expiresAt <= Date.now()) return false;
  await query('UPDATE email_tokens SET used=1 WHERE id=?', [row.id]);
  return true;
}
