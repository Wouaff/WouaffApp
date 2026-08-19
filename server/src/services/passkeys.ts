import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { getOne, query } from '../config/database.js';

export type PasskeyRow = {
  id: number;
  uid: string;
  name: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string | null;
  createdAt: number;
  lastUsedAt: number;
};

export async function listPasskeys(uid: string): Promise<PasskeyRow[]> {
  return query<PasskeyRow[]>('SELECT * FROM passkeys WHERE uid=? ORDER BY createdAt DESC', [uid]);
}

export async function findPasskeyByCredentialId(credentialId: string): Promise<PasskeyRow | null> {
  const row = await getOne<PasskeyRow>('SELECT * FROM passkeys WHERE credentialId=?', [credentialId]);
  return row ?? null;
}

export function parseTransports(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePasskey(
  uid: string,
  name: string,
  credential: { id: string; publicKey: Uint8Array; counter: number; transports?: string[] },
): Promise<void> {
  await query(
    'INSERT INTO passkeys (uid, name, credentialId, publicKey, counter, transports, createdAt) VALUES (?,?,?,?,?,?,?)',
    [
      uid,
      name,
      credential.id,
      isoBase64URL.fromBuffer(credential.publicKey as unknown as Uint8Array<ArrayBuffer>),
      credential.counter,
      credential.transports ? JSON.stringify(credential.transports) : null,
      Date.now(),
    ],
  );
}

export async function deletePasskey(id: number, uid: string): Promise<boolean> {
  const result = await query('DELETE FROM passkeys WHERE id=? AND uid=?', [id, uid]);
  const affected = (result as { affectedRows?: number })?.affectedRows ?? 0;
  return affected > 0;
}

export async function updatePasskeyCounter(id: number, counter: number): Promise<void> {
  await query('UPDATE passkeys SET counter=?, lastUsedAt=? WHERE id=?', [counter, Date.now(), id]);
}
