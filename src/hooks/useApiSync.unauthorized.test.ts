// src/hooks/useApiSync.unauthorized.test.ts
//
// Régression I4 (review finale de branche) : un token expiré/révoqué doit renvoyer
// proprement l'utilisateur à l'écran de connexion plutôt que de le laisser bloqué avec
// chaque requête suivante en échec silencieux. Ce fichier est séparé de useApiSync.test.ts
// à dessein : ce dernier remplace les 10 actions fetch* du store par un mock partagé
// (`useStore.setState({ fetchUsers: fetchAll, ... })`), et comme `useStore` est un module
// singleton, cette substitution persiste pour tous les tests suivants DANS LE MÊME FICHIER
// une fois posée. Ce test a justement besoin des VRAIES actions fetch* (pour qu'elles
// appellent le vrai services/api.ts et déclenchent le vrai chemin 401) -- un fichier de
// test séparé lui donne une instance de module (et donc de store) fraîche.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApiSync } from './useApiSync';
import useStore from '../store/useStore';

describe('useApiSync — 401 handling (I4 wiring: api.ts → setUnauthorizedHandler → store)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401, json: async () => ({ error: 'Token invalide ou expiré' }),
    }));
    useStore.setState({
      authToken: 'expired-tok', currentUser: 'u1', isLoadingData: true, saveError: null,
      users: [{ id: 'u1', name: 'Alice', email: 'a@b.com' }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('resets authToken/currentUser to null when a background request gets a 401 (expired/revoked token)', async () => {
    renderHook(() => useApiSync());

    await waitFor(() => expect(useStore.getState().authToken).toBeNull());
    expect(useStore.getState().currentUser).toBeNull();
  });
});
