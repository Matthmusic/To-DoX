import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectsListPanel } from './ProjectsListPanel';
import useStore from '../../store/useStore';
import type { Task } from '../../types';

// Régression review finale de branche :
// - Fix 3 (C3) : renameProject reste 100% local (non convertie en appel réseau) -- le
//   contrôle de renommage doit donc être désactivé dans l'UI plutôt que silencieusement
//   annulé par le poll de fetchProjects (voir useStore.ts, commentaire de renameProject).
// - Fix 7 (I5) : ce panneau fait un `setProjectHistory`/`setDirectories` local-only au
//   clic "Enregistrer" -- avertissement visible requis (limitation déjà connue et
//   documentée, pas re-convertie dans ce lot de fixes).
describe('ProjectsListPanel', () => {
    beforeEach(() => {
        useStore.setState({
            projectHistory: ['ACME', 'BETA'],
            tasks: [{ id: 't1', project: 'ACME' } as unknown as Task],
            directories: {},
        });
    });

    it('disables the rename control for each project row (regression: renameProject is not converted to the API)', () => {
        render(<ProjectsListPanel onClose={() => {}} />);

        const renameButtons = screen.getAllByRole('button', { name: /renommage de projet indisponible/i });
        expect(renameButtons.length).toBeGreaterThan(0);
        renameButtons.forEach(btn => expect(btn).toBeDisabled());
    });

    it('shows a warning that saved changes here may not persist', () => {
        render(<ProjectsListPanel onClose={() => {}} />);

        expect(screen.getByText(/peuvent ne pas persister/i)).toBeInTheDocument();
    });
});
