import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';

export { browserSupportsWebAuthn };

export type TwoFactorMethods = { totp: boolean; email: boolean; recovery: boolean };
export type LoginResult =
  | { twoFactorRequired: true; loginChallenge: string; twoFactorMethods: TwoFactorMethods }
  | { uid: string; pseudo: string; avatar?: string | null };

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api/auth${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
  return data as T;
}

/* ── 2FA : étape de connexion ── */
export const twoFactor = {
  sendEmail: (loginChallenge: string) => request<{ success: true }>('POST', '/2fa/send-email', { loginChallenge }),
  verify: (loginChallenge: string, code: string, method: 'totp' | 'email' | 'recovery') =>
    request<LoginResult>('POST', '/2fa/verify', { loginChallenge, code, method }),
  status: () => request<SecurityStatus>('GET', '/2fa/status'),
  enableEmail: (password: string, enabled: boolean) =>
    request<{ success: true; enabled: boolean; newRecoveryCodes?: string[] | null }>('POST', '/2fa/email/setup', {
      password,
      enabled,
    }),
  startTotpSetup: () => request<{ secret: string; otpauthUrl: string }>('POST', '/2fa/totp/setup'),
  confirmTotpSetup: (code: string, password: string) =>
    request<{ success: true; enabled: boolean; newRecoveryCodes?: string[] | null }>('POST', '/2fa/totp/confirm', {
      code,
      password,
    }),
  disableTotp: (password: string) =>
    request<{ success: true; enabled: boolean }>('POST', '/2fa/totp/disable', { password }),
  generateRecovery: (password: string) =>
    request<{ success: true; recoveryCodes: string[] }>('POST', '/2fa/recovery/generate', { password }),
};

export type SecurityStatus = {
  totpEnabled: boolean;
  email2faEnabled: boolean;
  recoveryCodesGenerated: boolean;
  passkeys: { id: number; name: string; createdAt: number }[];
};

/* ── Clés d'accès (passkeys / WebAuthn) ── */
export const passkeys = {
  list: () => request<{ id: number; name: string; createdAt: number; lastUsedAt: number }[]>('GET', '/passkey/list'),
  remove: (id: number) => request<{ success: true }>('DELETE', `/passkey/${id}`),
  register: async (name: string): Promise<void> => {
    const options = await request<PublicKeyCredentialCreationOptionsJSON>('POST', '/passkey/register/start');
    const response = await startRegistration({ optionsJSON: options });
    await request<{ success: true }>('POST', '/passkey/register/complete', { response, name });
  },
  login: async (email?: string): Promise<LoginResult> => {
    const options = await request<PublicKeyCredentialRequestOptionsJSON>('POST', '/passkey/login/start', { email });
    const response = await startAuthentication({ optionsJSON: options });
    return request<LoginResult>('POST', '/passkey/login/complete', { response });
  },
};

export function isPasskeyResult(data: unknown): data is Extract<LoginResult, { twoFactorRequired: true }> {
  return !!data && typeof data === 'object' && 'twoFactorRequired' in data;
}
