import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectDirs } from './ProjectDirs';
import useStore from '../../store/useStore';

// Régression I5 (review finale de branche) : save() fait un setDirectories(local) 100%
// local -- le poll 10s de fetchProjects (Task 10, useApiSync) peut faire réapparaître
// l'état serveur par-dessus peu après (limitation déjà connue et documentée, pas
// re-convertie dans ce lot de fixes). Avertissement visible requis plutôt que silencieux.
describe('ProjectDirs', () => {
    beforeEach(() => {
        useStore.setState({
            tasks: [{ id: 't1', project: 'ACME', archived: false } as any],
            directories: {},
        });
    });

    it('shows a warning that saved changes here may not persist', () => {
        render(<ProjectDirs onClose={() => {}} />);

        expect(screen.getByText(/peuvent ne pas persister/i)).toBeInTheDocument();
    });
});
