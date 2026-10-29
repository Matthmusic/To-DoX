import type { User } from './types.js';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export interface ClientConfig {
  baseUrl: string;
  email?: string;
  password?: string;
  token?: string;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Client HTTP du backend To-DoX (mêmes routes que src/services/api.ts côté app).
 * Se connecte paresseusement au premier appel, et se reconnecte une fois si le
 * token expire (401) quand email + mot de passe sont fournis.
 */
export class TodoxClient {
  private token: string | null;
  private me: User | null = null;
  private usersCache: { at: number; users: User[] } | null = null;

  constructor(private config: ClientConfig) {
    this.token = config.token ?? null;
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  private async login(): Promise<void> {
    const { email, password } = this.config;
    if (!email || !password) {
      throw new Error(
        'Identifiants manquants : définir TODOX_EMAIL et TODOX_PASSWORD (ou TODOX_TOKEN) dans la config du serveur MCP.'
      );
    }
    const res = await this.raw<{ token: string; user: User }>('POST', '/api/auth/login', { email, password }, false);
    this.token = res.token;
    this.me = res.user;
  }

  private async raw<T>(method: Method, path: string, body: unknown, auth: boolean): Promise<T> {
    const headers: Record<string, string> = {};
    if (auth && this.token) headers.Authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new Error(`Serveur To-DoX injoignable (${this.config.baseUrl}) : ${(e as Error).message}`);
    }

    if (!res.ok) {
      let message = `Erreur serveur (${res.status})`;
      try {
        const errBody = (await res.json()) as { error?: string };
        if (errBody?.error) message = errBody.error;
      } catch {
        /* pas de corps JSON */
      }
      throw new ApiError(res.status, message);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    if (!this.token) await this.login();
    try {
      return await this.raw<T>(method, path, body, true);
    } catch (e) {
      const canRelogin = this.config.email && this.config.password;
      if (e instanceof ApiError && e.status === 401 && canRelogin) {
        await this.login();
        return this.raw<T>(method, path, body, true);
      }
      throw e;
    }
  }

  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body: unknown) { return this.request<T>('POST', path, body); }
  put<T>(path: string, body: unknown) { return this.request<T>('PUT', path, body); }
  patch<T>(path: string, body: unknown) { return this.request<T>('PATCH', path, body); }
  delete(path: string) { return this.request<void>('DELETE', path); }

  /** Utilisateur connecté (celui au nom duquel le MCP agit). */
  async currentUser(): Promise<User> {
    if (this.me) return this.me;
    const res = await this.get<{ user: User }>('/api/auth/me');
    this.me = res.user;
    return this.me;
  }

  /** Annuaire des utilisateurs de l'organisation (cache 60s). */
  async users(): Promise<User[]> {
    if (this.usersCache && Date.now() - this.usersCache.at < 60_000) return this.usersCache.users;
    const users = await this.get<User[]>('/api/users');
    this.usersCache = { at: Date.now(), users };
    return users;
  }
}
