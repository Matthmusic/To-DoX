import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiGet, apiPost, apiDelete, ApiError, login, setRequestErrorHandler, setUnauthorizedHandler } from './api';

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

// ── Canal d'erreur partagé (review finale de branche, fixes I3/I4/I4) ─────────────────
describe('shared error channel', () => {
  afterEach(() => {
    // Ne pas laisser un handler de test fuiter vers un autre test (module-level state).
    setRequestErrorHandler(null);
    setUnauthorizedHandler(null);
  });

  it('invokes the registered request-error handler with the server error message on a failed authenticated request', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'Erreur interne' }) });
    const onError = vi.fn();
    setRequestErrorHandler(onError);

    await expect(apiGet('/api/tasks', 'tok123')).rejects.toBeInstanceOf(ApiError);

    expect(onError).toHaveBeenCalledWith('Erreur interne');
  });

  it('invokes the request-error handler with a generic French message on a network failure', async () => {
    (fetch as any).mockRejectedValue(new TypeError('Failed to fetch'));
    const onError = vi.fn();
    setRequestErrorHandler(onError);

    await expect(apiGet('/api/tasks', 'tok123')).rejects.toThrow();

    expect(onError).toHaveBeenCalledWith('Erreur de connexion au serveur');
  });

  it('does NOT invoke the request-error handler for a failed request with no token (login() path)', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Invalid credentials' }) });
    const onError = vi.fn();
    setRequestErrorHandler(onError);

    await expect(login('a@b.com', 'wrong')).rejects.toBeInstanceOf(ApiError);

    expect(onError).not.toHaveBeenCalled();
  });

  it('invokes the unauthorized handler (not the generic error handler) on a 401 with a token present', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Token invalide ou expiré' }) });
    const onError = vi.fn();
    const onUnauthorized = vi.fn();
    setRequestErrorHandler(onError);
    setUnauthorizedHandler(onUnauthorized);

    await expect(apiGet('/api/tasks', 'expired-tok')).rejects.toBeInstanceOf(ApiError);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not invoke the unauthorized handler on a non-401 error with a token', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'Erreur interne' }) });
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(apiGet('/api/tasks', 'tok123')).rejects.toBeInstanceOf(ApiError);

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
