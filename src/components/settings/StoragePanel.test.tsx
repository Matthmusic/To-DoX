import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StoragePanel } from './StoragePanel';
import useStore from '../../store/useStore';
import * as api from '../../services/api';

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return { ...actual, clearToken: vi.fn() };
});

describe('StoragePanel', () => {
  beforeEach(() => {
    useStore.setState({ currentUser: 'u1', authToken: 'tok', users: [{ id: 'u1', name: 'A', email: 'a@b.com' }] });
  });

  it('shows the connected server and a logout button, no folder picker', () => {
    render(<StoragePanel onClose={() => {}} />);
    expect(screen.getByText('Se déconnecter')).toBeInTheDocument();
    expect(screen.queryByText(/dossier/i)).not.toBeInTheDocument();
  });

  it('logout clears the token and the session', async () => {
    render(<StoragePanel onClose={() => {}} />);
    fireEvent.click(screen.getByText('Se déconnecter'));

    // handleLogout is async (awaits clearToken before clearing the session) —
    // wait for the store update instead of asserting synchronously.
    await waitFor(() => {
      expect(useStore.getState().currentUser).toBeNull();
    });
    expect(api.clearToken).toHaveBeenCalledWith('u1');
    expect(useStore.getState().authToken).toBeNull();
  });
});
