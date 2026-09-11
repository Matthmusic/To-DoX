import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TitleBar } from './TitleBar';
import useStore from '../store/useStore';
import { FIXED_USERS } from '../constants';

vi.mock('./UserProfile', () => ({ UserProfile: () => null }));
vi.mock('../hooks/useTheme', () => ({ useTheme: () => ({ activeTheme: { palette: { primary: '#06b6d4', bgSecondary: '#111', borderPrimary: '#333', textSecondary: '#ccc' } } }) }));
const added = { id: 'alex-test', name: 'Alex Martin', email: 'alex@example.com' };
beforeEach(() => {
  useStore.setState({ ...useStore.getInitialState(), currentUser: 'matthieu', users: [...FIXED_USERS] });
  window.electronAPI = { isElectron: true, windowIsMaximized: vi.fn(async () => false) } as unknown as NonNullable<typeof window.electronAPI>;
});
describe('title bar directory', () => {
  it('adds a tab immediately and opens the new user view', async () => {
    await act(async () => { render(<TitleBar />); });
    act(() => useStore.getState().setUsers([...FIXED_USERS, added]));
    fireEvent.click(screen.getByRole('button', { name: 'Vue en tant que Alex Martin' }));
    expect(useStore.getState().viewAsUser).toBe(added.id);
    expect(screen.getByText('Alex Martin')).toBeInTheDocument();
  });
  it('shows a new non-VIP user their own tab without granting VIP access', async () => {
    useStore.setState({ users: [...FIXED_USERS, added], currentUser: added.id });
    await act(async () => { render(<TitleBar />); });
    expect(screen.getByRole('button', { name: 'Alex Martin' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vue en tant que Matthieu Maurel' })).not.toBeInTheDocument();
  });
});
