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

// ── Canal d'erreur partagé (review finale de branche, fixes I3/I4) ─────────────────────
// Avant cette branche, les mutations étaient 100% locales et ne pouvaient jamais échouer.
// Désormais ~40 actions du store passent par le réseau, sans qu'aucune ne reporte l'échec
// à l'utilisateur -- un commentaire/rapport/template qui échoue est silencieusement perdu.
// `onRequestError`/`onUnauthorized` sont enregistrés une seule fois au démarrage de l'app
// (voir useApiSync.ts) avec un accès au store -- ce fichier ne peut PAS importer
// `store/useStore.ts` directement (le store importe déjà `api.ts`, import circulaire).
let onRequestError: ((message: string) => void) | null = null;
let onUnauthorized: (() => void) | null = null;

export function setRequestErrorHandler(fn: ((message: string) => void) | null): void {
  onRequestError = fn;
}

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

interface RequestOptions {
  // Certains appels authentifiés ont leur propre 401 "métier" qui ne signifie PAS
  // "token expiré/révoqué" (ex: changePassword -- mauvais mot de passe ACTUEL, la session
  // reste valide). Sans ce drapeau, le canal d'erreur partagé interpréterait ce 401 comme un
  // token mort et déconnecterait l'utilisateur pour une simple faute de frappe. Voir
  // changePassword() ci-dessous, seul appelant actuel.
  suppressGlobalErrorHandling?: boolean;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  token?: string,
  options?: RequestOptions
): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // Échec réseau (serveur injoignable, pas de connexion...) -- `token` distingue un appel
    // authentifié (post-connexion) d'un appel non-authentifié (essentiellement login(), qui
    // n'envoie jamais de token) : login() a sa propre UI d'erreur dédiée (LoginModal), pas de
    // double report ici pour ce cas (voir aussi la branche 401 ci-dessous, même logique).
    if (token && !options?.suppressGlobalErrorHandling) onRequestError?.('Erreur de connexion au serveur');
    throw e;
  }

  if (!res.ok) {
    let message = `Erreur serveur (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error) message = errBody.error;
    } catch {
      /* pas de corps JSON, on garde le message générique */
    }

    if (token && !options?.suppressGlobalErrorHandling) {
      // 401 avec token fourni = token expiré/révoqué (login() lui-même n'envoie jamais de
      // token, donc un 401 sans token est un échec de connexion normal, géré par LoginModal,
      // pas ici) -- déclenche un retour propre à l'écran de connexion plutôt que de laisser
      // l'app bloquée sur un spinner avec chaque requête suivante en échec silencieux.
      if (res.status === 401) onUnauthorized?.();
      else onRequestError?.(message);
    }

    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiGet = <T>(path: string, token?: string) => request<T>('GET', path, undefined, token);
export const apiPost = <T>(path: string, body: unknown, token?: string, options?: RequestOptions) => request<T>('POST', path, body, token, options);
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

export async function changePassword(currentPassword: string, newPassword: string, token: string): Promise<void> {
  try {
    await apiPost<{ ok: true }>('/api/auth/change-password', { currentPassword, newPassword }, token, { suppressGlobalErrorHandling: true });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      throw new ApiError(401, 'Mot de passe actuel incorrect');
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
