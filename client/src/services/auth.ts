import { api } from './api';

export interface CurrentUser {
  uid: string;
  pseudo: string;
  email: string;
  displayName: string | null;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  verified: boolean;
  createdAt: number;
}

export async function login(email: string, password: string) {
  return api.post<{ uid: string; pseudo: string }>('/auth/login', { email, password });
}

export async function register(pseudo: string, email: string, password: string) {
  return api.post<{ uid: string; pseudo: string }>('/auth/register', { pseudo, email, password });
}

export async function logout() {
  return api.post('/auth/logout');
}

export async function getMe() {
  return api.get<CurrentUser>('/auth/me');
}
