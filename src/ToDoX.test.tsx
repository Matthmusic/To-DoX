import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ToDoX from './ToDoX';
import useStore from './store/useStore';

// Régression : currentUser porte désormais l'UUID réel du backend (plus l'id local
// FIXED_USERS "matthieu") -- l'ancien contrôle `currentUser === "matthieu"` (ToDoX.tsx)
// était donc devenu en permanence `false`. isAdmin doit se dériver du champ `role`.
//
// ToDoX.tsx est le gros orchestrateur de l'appli (header + Kanban + ~15 panels) : ce test
// ne rend pas l'arbre complet -- KanbanHeaderPremium (seul consommateur de la prop isAdmin)
// et KanbanBoard (rendu par défaut, sans rapport avec ce test) sont remplacés par des stubs
// légers pour isoler exactement la valeur calculée par ToDoX.tsx et transmise en prop, sans
// dépendre du détail d'implémentation du menu déroulant du header.
vi.mock('./components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./components')>();
  return {
    ...actual,
    KanbanHeaderPremium: (props: { isAdmin: boolean }) => (
      <div data-testid="admin-flag">{String(props.isAdmin)}</div>
    ),
    KanbanBoard: () => <div data-testid="kanban-board-stub" />,
  };
});
vi.mock('./components/RightSidebar', () => ({ RightSidebar: () => null }));
vi.mock('./hooks/useNotifications', () => ({ useNotifications: () => ({ isEnabled: false, checkNow: () => {} }) }));
vi.mock('./hooks/useOutlookSync', () => ({
  useOutlookSync: () => ({ fetchOutlookEvents: vi.fn(), icsExportPath: null, icsViewPath: null, icsServerUrl: null }),
}));
vi.mock('./hooks/useKeyboardShortcuts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hooks/useKeyboardShortcuts')>();
  return { ...actual, useDefaultShortcuts: () => ({ shortcuts: [] }) };
});

describe('ToDoX — isAdmin prop (role-derived, not hardcoded id)', () => {
  beforeEach(() => {
    useStore.setState({
      ...useStore.getInitialState(),
      isLoadingData: false,
    });
  });

  it('passes isAdmin=true to the header when the current user has role "admin", at an id different from "matthieu"', async () => {
    useStore.setState({
      currentUser: 'backend-uuid-admin-1',
      users: [{ id: 'backend-uuid-admin-1', name: 'Real Admin', email: 'admin@example.com', role: 'admin' }],
    });

    render(<ToDoX />);

    expect(await screen.findByTestId('admin-flag')).toHaveTextContent('true');
  });

  it('passes isAdmin=false to the header when the current user has role "member", even if their id happens to be "matthieu"', async () => {
    useStore.setState({
      currentUser: 'matthieu',
      users: [{ id: 'matthieu', name: 'Matthieu Maurel', email: 'matthieu.maurel@conception-ea.fr', role: 'member' }],
    });

    render(<ToDoX />);

    expect(await screen.findByTestId('admin-flag')).toHaveTextContent('false');
  });
});
