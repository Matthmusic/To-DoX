import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskSubtasksFooter } from './TaskSubtasksFooter';
import useStore from '../../store/useStore';
import type { Task, TaskTemplate } from '../../types';

// Régression : "appliquer un template à une tâche" existait déjà dans SubtaskList.tsx (bouton
// + dropdown) mais TaskCard.tsx rend toujours SubtaskList avec `hideHeader`, ce qui masque
// aussi ce bouton -- TaskSubtasksFooter (qui affiche le header réellement visible en vue
// étendue) n'en a jamais eu d'équivalent. Le bouton était donc du code mort, jamais
// atteignable dans l'app réelle. Trouvé en direct pendant le smoke test manuel de la Tâche 12.

const TEMPLATE: TaskTemplate = { id: 'tpl1', name: 'Modèle X', subtaskTitles: ['Étape 1', 'Étape 2'] };

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 't1', title: 'Tâche', status: 'todo', priority: 'med', project: 'DEMO',
        due: '2026-01-01', subtasks: [], createdAt: Date.now(), updatedAt: Date.now(),
        completedAt: null, notes: '', archived: false, archivedAt: null, favorite: false,
        createdBy: 'u1', assignedTo: ['u1'], deletedAt: null,
        ...overrides,
    };
}

describe('TaskSubtasksFooter — appliquer un template', () => {
    beforeEach(() => {
        useStore.setState({ templates: [], applyTemplateToTask: vi.fn(), toggleSubtask: vi.fn(), users: [], currentUser: null });
    });

    it('vue étendue avec sous-tâches existantes : le bouton Template applique le modèle choisi', () => {
        useStore.setState({ templates: [TEMPLATE] });
        const task = makeTask({ subtasks: [{ id: 's1', title: 'rendu avp', completed: false, createdAt: Date.now(), completedAt: null, completedBy: null }] });

        render(
            <TaskSubtasksFooter
                task={task}
                totalSubtasks={1}
                completedSubtasks={0}
                progressPercentage={0}
                isSubtasksExpanded={true}
                onToggleExpanded={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /template/i }));
        fireEvent.click(screen.getByText('Modèle X'));

        expect(useStore.getState().applyTemplateToTask).toHaveBeenCalledWith('t1', 'tpl1');
    });

    it("vue étendue sans sous-tâche : le bouton Template est aussi accessible", () => {
        useStore.setState({ templates: [TEMPLATE] });
        const task = makeTask({ subtasks: [] });

        render(
            <TaskSubtasksFooter
                task={task}
                totalSubtasks={0}
                completedSubtasks={0}
                progressPercentage={0}
                isSubtasksExpanded={true}
                onToggleExpanded={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /template/i }));
        fireEvent.click(screen.getByText('Modèle X'));

        expect(useStore.getState().applyTemplateToTask).toHaveBeenCalledWith('t1', 'tpl1');
    });

    it("n'affiche aucun bouton Template quand il n'existe aucun modèle", () => {
        const task = makeTask({ subtasks: [{ id: 's1', title: 'x', completed: false, createdAt: Date.now(), completedAt: null, completedBy: null }] });

        render(
            <TaskSubtasksFooter
                task={task}
                totalSubtasks={1}
                completedSubtasks={0}
                progressPercentage={0}
                isSubtasksExpanded={true}
                onToggleExpanded={vi.fn()}
            />
        );

        expect(screen.queryByRole('button', { name: /template/i })).not.toBeInTheDocument();
    });

    it('le clic sur le bouton Template ne déclenche pas aussi le collapse/expand', () => {
        useStore.setState({ templates: [TEMPLATE] });
        const task = makeTask({ subtasks: [{ id: 's1', title: 'x', completed: false, createdAt: Date.now(), completedAt: null, completedBy: null }] });
        const onToggleExpanded = vi.fn();

        render(
            <TaskSubtasksFooter
                task={task}
                totalSubtasks={1}
                completedSubtasks={0}
                progressPercentage={0}
                isSubtasksExpanded={true}
                onToggleExpanded={onToggleExpanded}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /template/i }));

        expect(onToggleExpanded).not.toHaveBeenCalled();
    });
});
