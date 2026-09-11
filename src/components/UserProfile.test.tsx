import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserProfile } from './UserProfile';
import useStore from '../store/useStore';
import * as api from '../services/api';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return { ...actual, clearToken: vi.fn() };
});

vi.mock('../utils/confirm', () => ({
  confirmModal: vi.fn(() => Promise.resolve(true)),
}));

describe('UserProfile', () => {
  beforeEach(() => {
    useStore.setState({
      currentUser: 'u1',
      authToken: 'tok',
      users: [{ id: 'u1', name: 'Alice Dupont', email: 'a@b.com' }],
    });
  });

  it('logout clears the auth token and the session', async () => {
    render(<UserProfile />);
    fireEvent.click(screen.getByTitle('Se déconnecter'));

    await waitFor(() => {
      expect(useStore.getState().currentUser).toBeNull();
    });
    expect(api.clearToken).toHaveBeenCalledWith('u1');
    expect(useStore.getState().authToken).toBeNull();
  });
});
