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

export async function apiGetUsers(): Promise<Pick<User, 'id' | 'name' | 'email'>[]> {
  return apiFetch('/api/users');
}
