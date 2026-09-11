# Bascule transparente — Phase 1 : intégration frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current localStorage/OneDrive (`data.json`/`comments.json`) persistence layer with a REST client talking to the already-deployed `todox-backend` (Express + JWT + Postgres, running on LXC `todox-backend-dev`), with a real login screen and encrypted token storage — with zero functional regression versus the current app.

**Architecture:** A new `src/services/api.ts` typed HTTP client (one function per backend route) becomes the single point of contact with the server. Every `useStore` action that currently mutates local state directly is converted to call the API first and update state from the server's response (server becomes the source of truth for ids/timestamps). A new umbrella hook (`useApiSync`) replaces `useDataPersistence`: initial load via a batch of GETs, then a light periodic refresh (10s interval + window-focus refetch) instead of the old 2s file-hash-diff poll. Login becomes real: the existing "click your name" grid is preserved, but selecting a user with no valid stored session prompts for a password, calls `POST /api/auth/login`, and stores the JWT encrypted via Electron's `safeStorage`, one token per user id so multiple profiles on the same machine keep independent sessions.

**Tech Stack:** React 19, Zustand 5, Electron 32 (`safeStorage`, new IPC channels), native `fetch` (no new HTTP library — see Task 1 rationale), Vitest + Testing Library (existing).

**Spec:** [docs/superpowers/specs/2026-09-10-transparent-backend-cutover-design.md](../specs/2026-09-10-transparent-backend-cutover-design.md) — this plan implements that spec's Phase 1 only. Phases 2-4 (real data migration, dev-channel rollout, final promotion) are an operational runbook executed after this plan merges, not further code-planning — see that spec's own text.

**Backend reference:** `todox-backend` repo, `master` branch (commit `5291fcc` or later — includes the `order`/`parentTaskId`/`recurrence` task-field exposure, the bulk `GET /api/comments` endpoint, and the per-recipient `DELETE /api/notifications/:id` endpoint, all added specifically to support this plan). Deployed and reachable at `http://192.168.1.141:3001` (LXC `todox-backend-dev`) for manual smoke-testing during implementation — this IP is real internal-LAN infrastructure, never commit it into source; it only ever goes into a gitignored `.env.local`.

## Global Constraints

