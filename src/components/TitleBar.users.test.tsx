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

  // Régression : currentUser porte désormais l'UUID réel du backend (plus l'id local
  // FIXED_USERS) -- VIP_USERS.includes(currentUser) était donc devenu en permanence
  // `false`. Le VIP check doit maintenant matcher par EMAIL (dérivé de FIXED_USERS via
  // VIP_USERS), pas par id local.
  it('shows VIP quick-switch tabs when the real backend user email matches a VIP FIXED_USERS entry', async () => {
    // id LOCAL ('matthieu', VIP) et id BACKEND ('backend-uuid-vip') délibérément
    // différents -- seul l'email partagé doit décider du statut VIP.
    const backendVip = { id: 'backend-uuid-vip', name: 'Real Backend User', email: 'matthieu.maurel@conception-ea.fr' };
    useStore.setState({ users: [...FIXED_USERS, backendVip], currentUser: backendVip.id });
    await act(async () => { render(<TitleBar />); });
    // VIP => les autres utilisateurs apparaissent comme onglets "Vue en tant que ..."
    expect(screen.getByRole('button', { name: 'Vue en tant que William Cresson' })).toBeInTheDocument();
  });

  it('does not show VIP quick-switch tabs when the real backend user email is not in the VIP set', async () => {
    const backendNonVip = { id: 'backend-uuid-non-vip', name: 'Real Backend User', email: 'not-vip@example.com' };
    useStore.setState({ users: [...FIXED_USERS, backendNonVip], currentUser: backendNonVip.id });
    await act(async () => { render(<TitleBar />); });
    expect(screen.getByRole('button', { name: 'Real Backend User' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vue en tant que William Cresson' })).not.toBeInTheDocument();
  });
});
