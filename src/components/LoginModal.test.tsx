import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginModal } from './LoginModal';
import useStore from '../store/useStore';
import * as api from '../services/api';

// Mock via factory (plutôt qu'automock pur) pour préserver la vraie classe ApiError :
// l'automock par défaut de Vitest remplace le constructeur des classes exportées et ne
// reproduit pas l'affectation de `.message`/`.status`, ce qui casse les tests qui
// construisent un ApiError réel pour simuler une erreur serveur.
vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return { ...actual, login: vi.fn(), getToken: vi.fn(), saveToken: vi.fn(), clearToken: vi.fn(), apiGet: vi.fn() };
});

const ALICE = { id: 'alice', name: 'Alice Dupont', email: 'alice@test.com' };

describe('LoginModal', () => {
  beforeEach(() => {
    localStorage.removeItem('todox_extra_login_accounts');
    localStorage.removeItem('last_login_user_id');
    useStore.setState({ users: [ALICE], currentUser: null, localAuthUserId: null, authToken: null, authStatus: 'idle', authError: null });
    vi.mocked(api.getToken).mockResolvedValue(null);
    vi.mocked(api.login).mockReset();
    vi.mocked(api.apiGet).mockReset();
  });

  it('shows a password prompt when clicking a user with no stored session', async () => {
    render(<LoginModal />);

    fireEvent.click(screen.getByText('Alice Dupont'));

    await waitFor(() => expect(screen.getByPlaceholderText('Mot de passe')).toBeInTheDocument());
  });

  it('logs in and sets currentUser on correct password', async () => {
    // user.id renvoyé par login() est l'UUID réel du backend, distinct de l'id local
    // ALICE.id ('alice') -- sans cette distinction le test ne prouve rien (cf bug root cause).
    vi.mocked(api.login).mockResolvedValue({ token: 'tok123', user: { id: 'backend-uuid-xyz', email: 'alice@test.com', name: 'Alice Dupont', role: 'member' } });
    render(<LoginModal />);

    fireEvent.click(screen.getByText('Alice Dupont'));
    await waitFor(() => screen.getByPlaceholderText('Mot de passe'));
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByText('Se connecter'));

    await waitFor(() => expect(useStore.getState().currentUser).toBe('backend-uuid-xyz'));
    expect(useStore.getState().authToken).toBe('tok123');
    // saveToken reste indexé par l'id local -- c'est bien ce que le picker relit au lancement suivant.
    expect(api.saveToken).toHaveBeenCalledWith('alice', 'tok123');
    // localAuthUserId doit porter l'id LOCAL (celui utilisé pour saveToken/clearToken),
    // distinct de currentUser (l'UUID backend) -- c'est la seule info qui permet au logout
    // de purger le bon token plus tard (voir handlePickUser/clearToken).
    expect(useStore.getState().localAuthUserId).toBe('alice');
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
    vi.mocked(api.apiGet).mockResolvedValue({ user: { id: 'backend-uuid-xyz', email: 'alice@test.com', name: 'Alice Dupont', role: 'member' } });
    render(<LoginModal />);

    fireEvent.click(screen.getByText('Alice Dupont'));

    await waitFor(() => expect(useStore.getState().currentUser).toBe('backend-uuid-xyz'));
    expect(screen.queryByPlaceholderText('Mot de passe')).not.toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
    expect(api.apiGet).toHaveBeenCalledWith('/api/auth/me', 'existing-tok');
    // Même exigence que le chemin mot de passe : localAuthUserId = id LOCAL, distinct de
    // currentUser (UUID backend résolu via /api/auth/me).
    expect(useStore.getState().localAuthUserId).toBe('alice');
  });

  it('falls back to the password prompt when the stored token is stale/invalid', async () => {
    vi.mocked(api.getToken).mockResolvedValue('stale-tok');
    vi.mocked(api.apiGet).mockRejectedValue(new api.ApiError(401, 'Session expirée'));
    render(<LoginModal />);

    fireEvent.click(screen.getByText('Alice Dupont'));

    await waitFor(() => expect(screen.getByPlaceholderText('Mot de passe')).toBeInTheDocument());
    expect(useStore.getState().currentUser).toBeNull();
    // L'id local, pas l'UUID backend : le token stocké est indexé par l'id local (cf saveToken).
    expect(api.clearToken).toHaveBeenCalledWith('alice');
  });

  describe('compte absent de la liste (« Autre compte »)', () => {
    const NEW_LOGIN = { token: 'tok-new', user: { id: 'new-uuid', email: 'nouveau@test.com', name: 'Nouveau Membre', role: 'member' } };

    function loginViaOtherAccount(email = 'Nouveau@Test.com', password = 'motdepasse1') {
      fireEvent.click(screen.getByText("Mon nom n'est pas dans la liste"));
      fireEvent.change(screen.getByPlaceholderText('email@exemple.com'), { target: { value: email } });
      fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: password } });
      fireEvent.click(screen.getByText('Se connecter'));
    }

    it("connecte le compte par email et l'indexe par l'id serveur", async () => {
      vi.mocked(api.login).mockResolvedValue(NEW_LOGIN);
      render(<LoginModal />);

      loginViaOtherAccount();

      await waitFor(() => expect(useStore.getState().currentUser).toBe('new-uuid'));
      expect(api.login).toHaveBeenCalledWith('nouveau@test.com', 'motdepasse1');
      expect(api.saveToken).toHaveBeenCalledWith('new-uuid', 'tok-new');
      expect(useStore.getState().authToken).toBe('tok-new');
      expect(useStore.getState().localAuthUserId).toBe('new-uuid');
    });

    it('affiche le message du serveur sur un mauvais mot de passe', async () => {
      vi.mocked(api.login).mockRejectedValue(new api.ApiError(401, 'Email ou mot de passe incorrect'));
      render(<LoginModal />);

      loginViaOtherAccount();

      await waitFor(() => expect(screen.getByText('Email ou mot de passe incorrect')).toBeInTheDocument());
      expect(useStore.getState().currentUser).toBeNull();
    });

    it('mémorise le compte et le propose dans la liste au lancement suivant', async () => {
      vi.mocked(api.login).mockResolvedValue(NEW_LOGIN);
      const first = render(<LoginModal />);
      loginViaOtherAccount();
      await waitFor(() => expect(useStore.getState().currentUser).toBe('new-uuid'));
      first.unmount();

      useStore.setState({ currentUser: null, authToken: null, localAuthUserId: null });
      render(<LoginModal />);

      expect(screen.getByText('Nouveau Membre')).toBeInTheDocument();
    });

    it("n'affiche jamais en double un compte mémorisé dont l'email est déjà dans la liste", () => {
      localStorage.setItem('todox_extra_login_accounts', JSON.stringify([{ id: 'other-uuid', name: 'Alice Dupont', email: 'ALICE@test.com' }]));
      render(<LoginModal />);

      expect(screen.getAllByText('Alice Dupont')).toHaveLength(1);
    });

    it('affiche quand même la liste si le stockage des comptes mémorisés est corrompu', () => {
      localStorage.setItem('todox_extra_login_accounts', '{pas du json');
      render(<LoginModal />);

      expect(screen.getByText('Alice Dupont')).toBeInTheDocument();
    });
  });
});