- **No new HTTP library.** Use native `fetch` (available in both the Renderer's Chromium runtime and Node 20+ used by Electron's main process, if ever needed there) — the codebase has zero existing HTTP-client precedent (`axios` is not a dependency; the one existing `fetch(...)` call is `useOutlookSync.ts:69`, unrelated). Introducing a library for one thin wrapper is unjustified.
- **Server is the source of truth for `id` and timestamps.** Every domain conversion task removes the client-side `uid()` call for that domain's create actions and instead updates state from the id/timestamps the API response returns. `uid()` itself (from `src/utils.ts` or wherever it lives) stays for anything NOT yet server-backed (there is nothing left un-backed after this plan, but do not delete the helper — other code may still use it for ephemeral, non-persisted UI ids).
- **Every store action that becomes async keeps its existing call sites working unchanged where possible.** Existing callers (`onClick={() => addTask(data)}`) are not awaited today and don't need to become awaited — an async action that isn't awaited still runs to completion and updates the store when it resolves; React re-renders automatically. Only convert a call site to `await` when the task specifically requires it (e.g. to route a caught error, or when the UI needs to block on the result — drag-and-drop reorder is the one call-out, see Task 5).
- **PATCH semantics preserved.** Every `PUT`/`PATCH` call from the client sends only the fields that changed, never a full-object replace — matching the backend routes' existing partial-update contract (already enforced server-side, re-confirmed by the backend's own tests) and the current store's `updateTask(id, patch: Partial<Task>)` shape.
- **Token lifetime decision (spec's open question, resolved here):** the deployed backend's `JWT_EXPIRATION` is set to `90d` (applied directly to `/opt/todox-backend/.env.production` on the LXC, not part of this plan's tasks — a one-line ops config change, not a code change). No refresh-token endpoint is built — the backend has none today, and a 90-day token renewed only implicitly by re-login on the rare expiry/revocation case matches the spec's own framing ("Si le token expire (rare)... retour au prompt mot de passe"). This is why no task in this plan implements token refresh logic.
- **`req.userId`-scoped domains never take a user id parameter from the caller.** `outlook-config` and `notification-settings` API calls never accept or send a user id — the JWT alone determines whose record is read/written, exactly matching the backend's own design (see sous-projet 2).
- **French user-facing strings**, matching the rest of the codebase (`CLAUDE.md` project convention) — every new error message, button label, and placeholder text the plan introduces is in French.
- **All new/modified store actions and hooks are covered by tests using `vi.mock('../services/api')`** (or the correct relative path from the test file) to stub the network layer — never a real `fetch` in a unit test. The one exception is a manual (human-run, not automated) smoke test against the real deployed LXC at the end of Task 12.
- **Existing IPC channels not named in Task 11 for removal stay untouched.** Only `get-storage-path`, `read-data`, `save-data`, `get-file-hash`, `choose-storage-folder` are removed. `select-project-folder`, `open-folder`, and every Outlook/ICS/update/window/theme/cast channel are unrelated to this cutover and must not be touched.
- **`npm run build` AND `npm test` both run and pass at the end of every task** — this codebase's `tsc -b` build has silently broken from an untested typing gap before (see `todox-backend`'s sous-projet 1 Task 2 postmortem); never trust `npm test` alone.

---

### Task 1: API client foundation + encrypted token storage

**Files:**
- Create: `src/services/api.ts`
- Create: `src/services/api.test.ts`
- Modify: `electron.js` (add 3 new `ipcMain.handle` channels)
- Modify: `preload.js` (expose the 3 new channels)
- Modify: `src/types.ts` (extend `ElectronAPI` interface with the 3 new methods)
- Create: `.env.production.example` (repo root of `To-DoX/`, documents `VITE_API_URL`)
- Modify: `vite.config.ts` (no code change needed if using `import.meta.env.VITE_API_URL` directly — Vite exposes `VITE_`-prefixed env vars automatically; just confirm and, if a `define` block already exists, leave it alone)

**Interfaces:**
- Produces: `apiGet<T>(path: string, token?: string): Promise<T>`, `apiPost<T>(path: string, body: unknown, token?: string): Promise<T>`, `apiPut<T>(path: string, body: unknown, token?: string): Promise<T>`, `apiPatch<T>(path: string, body: unknown, token?: string): Promise<T>`, `apiDelete(path: string, token?: string): Promise<void>`, `ApiError` class (has `.status: number`, `.message: string`), `login(email: string, password: string): Promise<{ token: string; user: { id: string; email: string; name: string; role: string } }>`.
- Produces (token storage): `saveToken(userId: string, token: string): Promise<void>`, `getToken(userId: string): Promise<string | null>`, `clearToken(userId: string): Promise<void>` — these three are the ONLY functions later tasks (Task 2) use to persist/read the JWT; they internally branch on `window.electronAPI?.isElectron` (Electron: IPC + `safeStorage`) vs. web (localStorage fallback), so callers never branch on platform themselves.
- Consumes: nothing from earlier tasks (this is the foundation).

- [ ] **Step 1: Write the failing tests for the low-level HTTP helpers**

```ts
// src/services/api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiGet, apiPost, apiDelete, ApiError, login } from './api';

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('apiGet sends the Authorization header and returns parsed JSON', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    });

    const result = await apiGet('/api/tasks', 'tok123');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
      })
    );
    expect(result).toEqual({ hello: 'world' });
  });

  it('apiPost sends a JSON body with Content-Type', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: '1' }) });

    await apiPost('/api/tasks', { title: 'X' }, 'tok123');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json', Authorization: 'Bearer tok123' }),
        body: JSON.stringify({ title: 'X' }),
      })
    );
  });

  it('apiDelete resolves with no body on 204', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 204, json: async () => { throw new Error('no body'); } });

    await expect(apiDelete('/api/tasks/1', 'tok123')).resolves.toBeUndefined();
  });

  it('throws ApiError with the server message on a non-2xx response', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Tâche non trouvée' }),
    });

    await expect(apiGet('/api/tasks/x', 'tok123')).rejects.toMatchObject({
      status: 404,
      message: 'Tâche non trouvée',
    });
    await expect(apiGet('/api/tasks/x', 'tok123')).rejects.toBeInstanceOf(ApiError);
  });

  it('omits the Authorization header when no token is provided', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    await apiGet('/api/health');

    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('login posts credentials to /api/auth/login and returns the token+user', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'tok', user: { id: 'u1', email: 'a@b.com', name: 'A', role: 'member' } }),
    });

    const result = await login('a@b.com', 'secret');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'a@b.com', password: 'secret' }) })
    );
    expect(result.token).toBe('tok');
    expect(result.user.id).toBe('u1');
  });

  it('login throws ApiError("Email ou mot de passe incorrect") on 401', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Invalid credentials' }) });

    await expect(login('a@b.com', 'wrong')).rejects.toMatchObject({ status: 401, message: 'Email ou mot de passe incorrect' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- api.test.ts --run`
Expected: FAIL — `Cannot find module './api'` (file doesn't exist yet).

- [ ] **Step 3: Implement `src/services/api.ts`**

```ts
// src/services/api.ts

/** Injected at build time via Vite's VITE_-prefixed env vars (see .env.production.example).
 *  Falls back to the local dev backend so `npm run dev` keeps working without extra setup. */
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- api.test.ts --run`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Add the 3 IPC channels in `electron.js`**

Locate the existing storage-related `ipcMain.handle` block (near `'get-storage-path'`/`'read-data'`/`'save-data'`) and add, using Electron's `safeStorage` (already imported as part of `electron` — add `safeStorage` to the existing `const { app, BrowserWindow, ... } = require('electron')` destructure if not already present) and `path`/`fs` (already used elsewhere in this file):

```js
const AUTH_TOKENS_FILE = () => path.join(app.getPath('userData'), 'auth-tokens.json');

function readAuthTokensFile() {
  try {
    return JSON.parse(fs.readFileSync(AUTH_TOKENS_FILE(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeAuthTokensFile(data) {
  fs.writeFileSync(AUTH_TOKENS_FILE(), JSON.stringify(data), 'utf-8');
}

ipcMain.handle('auth:save-token', (event, userId, token) => {
  if (!safeStorage.isEncryptionAvailable()) {
    // Pas de chiffrement OS disponible (rare, ex: certains Linux sans keyring) --
    // on stocke quand même plutôt que de bloquer la connexion, mieux qu'un crash.
    const all = readAuthTokensFile();
    all[userId] = { plain: token };
    writeAuthTokensFile(all);
    return { success: true, encrypted: false };
  }
  const encrypted = safeStorage.encryptString(token).toString('base64');
  const all = readAuthTokensFile();
  all[userId] = { encrypted };
  writeAuthTokensFile(all);
  return { success: true, encrypted: true };
});

ipcMain.handle('auth:get-token', (event, userId) => {
  const all = readAuthTokensFile();
  const entry = all[userId];
  if (!entry) return null;
  if (entry.plain !== undefined) return entry.plain;
  try {
    return safeStorage.decryptString(Buffer.from(entry.encrypted, 'base64'));
  } catch {
    return null;
  }
});

ipcMain.handle('auth:clear-token', (event, userId) => {
  const all = readAuthTokensFile();
  delete all[userId];
  writeAuthTokensFile(all);
  return { success: true };
});
```

- [ ] **Step 6: Expose the 3 channels in `preload.js`**

Add inside the existing `contextBridge.exposeInMainWorld('electronAPI', { ... })` object literal, alongside the other `ipcRenderer.invoke` wrappers:

```js
authSaveToken: (userId, token) => ipcRenderer.invoke('auth:save-token', userId, token),
authGetToken: (userId) => ipcRenderer.invoke('auth:get-token', userId),
authClearToken: (userId) => ipcRenderer.invoke('auth:clear-token', userId),
```

- [ ] **Step 7: Extend the `ElectronAPI` type in `src/types.ts`**

Find the `interface ElectronAPI { ... }` declaration and add:

```ts
authSaveToken: (userId: string, token: string) => Promise<{ success: boolean; encrypted: boolean }>;
authGetToken: (userId: string) => Promise<string | null>;
authClearToken: (userId: string) => Promise<{ success: boolean }>;
```

- [ ] **Step 8: Create `.env.production.example` at the `To-DoX/` repo root**

```
# Copier vers .env.local (gitignoré) avec la vraie valeur avant un build canal dev/beta/stable.
# Ne JAMAIS committer l'IP/URL réelle du serveur ici.
VITE_API_URL=http://CHANGE_ME:3001
```

- [ ] **Step 9: Confirm `.env.local` is gitignored**

Run: `grep -n "^\.env" .gitignore` — if `.env.local` (or a broader `.env*` pattern that already covers it) isn't matched, add `.env.local` to `.gitignore` and commit that separately before continuing.

- [ ] **Step 10: Run full build + test suite**

Run: `npm run build && npm run test -- --run`
Expected: both PASS, 0 new failures.

- [ ] **Step 11: Commit**

```bash
git add src/services/api.ts src/services/api.test.ts electron.js preload.js src/types.ts .env.production.example .gitignore
git commit -m "feat: API client foundation + encrypted JWT token storage"
```

---

### Task 2: Login screen + session bootstrapping

**Files:**
- Modify: `src/components/LoginModal.tsx`
- Create: `src/components/LoginModal.test.tsx` (if no test currently exists for this component — check first; extend in place if one does)
- Modify: `src/store/useStore.ts` (add auth-related state + actions)
- Modify: `src/App.tsx` (or wherever `LoginModal` is currently gated on `!currentUser` — confirmed as `App.tsx` per research)
- Modify: `src/types.ts` (add `role` to `User`, add `AuthState` fields to the store type if the store's state interface is declared there rather than inline in `useStore.ts` — check which; sub-project's own `useStore.ts` declares `StoreState` inline, so this likely only touches `useStore.ts`)

**Interfaces:**
- Consumes: `login`, `saveToken`, `getToken`, `clearToken`, `ApiError` from `src/services/api.ts` (Task 1).
- Produces: store state `authToken: string | null`, `authStatus: 'idle' | 'checking' | 'authenticated' | 'error'`, `authError: string | null`; store actions `setAuthToken(token: string | null): void`, `setAuthStatus(status): void`, `setAuthError(msg: string | null): void`. Later tasks read `useStore.getState().authToken` to pass into every `apiGet`/`apiPost`/etc. call — this is the ONE piece of session state every subsequent domain task depends on.

- [ ] **Step 1: Write the failing test for password-prompt gating**

```tsx
// src/components/LoginModal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginModal } from './LoginModal';
import useStore from '../store/useStore';
import * as api from '../services/api';

vi.mock('../services/api');

const ALICE = { id: 'alice', name: 'Alice Dupont', email: 'alice@test.com' };

describe('LoginModal', () => {
  beforeEach(() => {
    useStore.setState({ users: [ALICE], currentUser: null, authToken: null, authStatus: 'idle', authError: null });
    vi.mocked(api.getToken).mockResolvedValue(null);
    vi.mocked(api.login).mockReset();
  });

  it('shows a password prompt when clicking a user with no stored session', async () => {
    render(<LoginModal />);

    fireEvent.click(screen.getByText('Alice Dupont'));

    await waitFor(() => expect(screen.getByPlaceholderText('Mot de passe')).toBeInTheDocument());
  });

  it('logs in and sets currentUser on correct password', async () => {
    vi.mocked(api.login).mockResolvedValue({ token: 'tok123', user: { id: 'alice', email: 'alice@test.com', name: 'Alice Dupont', role: 'member' } });
    render(<LoginModal />);

    fireEvent.click(screen.getByText('Alice Dupont'));
    await waitFor(() => screen.getByPlaceholderText('Mot de passe'));
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByText('Se connecter'));

    await waitFor(() => expect(useStore.getState().currentUser).toBe('alice'));
    expect(useStore.getState().authToken).toBe('tok123');
    expect(api.saveToken).toHaveBeenCalledWith('alice', 'tok123');
  });

  it('shows a French error message on wrong password and does not set currentUser', async () => {
    vi.mocked(api.login).mockRejectedValue(new api.ApiError(401, 'Email ou mot de passe incorrect'));
    render(<LoginModal />);

    fireEvent.click(screen.getByText('Alice Dupont'));
    await waitFor(() => screen.getByPlaceholderText('Mot de passe'));
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Se connecter'));

    await waitFor(() => expect(screen.getByText('Email ou mot de passe incorrect')).toBeInTheDocument());
    expect(useStore.getState().currentUser).toBeNull();
  });

  it('skips the password prompt and logs in instantly when a valid token is already stored', async () => {
    vi.mocked(api.getToken).mockResolvedValue('existing-tok');
    render(<LoginModal />);

    fireEvent.click(screen.getByText('Alice Dupont'));

    await waitFor(() => expect(useStore.getState().currentUser).toBe('alice'));
    expect(screen.queryByPlaceholderText('Mot de passe')).not.toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- LoginModal.test.tsx --run`
Expected: FAIL (no password prompt exists yet, `setAuthToken`/`authToken` don't exist on the store).

- [ ] **Step 3: Add auth state + actions to `useStore.ts`**

In the `StoreState` interface / initial state object / actions object (matching this file's existing single-slice pattern — no slices/middleware split today, confirmed by research), add:

```ts
// State
authToken: string | null,
authStatus: 'idle' | 'checking' | 'authenticated' | 'error',
authError: string | null,

// Initial values
authToken: null,
authStatus: 'idle',
authError: null,

// Actions
setAuthToken: (token) => set({ authToken: token, authStatus: token ? 'authenticated' : 'idle' }),
setAuthStatus: (status) => set({ authStatus: status }),
setAuthError: (msg) => set({ authError: msg }),
```

- [ ] **Step 4: Add `role` to the `User` type in `src/types.ts`**

```ts
interface User {
  id: string;
  name: string;
  email: string;
  role?: 'admin' | 'member'; // absent pour les users pas encore migrés vers le backend
}
```

- [ ] **Step 5: Rewrite `LoginModal.tsx` to add the password gate**

Keep the existing card-grid rendering exactly as-is (do not touch its JSX/styling — this is the "reste visuellement identique" requirement from the spec). Change only the click handler and add a conditional password form:

```tsx
import { useState } from 'react';
import { LogIn } from "lucide-react";
import { motion } from "framer-motion";
import useStore from "../store/useStore";
import { useTheme } from "../hooks/useTheme";
import { GlassModal } from "./ui/GlassModal";
import { login, getToken, saveToken, ApiError } from "../services/api";

function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export function LoginModal() {
  const { users, setCurrentUser, setAuthToken, setAuthError, authError } = useStore();
  const { activeTheme } = useTheme();
  const primary   = activeTheme.palette.primary;
  const secondary = activeTheme.palette.secondary;

  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const lastUsedId = localStorage.getItem('last_login_user_id');

  const realUsers = (() => {
    const filtered = users.filter(u => u.id !== "unassigned");
    if (!lastUsedId) return filtered;
    const last = filtered.find(u => u.id === lastUsedId);
    if (!last) return filtered;
    return [last, ...filtered.filter(u => u.id !== lastUsedId)];
  })();

  async function handlePickUser(userId: string) {
    setAuthError(null);
    const existingToken = await getToken(userId);
    if (existingToken) {
      localStorage.setItem('last_login_user_id', userId);
      setAuthToken(existingToken);
      setCurrentUser(userId);
      return;
    }
    setPendingUserId(userId);
  }

  async function handleSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingUserId) return;
    const user = users.find(u => u.id === pendingUserId);
    if (!user) return;

    setSubmitting(true);
    setAuthError(null);
    try {
      const { token } = await login(user.email, password);
      await saveToken(pendingUserId, token);
      localStorage.setItem('last_login_user_id', pendingUserId);
      setAuthToken(token);
      setCurrentUser(pendingUserId);
      setPendingUserId(null);
      setPassword('');
    } catch (e) {
      setAuthError(e instanceof ApiError ? e.message : 'Erreur de connexion au serveur');
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingUserId) {
    const user = users.find(u => u.id === pendingUserId);
    return (
      <GlassModal isOpen={true} onClose={() => {}} size="sm" showCloseButton={false} closeOnBackdrop={false}>
        <form onSubmit={handleSubmitPassword} className="text-center">
          <h1 className="text-xl font-bold mb-2">{user?.name}</h1>
          <p className="text-theme-muted text-sm mb-6">Entrez votre mot de passe</p>
          <input
            type="password"
            autoFocus
            placeholder="Mot de passe"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl border mb-3 bg-transparent text-theme-primary"
            style={{ borderColor: 'var(--border-primary)' }}
          />
          {authError && <p className="text-red-400 text-xs mb-3">{authError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setPendingUserId(null); setPassword(''); setAuthError(null); }}
              className="flex-1 p-2.5 rounded-xl border text-theme-secondary"
            >
              Retour
            </button>
            <button
              type="submit"
              disabled={submitting || !password}
              className="flex-1 p-2.5 rounded-xl text-white font-semibold disabled:opacity-50"
              style={{ backgroundColor: primary }}
            >
              Se connecter
            </button>
          </div>
        </form>
      </GlassModal>
    );
  }

  return (
    <GlassModal
      isOpen={true}
      onClose={() => {}}
      size="sm"
      showCloseButton={false}
      closeOnBackdrop={false}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ backgroundColor: `${primary}20`, border: `1.5px solid ${primary}45` }}
        >
          <svg
            viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor"
            className="w-8 h-8"
            style={{ color: primary }}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        </div>
        <h1
          className="text-2xl font-bold bg-clip-text text-transparent mb-2"
          style={{ backgroundImage: `linear-gradient(to right, ${primary}, ${secondary})` }}
        >
          Bienvenue sur To-DoX
        </h1>
        <p className="text-theme-muted text-sm">
          Connectez-vous pour accéder à vos tâches
        </p>
      </div>

      {/* Liste utilisateurs */}
      <div>
        {realUsers.length > 0 ? (
          <>
            <p className="text-theme-secondary text-xs font-semibold uppercase tracking-wider mb-3 opacity-60">
              Sélectionnez votre profil
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
              {realUsers.map((user, i) => {
                const avatarColor = i % 2 === 0 ? primary : secondary;
                const initials = getUserInitials(user.name);
                const isLastUsed = user.id === lastUsedId;
                return (
                  <motion.button
                    key={user.id}
                    onClick={() => handlePickUser(user.id)}
                    whileHover={{ scale: 1.02, x: 3 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors group"
                    style={{
                      borderColor: isLastUsed ? `${primary}55` : 'var(--border-primary)',
                      backgroundColor: isLastUsed ? `${primary}10` : 'rgba(255,255,255,0.04)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = `${primary}55`;
                      e.currentTarget.style.backgroundColor = `${primary}12`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = isLastUsed ? `${primary}55` : 'var(--border-primary)';
                      e.currentTarget.style.backgroundColor = isLastUsed ? `${primary}10` : 'rgba(255,255,255,0.04)';
                    }}
                  >
                    <div
                      className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm text-white flex-shrink-0"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-theme-primary font-semibold text-sm">{user.name}</span>
                        {isLastUsed && (
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: `${primary}25`, color: primary }}
                          >
                            Dernier utilisé
                          </span>
                        )}
                      </div>
                      {user.email && (
                        <div className="text-theme-muted text-xs truncate">{user.email}</div>
                      )}
                    </div>
                    <LogIn
                      className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: primary }}
                    />
                  </motion.button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-theme-muted text-sm">
              Aucun utilisateur disponible.<br />
              <span className="text-xs opacity-60">Contactez l'administrateur.</span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 pt-5 border-t border-theme-primary text-center">
        <p className="text-theme-muted text-xs" style={{ opacity: 0.4 }}>
          To-DoX · Gestion multi-utilisateurs
        </p>
      </div>
    </GlassModal>
  );
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm run test -- LoginModal.test.tsx --run`
Expected: PASS (all 4 tests)

- [ ] **Step 7: Run full build + test suite**

Run: `npm run build && npm run test -- --run`
Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/LoginModal.tsx src/components/LoginModal.test.tsx src/store/useStore.ts src/types.ts
git commit -m "feat: real password login gate, encrypted per-user session tokens"
```

---

### Task 3: Users domain via API

**Files:**
- Modify: `src/store/useStore.ts` (convert user-related actions)
- Modify: `src/store/useStore.test.ts` (extend existing user-related tests)
- Modify: any component that currently mutates users directly for the "editable user directory" feature (locate via `grep -rn "setUsers\|addUser\|updateUser\|deleteUser" src/components src/store` first — this feature was added recently per project history; confirm its exact action names before writing this task's implementation, since they aren't in the Task 1 research summary verbatim)

**Interfaces:**
- Consumes: `apiGet`, `apiPost`, `useStore.getState().authToken` (Tasks 1-2).
- Produces: `fetchUsers(): Promise<void>` (calls `GET /api/users`, calls `setUsers`), `createUser(data: {email, name, password, role?}): Promise<void>` (calls `POST /api/users`, admin-only server-side — a non-admin caller gets a 403 `ApiError`, surface it via whatever error-display mechanism the editable-user-directory feature already has, or `alertModal` from `utils/confirm` if none exists).

- [ ] **Step 1: Write failing tests**

```ts
// added to src/store/useStore.test.ts
import * as api from '../services/api';
vi.mock('../services/api');

describe('users via API', () => {
  beforeEach(() => {
    useStore.setState({ authToken: 'tok', users: [] });
  });

  it('fetchUsers loads users from the API into the store', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([
      { id: 'u1', email: 'a@b.com', name: 'A', role: 'member' },
    ]);
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.fetchUsers(); });

    expect(api.apiGet).toHaveBeenCalledWith('/api/users', 'tok');
    expect(result.current.users).toEqual([{ id: 'u1', email: 'a@b.com', name: 'A', role: 'member' }]);
  });

  it('createUser posts to the API and appends the result', async () => {
    vi.mocked(api.apiPost).mockResolvedValue({ id: 'u2', email: 'c@d.com', name: 'C', role: 'member' });
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.createUser({ email: 'c@d.com', name: 'C', password: 'x' }); });

    expect(api.apiPost).toHaveBeenCalledWith('/api/users', { email: 'c@d.com', name: 'C', password: 'x' }, 'tok');
    expect(result.current.users.find(u => u.id === 'u2')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- useStore.test.ts --run`
Expected: FAIL — `fetchUsers`/`createUser` don't exist.

- [ ] **Step 3: Implement in `useStore.ts`**

```ts
fetchUsers: async () => {
  const token = get().authToken;
  const users = await apiGet<User[]>('/api/users', token ?? undefined);
  get().setUsers(users, Date.now());
},
createUser: async (data: { email: string; name: string; password: string; role?: 'admin' | 'member' }) => {
  const token = get().authToken;
  const created = await apiPost<User>('/api/users', data, token ?? undefined);
  set(state => ({ users: [...state.users, created] }));
},
```

(Add the corresponding `fetchUsers: () => Promise<void>` / `createUser: (data) => Promise<void>` signatures to the `StoreState`/actions type, and add `import { apiGet, apiPost } from '../services/api';` at the top of the file alongside the file's existing imports.)

- [ ] **Step 4: Locate and convert the editable-user-directory feature's mutation calls**

Run: `grep -rn "setUsers\|addUser\|updateUser\|deleteUser" src/components src/store src/hooks` and read every match. For each UI action that currently mutates `users` locally (add/edit/delete a user from the directory), replace it with a call to `createUser` (for add) — if the directory feature also supports editing/deleting users, this task additionally needs `PUT`/`DELETE` equivalents, but **the backend has no `PUT /api/users/:id` or `DELETE /api/users/:id` route today** (confirmed: `todox-backend/src/routes/users.ts` only has `GET`/`POST`). If the directory feature does support edit/delete, treat that as a newly-discovered backend gap exactly like Tasks 1/2's `order`/`parentTaskId`/bulk-comments fixes: add the missing route(s) to `todox-backend` (admin-only, `requireAdmin` middleware already exists and is used elsewhere — follow that exact pattern) with its own TDD cycle and a separate commit in the `todox-backend` repo, THEN convert the frontend call site. If the directory feature turns out to be add-only, skip this sub-step — no backend gap exists.

- [ ] **Step 5: Run full build + test suite**

Run: `npm run build && npm run test -- --run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: users domain via API (fetch + create)"
```

---

### Task 4: Projects domain via API

**Files:**
- Modify: `src/store/useStore.ts`
- Modify: `src/store/useStore.test.ts`

**Interfaces:**
- Consumes: `apiGet`, `apiPut`, `apiDelete`, `authToken` (Tasks 1-2).
- Produces: `fetchProjects(): Promise<void>` (`GET /api/projects` → merges into `directories`/`projectHistory`/`projectColors` — note the backend returns one flat `Project[]` with `{name, color, directory, sortOrder}` while the frontend keeps three separate maps/arrays; this task's implementation must fan the single API response out into those three pieces of local state to avoid a larger, riskier reshaping of the store's existing consumers).

- [ ] **Step 1: Write failing tests**

```ts
describe('projects via API', () => {
  beforeEach(() => { useStore.setState({ authToken: 'tok', directories: {}, projectHistory: [], projectColors: {} }); });

  it('fetchProjects fans the API response into directories/projectHistory/projectColors', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([
      { name: 'ACME', color: 2, directory: 'C:\\Acme', sortOrder: 0 },
      { name: 'BETA', color: null, directory: null, sortOrder: 1 },
    ]);
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.fetchProjects(); });

    expect(result.current.projectHistory).toEqual(['ACME', 'BETA']);
    expect(result.current.projectColors).toEqual({ ACME: 2 });
    expect(result.current.directories).toEqual({ ACME: 'C:\\Acme' });
  });

  it('setProjectColor calls PUT /api/projects/:name/color', async () => {
    vi.mocked(api.apiPut).mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.setProjectColor('ACME', 3); });

    expect(api.apiPut).toHaveBeenCalledWith('/api/projects/ACME/color', { color: 3 }, 'tok');
    expect(result.current.projectColors.ACME).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- useStore.test.ts --run`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
fetchProjects: async () => {
  const token = get().authToken;
  const projects = await apiGet<Array<{ name: string; color: number | null; directory: string | null; sortOrder: number }>>('/api/projects', token ?? undefined);
  const sorted = [...projects].sort((a, b) => a.sortOrder - b.sortOrder);
  const projectHistory = sorted.map(p => p.name);
  const projectColors: Record<string, number> = {};
  const directories: Record<string, string> = {};
  for (const p of sorted) {
    if (p.color !== null) projectColors[p.name] = p.color;
    if (p.directory !== null) directories[p.name] = p.directory;
  }
  set({ projectHistory, projectColors, directories });
},
setProjectColor: async (projectName: string, colorIndex: number) => {
  const token = get().authToken;
  await apiPut(`/api/projects/${encodeURIComponent(projectName)}/color`, { color: colorIndex }, token ?? undefined);
  set(state => ({ projectColors: { ...state.projectColors, [projectName]: colorIndex } }));
},
```

(This REPLACES the existing purely-local `setProjectColor` implementation — keep the action name identical so every existing call site keeps working unchanged. `setDirectories`/`setProjectHistory`/`setProjectColors` themselves stay as pure `set()` actions, unchanged — they're still used as the local-state setters `fetchProjects` calls into via `set(...)` directly here, and by `fetchProjects`'s test setup.)

Also add API-backed equivalents for directory assignment (`PUT /api/projects/:name/directory`, `DELETE /api/projects/:name/directory`) and ordering (`PUT /api/projects/:name/order`) by grepping for `setDirectories`/wherever a directory gets assigned to a project in the UI and wherever project drag-reordering calls into the store, converting each the same way `setProjectColor` was converted above (API call first, then `set()` from the confirmed result — never optimistic-only for these, they're low-frequency actions).

- [ ] **Step 4: Run full build + test suite**

Run: `npm run build && npm run test -- --run`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: projects domain via API"
```

---

### Task 5: Tasks + Subtasks domain via API

**Files:**
- Modify: `src/store/useStore.ts`
- Modify: `src/store/useStore.test.ts`

**Interfaces:**
- Consumes: `apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete`, `authToken`.
- Produces: converted `addTask`, `updateTask`, `removeTask`, `moveTask`, `archiveTask`, `unarchiveTask`, `setTaskParent`, `addSubtask`, `toggleSubtask`, `deleteSubtask`, `updateSubtaskTitle`, `assignSubtask`, `unassignSubtask`, `setSubtaskDates`, `reorderSubtasks`, `setReviewers`, `validateTask`, `requestCorrections`, `reopenTask` — all now async, calling the corresponding `todox-backend` task/subtask routes.

- [ ] **Step 1: Write failing tests (representative subset — cover create, patch-semantics, delete, and one subtask action; the fix-loop reviewer checks the remaining actions were converted with the same pattern, not that every single one has its own dedicated test)**

```ts
describe('tasks via API', () => {
  beforeEach(() => { useStore.setState({ authToken: 'tok', tasks: [], currentUser: 'u1' }); });

  it('addTask posts to /api/tasks and stores the server-returned task (server id, not client uid())', async () => {
    const serverTask = { id: 'srv-1', title: 'TEST TASK', project: 'X', status: 'todo', priority: 'med', createdBy: 'u1', assignedTo: ['u1'], createdAt: 1000, updatedAt: 1000, completedAt: null, notes: '', archived: false, archivedAt: null, favorite: false, deletedAt: null, subtasks: [], reviewers: [] };
    vi.mocked(api.apiPost).mockResolvedValue(serverTask);
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.addTask({ title: 'Test Task', project: 'X', priority: 'med' }); });

    expect(api.apiPost).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({ title: 'TEST TASK', project: 'X' }), 'tok');
    expect(result.current.tasks[0].id).toBe('srv-1');
  });

  it('updateTask sends only the changed fields (PATCH semantics) via PUT', async () => {
    useStore.setState({ tasks: [{ id: 't1', title: 'A', status: 'todo' } as any] });
    vi.mocked(api.apiPut).mockResolvedValue({ id: 't1', title: 'A', status: 'doing' });
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.updateTask('t1', { status: 'doing' }); });

    expect(api.apiPut).toHaveBeenCalledWith('/api/tasks/t1', { status: 'doing' }, 'tok');
  });

  it('removeTask calls DELETE (soft-delete server-side)', async () => {
    useStore.setState({ tasks: [{ id: 't1', title: 'A' } as any] });
    vi.mocked(api.apiDelete).mockResolvedValue(undefined);
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.removeTask('t1'); });

    expect(api.apiDelete).toHaveBeenCalledWith('/api/tasks/t1', 'tok');
  });

  it('addSubtask posts to /api/tasks/:taskId/subtasks', async () => {
    useStore.setState({ tasks: [{ id: 't1', title: 'A', subtasks: [] } as any] });
    vi.mocked(api.apiPost).mockResolvedValue({ id: 's1', title: 'Sub', completed: false, createdAt: 1000, completedAt: null, completedBy: null, assignedTo: [], startDate: null, endDate: null });
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.addSubtask('t1', 'Sub'); });

    expect(api.apiPost).toHaveBeenCalledWith('/api/tasks/t1/subtasks', { title: 'Sub' }, 'tok');
    expect(result.current.tasks[0].subtasks).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- useStore.test.ts --run`
Expected: FAIL.

- [ ] **Step 3: Implement each action**

Convert every task/subtask/review-workflow action listed above to this shape (shown for `addTask`/`updateTask`/`removeTask`/`addSubtask`; apply the identical pattern — API call awaited, then `set()` from the response or from a locally-computed patch for actions that don't need the full server object back — to every other action in the Interfaces list):

```ts
addTask: async (data: TaskData) => {
  const token = get().authToken;
  const currentUser = get().currentUser;
  const payload = {
    title: String(data.title).toUpperCase(),
    project: data.project,
    status: data.status,
    priority: data.priority,
    due: data.due,
    notes: data.notes,
    assignedTo: data.assignedTo ?? (currentUser ? [currentUser] : []),
    favorite: data.favorite,
  };
  const created = await apiPost<Task>('/api/tasks', payload, token ?? undefined);
  set(state => ({ tasks: [...state.tasks, created] }));
},

