/**
 * Client HTTP centralisé pour l'API To-DoX.
 * Utilisé uniquement quand VITE_API_URL est défini (mode API).
 */

export const API_URL = import.meta.env.VITE_API_URL as string | undefined;
export const IS_API_MODE = !!API_URL;

export function getToken(): string | null {
  return localStorage.getItem('api_token');
}

export function saveToken(token: string): void {
  localStorage.setItem('api_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('api_token');
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({ error: res.statusText }));

  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `HTTP ${res.status}`);
  }

  return body as T;
}
