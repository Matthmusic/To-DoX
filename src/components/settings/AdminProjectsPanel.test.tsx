import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminProjectsPanel } from './AdminProjectsPanel';
import useStore from '../../store/useStore';

// Régression : currentUser porte désormais l'UUID réel du backend (plus l'id local
// FIXED_USERS "matthieu") -- l'ancien contrôle `currentUser === "matthieu"` était donc
// devenu en permanence `false`, y compris pour le vrai admin. isAdmin doit maintenant se
// dériver du champ `role` renvoyé par le backend, pas d'un id codé en dur.
describe('AdminProjectsPanel', () => {
  beforeEach(() => {
    useStore.setState({
      tasks: [],
      timeEntries: [],
      projectHistory: [],
      directories: {},
      projectColors: {},
    });
  });

  it('shows the admin UI when the current user has role "admin", even at an id different from "matthieu"', () => {
    // id LOCAL et id BACKEND délibérément différents, et surtout != "matthieu", pour
    // prouver que l'accès est décidé par le rôle et non par un id codé en dur.
    useStore.setState({
      currentUser: 'backend-uuid-admin-1',
      users: [{ id: 'backend-uuid-admin-1', name: 'Real Admin', email: 'admin@example.com', role: 'admin' }],
    });

    render(<AdminProjectsPanel onClose={() => {}} />);

    expect(screen.getByText('Admin projets (JSON)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Rechercher un projet...')).toBeInTheDocument();
    expect(screen.queryByText(/Accès refusé/)).not.toBeInTheDocument();
  });

  it('denies access when the current user has role "member", even if their id happens to be "matthieu"', () => {
    // Même id que l'ancien hardcode ("matthieu"), mais role: 'member' -- si le contrôle
    // testait encore l'id plutôt que le rôle, ce cas passerait à tort.
    useStore.setState({
      currentUser: 'matthieu',
      users: [{ id: 'matthieu', name: 'Matthieu Maurel', email: 'matthieu.maurel@conception-ea.fr', role: 'member' }],
    });

    render(<AdminProjectsPanel onClose={() => {}} />);

    expect(screen.getByText(/Accès refusé/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Rechercher un projet...')).not.toBeInTheDocument();
  });
});
