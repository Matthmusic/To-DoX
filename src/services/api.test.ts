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