updateTask: async (id: string, patch: Partial<Task>) => {
  const token = get().authToken;
  const updated = await apiPut<Task>(`/api/tasks/${id}`, patch, token ?? undefined);
  set(state => ({ tasks: state.tasks.map(t => t.id === id ? updated : t) }));
},

removeTask: async (id: string) => {
  const token = get().authToken;
  await apiDelete(`/api/tasks/${id}`, token ?? undefined);
  set(state => ({ tasks: state.tasks.map(t => t.id === id ? { ...t, deletedAt: Date.now() } : t) }));
},

addSubtask: async (taskId: string, title: string) => {
  const token = get().authToken;
  const created = await apiPost<Subtask>(`/api/tasks/${taskId}/subtasks`, { title }, token ?? undefined);
  set(state => ({ tasks: state.tasks.map(t => t.id === taskId ? { ...t, subtasks: [...t.subtasks, created] } : t) }));
},
```

For `moveTask`/`archiveTask`/`unarchiveTask` (currently thin wrappers around `updateTask`), keep them as thin wrappers around the now-async `updateTask` — no separate API call needed, just `return get().updateTask(id, { status })` etc., now naturally returning the same `Promise<void>`.

For `toggleSubtask`/`deleteSubtask`/`updateSubtaskTitle`/`assignSubtask`/`unassignSubtask`/`setSubtaskDates`, each maps to `PUT /api/tasks/:taskId/subtasks/:subId` (body carries only the changed field(s), e.g. `{ completed: true }` for toggle, `{ title }` for rename) or `DELETE /api/tasks/:taskId/subtasks/:subId` for delete — same `apiPut`/`apiDelete`-then-`set()` pattern as above, scoped to updating just that one subtask inside the parent task's `subtasks` array.

For `reorderSubtasks(taskId, start, end)`: compute the new id order array client-side exactly as today (same array-splice logic already in the current implementation — do not change the reordering math, only add the API call), then `await apiPatch(\`/api/tasks/${taskId}/subtasks/reorder\`, { order: newOrderIds }, token)`.

For `setReviewers`/`validateTask`/`requestCorrections`/`reopenTask`: these currently call `updateTask` internally with review-specific fields (plus, for `requestCorrections`, an `addComment` call) — keep that exact internal structure, they now transparently become async because `updateTask` is async; `await` the inner `updateTask`/`addComment` calls so the caller's returned promise only resolves once the server has actually applied the change (important: the backend's `PUT /api/tasks/:id` route already fires the review AppNotifications server-side per sous-projet 1 — **do not** also create them client-side via `addAppNotification`, that would double-notify; remove the client-side notification-creation calls from these four actions specifically, keeping everything else).

