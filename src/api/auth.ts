import { apiFetch, saveToken } from './client';
import type { User } from '../types';

interface AuthResponse {
  token: string;
  user: Pick<User, 'id' | 'name' | 'email'>;
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  saveToken(data.token);
  return data;
}

export async function apiGetMe(): Promise<Pick<User, 'id' | 'name' | 'email'>> {
  return apiFetch('/api/users/me');
}

// Endpoint public — utilisé sur l'écran de login (pas de token requis)
export async function apiGetPublicUsers(): Promise<Pick<User, 'id' | 'name' | 'email'>[]> {
  return apiFetch('/api/auth/users');
}

export async function apiGetUsers(): Promise<User[]> {
  return apiFetch('/api/users');
}

export async function apiResetUserPassword(userId: string, password: string): Promise<void> {
  await apiFetch(`/api/users/${userId}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ password }),
  });
}

export async function apiSetUserAdmin(userId: string, isAdmin: boolean): Promise<User> {
  return apiFetch(`/api/users/${userId}/admin`, {
    method: 'PATCH',
    body: JSON.stringify({ isAdmin }),
  });
}
