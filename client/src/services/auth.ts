import { clearE2EE, getPublicKey, initE2EE } from './e2ee';
import type { LoginResult } from './security';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export async function register(
  email: string,
  password: string,
  pseudo: string,
  capToken?: string,
): Promise<{ uid: string; pseudo: string; wouaffId: string }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, pseudo, capToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur lors de l'inscription");
  return data;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Email ou mot de passe incorrect');
  return data;
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  clearE2EE();
}

export function getSessionId(): string | null {
  return getCookie('session_id');
}

export async function initSession(uid: string): Promise<void> {
  try {
    await initE2EE(uid, async (e2eeUid: string) => {
      const res = await fetch(`/api/profiles/${e2eeUid}/publicKey`);
      const data = await res.json();
      return data.publicKey as JsonWebKey | null;
    });
    const pubKey = getPublicKey();
    if (pubKey) {
      const keyStr = JSON.stringify(pubKey);
      const prevKey = localStorage.getItem('wouaff_e2ee_pubkey');
      if (keyStr !== prevKey) {
        await fetch('/api/profiles/me/publicKey', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicKey: pubKey }),
        });
        localStorage.setItem('wouaff_e2ee_pubkey', keyStr);
      }
    }
  } catch (e) {
    console.warn('E2EE init failed', e);
  }
}