- [ ] **Step 4: Handle drag-and-drop reorder optimistically (UI requirement, not covered by the store-level tests above)**

Locate the Kanban drag-and-drop handler (`useDragAndDrop.ts` per `CLAUDE.md`'s architecture notes) that currently calls `moveTask`/reorder synchronously mid-drag. Because `updateTask` is now a network call, calling it on every drag-over event (as the current implementation might, or on drop) must NOT block the visual reorder — keep the drag visuals driven by local component state exactly as today, and only call the now-async `moveTask`/`updateTask` once, on drop. Read `useDragAndDrop.ts` before editing to confirm exactly where the current mutation call sits (on drag-over vs. on drop) — if it already only mutates on drop (likely, given `DataTransfer` unreliability already forces a custom ref-based implementation per `CLAUDE.md`), no structural change is needed, only confirm the call site tolerates being async (it does — JS doesn't require awaiting).

- [ ] **Step 5: Run full build + test suite**

Run: `npm run build && npm run test -- --run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: tasks + subtasks domain via API"
```

---

### Task 6: Comments domain via API

**Files:**
- Modify: `src/store/useStore.ts`
- Modify: `src/store/useStore.test.ts`

**Interfaces:**
- Consumes: `apiGet`, `apiPost`, `apiDelete`, `authToken`.
- Produces: `fetchComments(): Promise<void>` (`GET /api/comments` bulk endpoint → groups flat array into `Record<taskId, Comment[]>`), converted `addComment(taskId, text): Promise<void>`, `deleteComment(taskId, commentId): Promise<void>`.

