import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/* Chiffrement au repos des secrets TOTP (AES-256-GCM).
   La clé vient uniquement de l'environnement : TOTP_ENCRYPTION_KEY, 64 caractères hexadécimaux
   (`openssl rand -hex 32`). Sans clé, les secrets restent en clair comme avant. */
const PREFIX = 'enc:v1:';

function getKey(): Buffer | null {
  const raw = (process.env.TOTP_ENCRYPTION_KEY || '').trim();
  if (!raw) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('TOTP_ENCRYPTION_KEY invalide : 64 caractères hexadécimaux attendus (openssl rand -hex 32)');
  }
  return Buffer.from(raw, 'hex');
}

/* Appelé au démarrage : une clé mal formée doit empêcher de démarrer, pas échouer plus tard. */
export function assertSecretsConfig(): void {
  getKey();
}

export function isSecretEncryptionEnabled(): boolean {
  return getKey() !== null;
}

export function encryptSecret(plain: string): string {
  const key = getKey();
  if (!key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

/* Valeur lisible, ou null si elle est chiffrée et ne peut pas être déchiffrée (clé absente ou changée). */
export function decryptSecret(stored: string | null): string | null {
  if (!stored) return stored;
  if (!stored.startsWith(PREFIX)) return stored;
  let key: Buffer | null = null;
  try {
    key = getKey();
  } catch {
    key = null;
  }
  if (!key) {
    console.error('[SECRETS] Secret chiffré mais TOTP_ENCRYPTION_KEY absente ou invalide');
    return null;
  }
  try {
    const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    console.error('[SECRETS] Déchiffrement impossible (clé différente de celle utilisée pour chiffrer ?)');
    return null;
  }
}
