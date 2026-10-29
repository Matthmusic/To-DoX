import { readFileSync, statSync } from 'node:fs';
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
  /**
   * Fichier de session écrit par l'app To-DoX (mode intégré) : { apiUrl, token, userId }.
   * Relu à chaque modification, pour suivre les reconnexions faites dans l'app.
   */
  sessionFile?: string;
}

interface SessionFile {
  apiUrl: string;
  token: string;
  userId?: string;
}

const SESSION_MISSING =
  "Aucune session To-DoX : ouvre l'application To-DoX et connecte-toi, puis réessaie.";
const SESSION_EXPIRED =
  "Session To-DoX expirée : ouvre l'application To-DoX et reconnecte-toi, puis réessaie.";

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
  private sessionMtime = 0;

  constructor(private config: ClientConfig) {
    this.token = config.token ?? null;
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  /** Recharge le fichier de session de l'app s'il a changé (connexion, changement de compte). */
  private loadSession(): void {
    const file = this.config.sessionFile;
    if (!file) return;
    let mtime: number;
    try {
      mtime = statSync(file).mtimeMs;
    } catch {
      this.token = null;
      throw new Error(SESSION_MISSING);
    }
    if (mtime === this.sessionMtime && this.token) return;
    let session: SessionFile;
    try {
      session = JSON.parse(readFileSync(file, 'utf-8')) as SessionFile;
    } catch {
      throw new Error(SESSION_MISSING);
    }
    if (!session.token || !session.apiUrl) throw new Error(SESSION_MISSING);
    this.sessionMtime = mtime;
    if (session.token !== this.token) {
      this.me = null;
      this.usersCache = null;
    }
    this.token = session.token;
    this.config.baseUrl = session.apiUrl.replace(/\/+$/, '');
  }

  private async login(): Promise<void> {
    if (this.config.sessionFile) throw new Error(SESSION_EXPIRED);
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
    this.loadSession();
    if (!this.token) await this.login();
    try {
      return await this.raw<T>(method, path, body, true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        if (this.config.sessionFile) throw new Error(SESSION_EXPIRED);
        if (this.config.email && this.config.password) {
          await this.login();
          return this.raw<T>(method, path, body, true);
        }
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
    this.loadSession(); // un changement de compte dans l'app invalide `me`
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