- [ ] **Step 1: Write failing tests**

```ts
describe('comments via API', () => {
  beforeEach(() => { useStore.setState({ authToken: 'tok', comments: {}, currentUser: 'u1' }); });

  it('fetchComments groups the flat bulk response by taskId', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([
      { id: 'c1', taskId: 't1', userId: 'u1', text: 'A', createdAt: 1000, deletedAt: null },
      { id: 'c2', taskId: 't1', userId: 'u1', text: 'B', createdAt: 2000, deletedAt: null },
      { id: 'c3', taskId: 't2', userId: 'u1', text: 'C', createdAt: 3000, deletedAt: null },
    ]);
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.fetchComments(); });

    expect(api.apiGet).toHaveBeenCalledWith('/api/comments', 'tok');
    expect(result.current.comments.t1).toHaveLength(2);
    expect(result.current.comments.t2).toHaveLength(1);
  });

  it('addComment posts to /api/tasks/:taskId/comments and appends the server result', async () => {
    vi.mocked(api.apiPost).mockResolvedValue({ id: 'c9', taskId: 't1', userId: 'u1', text: 'Hi @bob', createdAt: 1000, deletedAt: null });
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.addComment('t1', 'Hi @bob'); });

    expect(api.apiPost).toHaveBeenCalledWith('/api/tasks/t1/comments', { text: 'Hi @bob' }, 'tok');
    expect(result.current.comments.t1?.[0]?.id).toBe('c9');
  });

  it('deleteComment calls DELETE /api/comments/:id', async () => {
    useStore.setState({ comments: { t1: [{ id: 'c1', taskId: 't1', userId: 'u1', text: 'A', createdAt: 1000, deletedAt: null } as any] } });
    vi.mocked(api.apiDelete).mockResolvedValue(undefined);
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.deleteComment('t1', 'c1'); });

    expect(api.apiDelete).toHaveBeenCalledWith('/api/comments/c1', 'tok');
    expect(result.current.comments.t1[0].deletedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- useStore.test.ts --run`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
fetchComments: async () => {
  const token = get().authToken;
  const flat = await apiGet<Comment[]>('/api/comments', token ?? undefined);
  const grouped: Record<string, Comment[]> = {};
  for (const c of flat) {
    (grouped[c.taskId] ??= []).push(c);
  }
  set({ comments: grouped });
},

addComment: async (taskId: string, text: string) => {
  const token = get().authToken;
  const created = await apiPost<Comment>(`/api/tasks/${taskId}/comments`, { text }, token ?? undefined);
  set(state => ({ comments: { ...state.comments, [taskId]: [...(state.comments[taskId] ?? []), created] } }));
  // conserver ici la logique existante de détection @mention / notification
  // "utilisateur impliqué" -- elle reste 100% côté client (aucune route serveur
  // ne la couvre), donc ne pas la supprimer, seulement la faire tourner APRÈS
  // le await ci-dessus, sur `created` plutôt que sur un objet généré localement.
},

deleteComment: async (taskId: string, commentId: string) => {
  const token = get().authToken;
  await apiDelete(`/api/comments/${commentId}`, token ?? undefined);
  set(state => ({
    comments: {
      ...state.comments,
      [taskId]: (state.comments[taskId] ?? []).map(c => c.id === commentId ? { ...c, deletedAt: Date.now() } : c),
    },
  }));
},
```

(Re-read the CURRENT `addComment` implementation in `useStore.ts` before writing this step for real — the mention-detection and involved-user-notification logic referenced above must be preserved verbatim, just re-sequenced to run after the API call resolves and to use the server-assigned comment id or the `created` object where the old code used a locally-generated one.)

- [ ] **Step 4: Run full build + test suite**

Run: `npm run build && npm run test -- --run`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: comments domain via API (bulk fetch + create + delete)"
```

---

### Task 7: Notifications + notification-settings domain via API

**Files:**
- Modify: `src/store/useStore.ts`
- Modify: `src/store/useStore.test.ts`

