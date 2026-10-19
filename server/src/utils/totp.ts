import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += ALPHABET[Number.parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(input: string): Buffer {
  let bits = '';
  for (const ch of input.replace(/=+$/, '').toUpperCase()) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Secret invalide');
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

function safeEqual(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/* Tolère ±1 pas de 30 s (décalage d'horloge). Renvoie le pas qui correspond au code, ou null.
   `lastStep` = dernier pas déjà consommé pour ce compte : un code ne peut servir qu'une fois (anti-rejeu). */
export function verifyTotpStep(secret: string, code: string, lastStep?: number | null): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  try {
    const now = Math.floor(Date.now() / 30_000);
    let match: number | null = null;
    for (const delta of [-1, 0, 1]) {
      const step = now + delta;
      if (safeEqual(hotp(secret, step), code) && (lastStep == null || step > lastStep)) match = step;
    }
    return match;
  } catch {
    return null; // secret illisible : jamais un 500, simplement un code refusé
  }
}

export function verifyTotp(secret: string, code: string): boolean {
  return verifyTotpStep(secret, code) !== null;
}

export function totpUri(secret: string, account: string, issuer = 'Wouaff'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
