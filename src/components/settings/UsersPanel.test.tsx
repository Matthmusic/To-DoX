import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UsersPanel } from './UsersPanel';
import useStore from '../../store/useStore';

// Régression I5 (review finale de branche) : save() fait un setUsers(localUsers) 100%
// local -- le poll 10s de fetchUsers (Task 10, useApiSync) peut faire réapparaître l'état
// serveur par-dessus peu après (limitation déjà connue et documentée, pas re-convertie
// dans ce lot de fixes). Avertissement visible requis plutôt que silencieux.
describe('UsersPanel', () => {
    beforeEach(() => {
        useStore.setState({
            users: [{ id: 'u1', name: 'Alice', email: 'alice@test.com' }],
            currentUser: 'u1',
        });
    });

    it('shows a warning that saved changes here may not persist', () => {
        render(<UsersPanel onClose={() => {}} />);

        expect(screen.getByText(/peuvent ne pas persister/i)).toBeInTheDocument();
    });
});
