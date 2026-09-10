/** Injecté au build via les variables d'env VITE_ (voir .env.production.example).
 *  Fallback sur le backend local pour que `npm run dev` fonctionne sans config supplémentaire. */
const API_BASE_URL: string = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Erreur serveur (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error) message = errBody.error;
    } catch {
      /* pas de corps JSON, on garde le message générique */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiGet = <T>(path: string, token?: string) => request<T>('GET', path, undefined, token);
export const apiPost = <T>(path: string, body: unknown, token?: string) => request<T>('POST', path, body, token);
export const apiPut = <T>(path: string, body: unknown, token?: string) => request<T>('PUT', path, body, token);
export const apiPatch = <T>(path: string, body: unknown, token?: string) => request<T>('PATCH', path, body, token);
export const apiDelete = (path: string, token?: string) => request<void>('DELETE', path, undefined, token);

export interface LoginResult {
  token: string;
  user: { id: string; email: string; name: string; role: string };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    return await apiPost<LoginResult>('/api/auth/login', { email, password });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      throw new ApiError(401, 'Email ou mot de passe incorrect');
    }
    throw e;
  }
}

// --- Stockage sécurisé du token JWT ---------------------------------------
// Un token par utilisateur (id), pour que plusieurs profils sur le même poste
// gardent des sessions indépendantes. Electron : IPC vers safeStorage (chiffré
// par l'OS). Web (hors Electron) : localStorage en clair, seul fallback possible
// dans un navigateur -- acceptable ici car le backend n'est de toute façon exposé
// qu'en LAN (voir DEPLOY.md côté todox-backend).

export async function saveToken(userId: string, token: string): Promise<void> {
  if (window.electronAPI?.isElectron) {
    await window.electronAPI.authSaveToken(userId, token);
  } else {
    localStorage.setItem(`auth_token_${userId}`, token);
  }
}

export async function getToken(userId: string): Promise<string | null> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.authGetToken(userId);
  }
  return localStorage.getItem(`auth_token_${userId}`);
}

export async function clearToken(userId: string): Promise<void> {
  if (window.electronAPI?.isElectron) {
    await window.electronAPI.authClearToken(userId);
  } else {
    localStorage.removeItem(`auth_token_${userId}`);
  }
}
