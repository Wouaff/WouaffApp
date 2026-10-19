const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: isForm
      ? { ...(options.headers as Record<string, string>) }
      : { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: 'Erreur réseau' }))) as Record<string, unknown>;
    /* Session expirée en cours d'usage : on prévient l'AuthProvider (hors écran de connexion). */
    if ((res.status === 401 && !path.startsWith('/auth/')) || body.code === 'ACCOUNT_BANNED') {
      window.dispatchEvent(new Event('wouaff:unauthorized'));
    }
    throw new ApiError(typeof body.error === 'string' ? body.error : `Erreur ${res.status}`, res.status, body);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', body: formData }),
};

export function errorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
