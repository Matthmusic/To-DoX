/**
 * Client HTTP centralisé pour l'API To-DoX.
 *
 * Priorité de l'URL :
 *  1. localStorage 'api_server_url'  (configuré par l'utilisateur dans Stockage)
 *  2. import.meta.env.VITE_API_URL   (défini à la compilation pour le dev)
 *  3. undefined → mode local
 */

export const STORAGE_API_KEY = 'api_server_url';

export function getApiUrl(): string | undefined {
  return localStorage.getItem(STORAGE_API_KEY) || (import.meta.env.VITE_API_URL as string | undefined) || undefined;
}

export function setApiUrl(url: string): void {
  const clean = url.replace(/\/$/, ''); // retirer le slash final
  localStorage.setItem(STORAGE_API_KEY, clean);
}

export function clearApiUrl(): void {
  localStorage.removeItem(STORAGE_API_KEY);
}

// Lus une fois au démarrage — changeront après un reload
export const API_URL = getApiUrl();
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
  const url = getApiUrl();
  const token = getToken();
  const res = await fetch(`${url}${path}`, {
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
