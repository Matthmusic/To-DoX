import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiGet, apiPost, apiDelete, ApiError, login, changePassword, setRequestErrorHandler, setUnauthorizedHandler } from './api';

// Fabrique une réponse fetch factice suffisante pour ces tests (ok/status/json) --
// une vraie Response a bien plus de champs (headers, redirected...) qu'aucun de ces
// tests n'inspecte ; ce cast centralisé remplace 16 `as any` locaux répétés.
function mockResponse(init: { ok: boolean; status: number; json: () => Promise<unknown> }): Response {
  return init as unknown as Response;
}

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('apiGet sends the Authorization header and returns parsed JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    }));

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
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: true, status: 201, json: async () => ({ id: '1' }) }));

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
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: true, status: 204, json: async () => { throw new Error('no body'); } }));

    await expect(apiDelete('/api/tasks/1', 'tok123')).resolves.toBeUndefined();
  });

  it('throws ApiError with the server message on a non-2xx response', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Tâche non trouvée' }),
    }));

    await expect(apiGet('/api/tasks/x', 'tok123')).rejects.toMatchObject({
      status: 404,
      message: 'Tâche non trouvée',
    });
    await expect(apiGet('/api/tasks/x', 'tok123')).rejects.toBeInstanceOf(ApiError);
  });

  it('omits the Authorization header when no token is provided', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: true, status: 200, json: async () => ({}) }));

    await apiGet('/api/health');

    const [, options] = vi.mocked(fetch).mock.calls[0];
    // api.ts passe toujours headers comme un Record<string, string> littéral -- fetch()
    // l'accepte plus largement (HeadersInit), d'où le cast ciblé pour lire Authorization ici.
    const headers = options?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBeUndefined();
  });

  it('login posts credentials to /api/auth/login and returns the token+user', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({
      ok: true,
      status: 200,
      json: async () => ({ token: 'tok', user: { id: 'u1', email: 'a@b.com', name: 'A', role: 'member' } }),
    }));

    const result = await login('a@b.com', 'secret');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'a@b.com', password: 'secret' }) })
    );
    expect(result.token).toBe('tok');
    expect(result.user.id).toBe('u1');
  });

  it('login throws ApiError("Email ou mot de passe incorrect") on 401', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: false, status: 401, json: async () => ({ error: 'Invalid credentials' }) }));

    await expect(login('a@b.com', 'wrong')).rejects.toMatchObject({ status: 401, message: 'Email ou mot de passe incorrect' });
  });

  it('changePassword posts current+new password to /api/auth/change-password', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: true, status: 200, json: async () => ({ ok: true }) }));

    await changePassword('old-pass', 'new-password-123', 'tok123');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/change-password'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
        body: JSON.stringify({ currentPassword: 'old-pass', newPassword: 'new-password-123' }),
      })
    );
  });

  it('changePassword throws ApiError("Mot de passe actuel incorrect") on 401', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: false, status: 401, json: async () => ({ error: 'Mot de passe actuel incorrect' }) }));

    await expect(changePassword('wrong-old', 'new-password-123', 'tok123'))
      .rejects.toMatchObject({ status: 401, message: 'Mot de passe actuel incorrect' });
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
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: false, status: 500, json: async () => ({ error: 'Erreur interne' }) }));
    const onError = vi.fn();
    setRequestErrorHandler(onError);

    await expect(apiGet('/api/tasks', 'tok123')).rejects.toBeInstanceOf(ApiError);

    expect(onError).toHaveBeenCalledWith('Erreur interne');
  });

  it('invokes the request-error handler with a generic French message on a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    const onError = vi.fn();
    setRequestErrorHandler(onError);

    await expect(apiGet('/api/tasks', 'tok123')).rejects.toThrow();

    expect(onError).toHaveBeenCalledWith('Erreur de connexion au serveur');
  });

  it('does NOT invoke the request-error handler for a failed request with no token (login() path)', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: false, status: 401, json: async () => ({ error: 'Invalid credentials' }) }));
    const onError = vi.fn();
    setRequestErrorHandler(onError);

    await expect(login('a@b.com', 'wrong')).rejects.toBeInstanceOf(ApiError);

    expect(onError).not.toHaveBeenCalled();
  });

  it('invokes the unauthorized handler (not the generic error handler) on a 401 with a token present', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: false, status: 401, json: async () => ({ error: 'Token invalide ou expiré' }) }));
    const onError = vi.fn();
    const onUnauthorized = vi.fn();
    setRequestErrorHandler(onError);
    setUnauthorizedHandler(onUnauthorized);

    await expect(apiGet('/api/tasks', 'expired-tok')).rejects.toBeInstanceOf(ApiError);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not invoke the unauthorized handler on a non-401 error with a token', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: false, status: 500, json: async () => ({ error: 'Erreur interne' }) }));
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(apiGet('/api/tasks', 'tok123')).rejects.toBeInstanceOf(ApiError);

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('changePassword does NOT trigger the global unauthorized handler on a wrong-current-password 401 -- that would wrongly log the user out of a still-valid session for a simple typo', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: false, status: 401, json: async () => ({ error: 'Mot de passe actuel incorrect' }) }));
    const onError = vi.fn();
    const onUnauthorized = vi.fn();
    setRequestErrorHandler(onError);
    setUnauthorizedHandler(onUnauthorized);

    await expect(changePassword('wrong-old', 'new-password-123', 'tok123')).rejects.toBeInstanceOf(ApiError);

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
