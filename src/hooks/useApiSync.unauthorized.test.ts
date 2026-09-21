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
import * as api from '../services/api';

// Mock via factory (préserve le reste du module réel) : ce test a besoin d'espionner
// clearToken() pour vérifier QUEL id il reçoit -- currentUser (UUID backend) et
// localAuthUserId (id LOCAL FIXED_USERS utilisé par saveToken/getToken) sont
// délibérément DIFFÉRENTS ci-dessous pour prouver que le bon id est utilisé (cf le bug
// que ce fix corrige : avant, ce handler appelait clearToken(currentUser), qui ne
// correspondait plus jamais à la clé sous laquelle le token avait été sauvegardé).
vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return { ...actual, clearToken: vi.fn() };
});

describe('useApiSync — 401 handling (I4 wiring: api.ts → setUnauthorizedHandler → store)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401, json: async () => ({ error: 'Token invalide ou expiré' }),
    }));
    // clearToken est appelé sans `await` dans le handler (`.catch(() => {})` directement) --
    // le mock doit donc renvoyer une Promise comme le ferait la vraie implémentation async,
    // sinon `.catch` sur `undefined` lève une TypeError synchrone qui interrompt le handler
    // avant les setX(null) qui suivent.
    vi.mocked(api.clearToken).mockReset().mockResolvedValue(undefined);
    useStore.setState({
      authToken: 'expired-tok', currentUser: 'u1', localAuthUserId: 'local-u1', isLoadingData: true, saveError: null,
      users: [{ id: 'u1', name: 'Alice', email: 'a@b.com' }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('resets authToken/currentUser/localAuthUserId to null when a background request gets a 401 (expired/revoked token), and clears the token keyed by the LOCAL id', async () => {
    renderHook(() => useApiSync());

    await waitFor(() => expect(useStore.getState().authToken).toBeNull());
    expect(useStore.getState().currentUser).toBeNull();
    expect(useStore.getState().localAuthUserId).toBeNull();
    // L'id LOCAL ('local-u1'), pas currentUser ('u1') -- c'est la clé sous laquelle
    // saveToken() a réellement écrit le token (voir LoginModal.tsx).
    expect(api.clearToken).toHaveBeenCalledWith('local-u1');
  });
});
