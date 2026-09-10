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
  return { ...actual, login: vi.fn(), getToken: vi.fn(), saveToken: vi.fn(), clearToken: vi.fn() };
});

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