**Interfaces:**
- Consumes: `apiGet`, `apiPatch`, `apiPut`, `apiDelete`, `authToken`.
- Produces: `fetchAppNotifications(): Promise<void>`, converted `markNotificationRead`, `markAllNotificationsRead`, `deleteNotificationForUser` (now a real per-user hard delete via the backend's new `DELETE /api/notifications/:id`, replacing the old client-only `deletedBy[]` array field — **the `deletedBy` field on `AppNotification` becomes dead after this task**, leave the type field in place for now as `deletedBy?: string[]` to avoid a churny type-wide removal, but no code sets or reads it anymore after this task), `fetchNotificationSettings(): Promise<void>`, converted `updateNotificationSettings(patch): Promise<void>`.

- [ ] **Step 1: Write failing tests**

```ts
describe('notifications via API', () => {
  beforeEach(() => { useStore.setState({ authToken: 'tok', appNotifications: [], currentUser: 'u1' }); });

  it('fetchAppNotifications loads from GET /api/notifications', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: 'n1', type: 'review_requested', taskId: 't1', taskTitle: 'T', fromUserId: 'u2', toUserId: 'u1', message: 'M', createdAt: 1000, readAt: undefined }]);
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.fetchAppNotifications(); });

    expect(result.current.appNotifications).toHaveLength(1);
  });

  it('markNotificationRead calls PATCH /api/notifications/:id/read', async () => {
    useStore.setState({ appNotifications: [{ id: 'n1', readAt: undefined } as any] });
    vi.mocked(api.apiPatch).mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.markNotificationRead('n1'); });

    expect(api.apiPatch).toHaveBeenCalledWith('/api/notifications/n1/read', {}, 'tok');
    expect(result.current.appNotifications[0].readAt).toBeTruthy();
  });

  it('deleteNotificationForUser calls DELETE /api/notifications/:id and removes it locally', async () => {
    useStore.setState({ appNotifications: [{ id: 'n1' } as any] });
    vi.mocked(api.apiDelete).mockResolvedValue(undefined);
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.deleteNotificationForUser('n1', 'u1'); });

    expect(api.apiDelete).toHaveBeenCalledWith('/api/notifications/n1', 'tok');
    expect(result.current.appNotifications).toHaveLength(0);
  });

  it('fetchNotificationSettings loads from GET /api/notification-settings', async () => {
    vi.mocked(api.apiGet).mockResolvedValue({ enabled: true, checkInterval: 30, quietHoursStart: '20:00' });
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.fetchNotificationSettings(); });

    expect(result.current.notificationSettings.checkInterval).toBe(30);
  });

  it('updateNotificationSettings sends only the patch via PUT', async () => {
    vi.mocked(api.apiPut).mockResolvedValue({ checkInterval: 45 });
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.updateNotificationSettings({ checkInterval: 45 }); });

    expect(api.apiPut).toHaveBeenCalledWith('/api/notification-settings', { checkInterval: 45 }, 'tok');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- useStore.test.ts --run`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
fetchAppNotifications: async () => {
  const token = get().authToken;
  const notifs = await apiGet<AppNotification[]>('/api/notifications', token ?? undefined);
  set({ appNotifications: notifs });
},

markNotificationRead: async (notifId: string) => {
  const token = get().authToken;
  await apiPatch(`/api/notifications/${notifId}/read`, {}, token ?? undefined);
  set(state => ({ appNotifications: state.appNotifications.map(n => n.id === notifId ? { ...n, readAt: Date.now() } : n) }));
},

markAllNotificationsRead: async (userId: string) => {
  const token = get().authToken;
  await apiPatch('/api/notifications/read-all', {}, token ?? undefined);
  set(state => ({ appNotifications: state.appNotifications.map(n => n.toUserId === userId ? { ...n, readAt: n.readAt ?? Date.now() } : n) }));
},

deleteNotificationForUser: async (notifId: string, _userId: string) => {
  const token = get().authToken;
  await apiDelete(`/api/notifications/${notifId}`, token ?? undefined);
  set(state => ({ appNotifications: state.appNotifications.filter(n => n.id !== notifId) }));
},

fetchNotificationSettings: async () => {
  const token = get().authToken;
  const settings = await apiGet<NotificationSettings>('/api/notification-settings', token ?? undefined);
  set({ notificationSettings: settings });
},

updateNotificationSettings: async (patch: Partial<NotificationSettings>) => {
  const token = get().authToken;
  const updated = await apiPut<NotificationSettings>('/api/notification-settings', patch, token ?? undefined);
  set({ notificationSettings: updated });
},
```

(`markNotificationsByTypeRead` follows the exact same pattern as `markNotificationRead` but looped/filtered by type — the backend has no bulk-by-type endpoint, so call `PATCH /:id/read` once per matching notification id via `Promise.all`, matching how the current client-only version already iterates.)

- [ ] **Step 4: Run full build + test suite**

Run: `npm run build && npm run test -- --run`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: notifications + notification-settings domain via API"
```

---

### Task 8: Time entries domain via API

**Files:**
- Modify: `src/store/useStore.ts`
- Modify: `src/store/useStore.test.ts`

**Interfaces:**
- Consumes: `apiGet`, `apiPost`, `apiPut`, `apiDelete`, `authToken`.
- Produces: `fetchTimeEntries(from?: string, to?: string): Promise<void>`, converted `upsertTimeEntry(project, date, hours, userId, note?): Promise<void>` (now explicitly deletes server-side when `hours <= 0`, since — confirmed by research — the backend does NOT auto-delete on zero hours the way the old client-only logic did), converted `deleteTimeEntry(project, date, userId): Promise<void>`.

- [ ] **Step 1: Write failing tests**

```ts
describe('time entries via API', () => {
  beforeEach(() => { useStore.setState({ authToken: 'tok', timeEntries: [] }); });

  it('fetchTimeEntries loads from GET /api/time-entries', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: 'e1', userId: 'u1', project: 'X', date: '2026-09-10', hours: 3, note: null, createdAt: 1000, updatedAt: 1000 }]);
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.fetchTimeEntries(); });

    expect(result.current.timeEntries).toHaveLength(1);
  });

  it('upsertTimeEntry with positive hours and no existing entry POSTs a new one', async () => {
    vi.mocked(api.apiPost).mockResolvedValue({ id: 'e2', userId: 'u1', project: 'X', date: '2026-09-10', hours: 5, note: null, createdAt: 1000, updatedAt: 1000 });
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.upsertTimeEntry('X', '2026-09-10', 5, 'u1'); });

    expect(api.apiPost).toHaveBeenCalledWith('/api/time-entries', { project: 'X', date: '2026-09-10', hours: 5, note: undefined }, 'tok');
  });

  it('upsertTimeEntry with hours <= 0 on an existing entry calls DELETE, not PUT', async () => {
    useStore.setState({ timeEntries: [{ id: 'e1', userId: 'u1', project: 'X', date: '2026-09-10', hours: 3 } as any] });
    vi.mocked(api.apiDelete).mockResolvedValue(undefined);
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.upsertTimeEntry('X', '2026-09-10', 0, 'u1'); });

    expect(api.apiDelete).toHaveBeenCalledWith('/api/time-entries/e1', 'tok');
    expect(api.apiPut).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- useStore.test.ts --run`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
fetchTimeEntries: async (from?: string, to?: string) => {
  const token = get().authToken;
  const qs = from && to ? `?from=${from}&to=${to}` : '';
  const entries = await apiGet<TimeEntry[]>(`/api/time-entries${qs}`, token ?? undefined);
  set({ timeEntries: entries });
},

upsertTimeEntry: async (project: string, date: string, hours: number, userId: string, note?: string) => {
  const token = get().authToken;
  const existing = get().timeEntries.find(e => e.project === project && e.date === date && e.userId === userId);

  if (hours <= 0) {
    if (existing) {
      await apiDelete(`/api/time-entries/${existing.id}`, token ?? undefined);
      set(state => ({ timeEntries: state.timeEntries.filter(e => e.id !== existing.id) }));
    }
    return;
  }

  if (existing) {
    const updated = await apiPut<TimeEntry>(`/api/time-entries/${existing.id}`, { hours, note }, token ?? undefined);
    set(state => ({ timeEntries: state.timeEntries.map(e => e.id === existing.id ? updated : e) }));
  } else {
    const created = await apiPost<TimeEntry>('/api/time-entries', { project, date, hours, note }, token ?? undefined);
    set(state => ({ timeEntries: [...state.timeEntries, created] }));
  }
},

deleteTimeEntry: async (project: string, date: string, userId: string) => {
  const token = get().authToken;
  const existing = get().timeEntries.find(e => e.project === project && e.date === date && e.userId === userId);
  if (!existing) return;
  await apiDelete(`/api/time-entries/${existing.id}`, token ?? undefined);
  set(state => ({ timeEntries: state.timeEntries.filter(e => e.id !== existing.id) }));
},
```

- [ ] **Step 4: Run full build + test suite**

Run: `npm run build && npm run test -- --run`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: time entries domain via API (client-side delete-on-zero preserved)"
```

---

### Task 9: Templates + Saved Reports + Outlook Config domain via API

**Files:**
- Modify: `src/store/useStore.ts`
- Modify: `src/store/useStore.test.ts`

**Interfaces:**
- Consumes: `apiGet`, `apiPost`, `apiPut`, `apiDelete`, `authToken`.
- Produces: `fetchTemplates`, converted `addTemplate`/`deleteTemplate` (`applyTemplateToTask` stays 100% client-side — it only reads `templates` + calls the already-converted `addSubtask` per title, no new API surface needed); `fetchSavedReports`, converted `saveReport`/`deleteReport`; `fetchOutlookConfig`, converted `setOutlookConfig` (note: this becomes the ONLY config call needed — the backend's `outlook-config` is a per-`req.userId` singleton, so the frontend's `outlookConfigs: Record<string, OutlookConfig>` map collapses to just the current user's own config after this task; keep the map in the type for now since `setCurrentUser`'s existing "swap outlookConfig from outlookConfigs[userId]" logic can stay as a client-side cache warmed by `fetchOutlookConfig`, but the API itself never takes a userId parameter, matching the Global Constraint).

- [ ] **Step 1: Write failing tests**

```ts
describe('templates/reports/outlook via API', () => {
  beforeEach(() => { useStore.setState({ authToken: 'tok', templates: [], savedReports: [], outlookConfig: { enabled: false, icsUrl: '', exportEnabled: false, lastSync: null } }); });

  it('fetchTemplates loads from GET /api/templates', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: 'tp1', name: 'Modèle', subtaskTitles: ['A', 'B'] }]);
    const { result } = renderHook(() => useStore());
    await act(async () => { await result.current.fetchTemplates(); });
    expect(result.current.templates).toHaveLength(1);
  });

  it('addTemplate posts to /api/templates', async () => {
    vi.mocked(api.apiPost).mockResolvedValue({ id: 'tp2', name: 'X', subtaskTitles: [] });
    const { result } = renderHook(() => useStore());
    await act(async () => { await result.current.addTemplate({ name: 'X', subtaskTitles: [] }); });
    expect(api.apiPost).toHaveBeenCalledWith('/api/templates', { name: 'X', subtaskTitles: [] }, 'tok');
  });

  it('fetchSavedReports loads from GET /api/saved-reports', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: 'r1', generatedAt: 1000, generatedBy: 'u1', periodType: 'weekly', periodLabel: 'S1', taskCount: 3, reportText: 'x' }]);
    const { result } = renderHook(() => useStore());
    await act(async () => { await result.current.fetchSavedReports(); });
    expect(result.current.savedReports).toHaveLength(1);
  });

  it('fetchOutlookConfig loads the current user config from GET /api/outlook-config', async () => {
    vi.mocked(api.apiGet).mockResolvedValue({ enabled: true, icsUrl: 'https://x', exportEnabled: false, lastSync: null });
    const { result } = renderHook(() => useStore());
    await act(async () => { await result.current.fetchOutlookConfig(); });
    expect(result.current.outlookConfig.enabled).toBe(true);
  });

  it('setOutlookConfig PUTs the patch to /api/outlook-config (no userId in the call)', async () => {
    vi.mocked(api.apiPut).mockResolvedValue({ enabled: true, icsUrl: '', exportEnabled: false, lastSync: null });
    const { result } = renderHook(() => useStore());
    await act(async () => { await result.current.setOutlookConfig({ enabled: true }); });
    expect(api.apiPut).toHaveBeenCalledWith('/api/outlook-config', { enabled: true }, 'tok');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- useStore.test.ts --run`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
fetchTemplates: async () => {
  const token = get().authToken;
  const templates = await apiGet<TaskTemplate[]>('/api/templates', token ?? undefined);
  set({ templates });
},
addTemplate: async (template: Omit<TaskTemplate, 'id'>) => {
  const token = get().authToken;
  const created = await apiPost<TaskTemplate>('/api/templates', template, token ?? undefined);
  set(state => ({ templates: [...state.templates, created] }));
},
deleteTemplate: async (id: string) => {
  const token = get().authToken;
  await apiDelete(`/api/templates/${id}`, token ?? undefined);
  set(state => ({ templates: state.templates.filter(t => t.id !== id) }));
},

fetchSavedReports: async () => {
  const token = get().authToken;
  const reports = await apiGet<SavedReport[]>('/api/saved-reports', token ?? undefined);
  set({ savedReports: reports });
},
saveReport: async (report: Omit<SavedReport, 'id'>) => {
  const token = get().authToken;
  const created = await apiPost<SavedReport>('/api/saved-reports', report, token ?? undefined);
  set(state => ({ savedReports: [...state.savedReports, created] }));
},
deleteReport: async (id: string) => {
  const token = get().authToken;
  await apiDelete(`/api/saved-reports/${id}`, token ?? undefined);
  set(state => ({ savedReports: state.savedReports.filter(r => r.id !== id) }));
},

fetchOutlookConfig: async () => {
  const token = get().authToken;
  const config = await apiGet<OutlookConfig>('/api/outlook-config', token ?? undefined);
  const currentUser = get().currentUser;
  set(state => ({
    outlookConfig: config,
    outlookConfigs: currentUser ? { ...state.outlookConfigs, [currentUser]: config } : state.outlookConfigs,
  }));
},
setOutlookConfig: async (patch: Partial<OutlookConfig>) => {
  const token = get().authToken;
  const updated = await apiPut<OutlookConfig>('/api/outlook-config', patch, token ?? undefined);
  const currentUser = get().currentUser;
  set(state => ({
    outlookConfig: updated,
    outlookConfigs: currentUser ? { ...state.outlookConfigs, [currentUser]: updated } : state.outlookConfigs,
  }));
},
```

- [ ] **Step 4: Run full build + test suite**

Run: `npm run build && npm run test -- --run`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: templates + saved reports + outlook-config domain via API"
```

---

### Task 10: `useApiSync` — replace the persistence hook umbrella

**Files:**
- Create: `src/hooks/useApiSync.ts`
- Create: `src/hooks/useApiSync.test.ts`
- Modify: wherever `useDataPersistence()` is currently called (`ToDoX.tsx` or `App.tsx` — confirm exact call site via `grep -rn "useDataPersistence" src` before editing)
- Delete: `src/hooks/useDataPersistence.ts`, `src/hooks/persistence/useLoadData.ts`, `src/hooks/persistence/useSyncPolling.ts`, `src/hooks/persistence/usePersistSave.ts`, `src/hooks/persistence/persistence.utils.ts`, `src/hooks/persistence/usersPersistence.test.tsx` (this whole directory's job is fully superseded)

**Interfaces:**
- Consumes: every `fetch*` action produced by Tasks 3-9 (`fetchUsers`, `fetchProjects`, `fetchTasks` — note: Task 5 didn't define a dedicated `fetchTasks`, add it now following the exact same one-line pattern as every other `fetch*` action: `fetchTasks: async () => { const token = get().authToken; const tasks = await apiGet<Task[]>('/api/tasks', token ?? undefined); set({ tasks }); }` — append this to `useStore.ts` as part of THIS task, it was correctly deferred from Task 5 since Task 5's tests only needed per-action mutation coverage, not the initial bulk load — `fetchComments`, `fetchAppNotifications`, `fetchNotificationSettings`, `fetchTimeEntries`, `fetchTemplates`, `fetchSavedReports`, `fetchOutlookConfig`).
- Produces: `useApiSync(): void` — the new single hook called once from the app root, replacing `useDataPersistence()`.

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useApiSync.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApiSync } from './useApiSync';
import useStore from '../store/useStore';

describe('useApiSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const fetchAll = vi.fn().mockResolvedValue(undefined);
    useStore.setState({
      authToken: 'tok', currentUser: 'u1', isLoadingData: true,
      fetchUsers: fetchAll, fetchProjects: fetchAll, fetchTasks: fetchAll, fetchComments: fetchAll,
      fetchAppNotifications: fetchAll, fetchNotificationSettings: fetchAll, fetchTimeEntries: fetchAll,
      fetchTemplates: fetchAll, fetchSavedReports: fetchAll, fetchOutlookConfig: fetchAll,
      setIsLoadingData: vi.fn((v: boolean) => useStore.setState({ isLoadingData: v })),
    });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('calls every fetch* action once on mount and sets isLoadingData to false when done', async () => {
    renderHook(() => useApiSync());

    await waitFor(() => expect(useStore.getState().isLoadingData).toBe(false));
    expect(useStore.getState().fetchTasks).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there is no authToken yet (not logged in)', () => {
    useStore.setState({ authToken: null, isLoadingData: true });
    renderHook(() => useApiSync());
    expect(useStore.getState().fetchTasks).not.toHaveBeenCalled();
  });

  it('re-fetches on a 10s interval', async () => {
    renderHook(() => useApiSync());
    await waitFor(() => expect(useStore.getState().isLoadingData).toBe(false));
    const callsBefore = (useStore.getState().fetchTasks as any).mock.calls.length;

    vi.advanceTimersByTime(10_000);
    await vi.waitFor(() => expect((useStore.getState().fetchTasks as any).mock.calls.length).toBeGreaterThan(callsBefore));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- useApiSync.test.ts --run`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `useApiSync.ts`**

```ts
import { useEffect, useRef } from 'react';
import useStore from '../store/useStore';

const REFRESH_INTERVAL_MS = 10_000;

export function useApiSync() {
  const {
    authToken, setIsLoadingData,
    fetchUsers, fetchProjects, fetchTasks, fetchComments, fetchAppNotifications,
    fetchNotificationSettings, fetchTimeEntries, fetchTemplates, fetchSavedReports, fetchOutlookConfig,
  } = useStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authToken) return;

    async function refreshAll() {
      await Promise.all([
        fetchUsers(), fetchProjects(), fetchTasks(), fetchComments(), fetchAppNotifications(),
        fetchNotificationSettings(), fetchTimeEntries(), fetchTemplates(), fetchSavedReports(), fetchOutlookConfig(),
      ]);
    }

    let cancelled = false;
    (async () => {
      await refreshAll();
      if (!cancelled) setIsLoadingData(false);
    })();

    intervalRef.current = setInterval(() => { refreshAll(); }, REFRESH_INTERVAL_MS);
    const onFocus = () => { refreshAll(); };
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- useApiSync.test.ts --run`
Expected: PASS (all 3 tests)

- [ ] **Step 5: Add `fetchTasks` to `useStore.ts`** (per the Interfaces note above — one line, same pattern as every other `fetch*` action)

- [ ] **Step 6: Swap the call site**

In whichever file calls `useDataPersistence()` today, replace with `useApiSync()` and update the import.

- [ ] **Step 7: Delete the superseded files**

```bash
git rm src/hooks/useDataPersistence.ts src/hooks/persistence/useLoadData.ts src/hooks/persistence/useSyncPolling.ts src/hooks/persistence/usePersistSave.ts src/hooks/persistence/persistence.utils.ts src/hooks/persistence/usersPersistence.test.tsx
```

If `persistence.utils.ts`'s `migrateTemplate`/`mergeComments` helpers are imported anywhere else (check with `grep -rn "migrateTemplate\|mergeComments" src` before deleting) — `migrateTemplate` was also used by the OLD file-based `useLoadData.ts` to normalize legacy on-disk template shapes; since that entire load path is gone, this helper's only remaining caller would be the migration script (which lives in the `todox-backend` repo, not here — unrelated), so it is safe to delete along with the rest of the file. If the grep finds an unexpected additional caller, keep just that one exported function in a small new file instead of deleting it, and note this deviation in the task report.

- [ ] **Step 8: Run full build + test suite**

Run: `npm run build && npm run test -- --run`
Expected: both PASS, 0 references to the deleted files remain (a leftover import would fail the build, not just tests — this is exactly why both commands run every task).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: useApiSync replaces the file-based persistence hook umbrella"
```

---

### Task 11: Remove OneDrive/file IPC surface, rewrite `StoragePanel`

**Files:**
- Modify: `electron.js` (remove 5 IPC handlers)
- Modify: `preload.js` (remove the corresponding 5 exposed methods)
- Modify: `src/types.ts` (remove the corresponding 5 methods from `ElectronAPI`)
- Modify: `src/components/settings/StoragePanel.tsx` (full rewrite)
- Modify/Create: `src/components/settings/StoragePanel.test.tsx` (check if one already exists first)
- Modify: `src/store/useStore.ts` (remove `storagePath` state + `setStoragePath` action — grep first for any remaining reader before deleting, per the Task 10 Step 7 precedent)

**Interfaces:**
- Consumes: `authToken`, `authStatus` (Task 2), `clearToken` (Task 1).
- Produces: nothing new consumed by later tasks — this is a removal/cleanup task plus one small new UI (logout button).

- [ ] **Step 1: Remove the 5 IPC handlers from `electron.js`**

Delete the `ipcMain.handle` blocks for exactly: `'get-storage-path'`, `'read-data'`, `'save-data'`, `'get-file-hash'`, `'choose-storage-folder'`. Do not touch `'select-project-folder'`, `'open-folder'`, or any Outlook/update/window/theme/cast handler.

- [ ] **Step 2: Remove the corresponding 5 methods from `preload.js`**

Remove `getStoragePath`, `readData`, `saveData`, `getFileHash`, `chooseStorageFolder` from the `contextBridge.exposeInMainWorld('electronAPI', {...})` object.

- [ ] **Step 3: Remove the corresponding 5 method signatures from `ElectronAPI` in `src/types.ts`**

- [ ] **Step 4: Write the failing test for the rewritten `StoragePanel`**

```tsx
// src/components/settings/StoragePanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StoragePanel } from './StoragePanel';
import useStore from '../../store/useStore';
import * as api from '../../services/api';

vi.mock('../../services/api');

describe('StoragePanel', () => {
  beforeEach(() => {
    useStore.setState({ currentUser: 'u1', authToken: 'tok', users: [{ id: 'u1', name: 'A', email: 'a@b.com' }] });
  });

  it('shows the connected server and a logout button, no folder picker', () => {
    render(<StoragePanel />);
    expect(screen.getByText('Se déconnecter')).toBeInTheDocument();
    expect(screen.queryByText(/dossier/i)).not.toBeInTheDocument();
  });

  it('logout clears the token and the session', async () => {
    render(<StoragePanel />);
    fireEvent.click(screen.getByText('Se déconnecter'));
    expect(api.clearToken).toHaveBeenCalledWith('u1');
    expect(useStore.getState().currentUser).toBeNull();
    expect(useStore.getState().authToken).toBeNull();
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `npm run test -- StoragePanel.test.tsx --run`
Expected: FAIL.

- [ ] **Step 6: Rewrite `StoragePanel.tsx`**

```tsx
import useStore from '../../store/useStore';
import { clearToken } from '../../services/api';

export function StoragePanel() {
  const { currentUser, setCurrentUser, setAuthToken } = useStore();

  async function handleLogout() {
    if (currentUser) await clearToken(currentUser);
    setAuthToken(null);
    setCurrentUser(null);
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Compte</h2>
      <p className="text-theme-muted text-sm mb-6">
        To-DoX est connecté au serveur de l'équipe. Vos données sont synchronisées automatiquement.
      </p>
      <button
        onClick={handleLogout}
        className="px-4 py-2 rounded-xl border text-theme-secondary hover:bg-white/5"
      >
        Se déconnecter
      </button>
    </div>
  );
}
```

(This deliberately drops the folder-path display/picker and the OneDrive/backups help text entirely — read the CURRENT file first to check whether anything else in it, beyond the folder picker, is still relevant [e.g. an unrelated setting that happened to live in the same panel] and preserve that if so; the research pass found only folder-picking/path-display content in this file, but confirm before deleting wholesale.)

- [ ] **Step 7: Remove `storagePath`/`setStoragePath` from `useStore.ts`**

Run `grep -rn "storagePath\|setStoragePath" src` first — remove every remaining reference (state field, action, and any leftover call site) found by the grep, not just the ones enumerated here.

- [ ] **Step 8: Run to verify the new test passes**

Run: `npm run test -- StoragePanel.test.tsx --run`
Expected: PASS.

- [ ] **Step 9: Run full build + test suite**

Run: `npm run build && npm run test -- --run`
Expected: both PASS.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: remove OneDrive file IPC surface, StoragePanel becomes an account/logout screen"
```

---

### Task 12: Full integration pass + regression verification

**Files:**
- No new files expected — this task is verification + fixing whatever the previous 11 tasks' integration reveals, plus one likely small fix: the `App.tsx`/root component's loading-state gate (currently keyed off `isLoadingData`, which Task 10's `useApiSync` still sets, so this should mostly just work — confirm, don't assume).

**Interfaces:**
- Consumes: everything from Tasks 1-11.

- [ ] **Step 1: Run the full automated suite one more time, clean**

Run: `npm run build && npm run test -- --run`
Expected: both PASS with 0 failures. If anything fails here that didn't fail at the end of its originating task, that's a genuine integration regression — fix it before continuing (do not proceed to manual testing on a red suite).

- [ ] **Step 2: Manual smoke test against the real deployed backend**

This step is NOT automatable — it requires a human (or an agent with the ability to launch and interact with the actual Electron app) running the built app against the real `todox-backend` at `http://192.168.1.141:3001`. Use `.env.local` with `VITE_API_URL=http://192.168.1.141:3001`, run `npm run dev:electron`, and manually create a temporary test user directly against the deployed backend first:

```bash
# from todox-backend, against the real deployed DB (not the test DB) --
# create exactly one throwaway user+org for this smoke test, nothing else touches todox_prod yet
```

(This plan does NOT script that throwaway-user creation — it is a manual, one-off, judgment-call action against real (if still empty) production infrastructure, appropriate for a human or the controller to do directly at execution time, not something to bake into a checked-in script. See this plan's own Global Constraints: nothing here touches real production DATA, and a single throwaway smoke-test account is not real user data.)

Walk through: login with the throwaway user (password prompt appears once, not again on next click), create a task, add a subtask, add a comment, toggle notification settings, create a template, save a report, set an outlook-config value, log out (`StoragePanel`), log back in with the SAME password (confirms token persistence across a fresh app launch), then close and relaunch the app entirely (confirms `safeStorage`-backed token survives a real process restart, not just an in-session state reset).

- [ ] **Step 3: Record findings**

Any bug found in Step 2 gets fixed with its own small TDD cycle (write/extend a test that would have caught it, fix, verify) before this task is considered done — do not ship an unverified manual-testing fix.

- [ ] **Step 4: Final commit (if Step 3 produced fixes)**

```bash
git add -A
git commit -m "fix: integration pass findings from Phase 1 manual smoke test"
```

If Step 3 found nothing to fix, this task has no commit of its own — Step 1's clean run is the deliverable.

---

## Suite

Once this plan is merged (whole-branch review clean, following the identical process used for `todox-backend`'s two prior sub-projects), Phase 1 of the transparent-cutover spec is complete. Phases 2-4 (real `data.json` migration, dev-channel rollout to real users, final stable promotion) are **not** further planning work — they are the operational runbook already fully described in [docs/superpowers/specs/2026-09-10-transparent-backend-cutover-design.md](../specs/2026-09-10-transparent-backend-cutover-design.md)'s own Phase 2-4 sections, executed directly against real infrastructure and real (if brief) human coordination (communicating temporary passwords, running a multi-day dev-channel trial) — not something a subagent-driven-development plan should attempt to pre-script.
