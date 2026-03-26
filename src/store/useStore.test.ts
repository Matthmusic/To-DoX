import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useStore from './useStore';

const ALICE = { id: 'alice', name: 'Alice Dupont', email: 'alice@test.com' };
const BOB   = { id: 'bob',   name: 'Bob Martin',   email: 'bob@test.com'   };

describe('useStore', () => {
    beforeEach(() => {
        const { setState } = useStore;
        act(() => {
            setState({
                tasks: [],
                users: [],
                comments: {},
                appNotifications: [],
                projectHistory: [],
                collapsedProjects: {},
                currentUser: 'matthieu',
            });
        });
        vi.restoreAllMocks();
    });

    it('should add a task', () => {
        const { result } = renderHook(() => useStore());

        const newTaskData = {
            title: 'Test Task',
            priority: 'med' as const,
        };

        act(() => {
            result.current.addTask(newTaskData);
        });

        expect(result.current.tasks).toHaveLength(1);
        // addTask uppercases titles
        expect(result.current.tasks[0]).toMatchObject({
            title: 'TEST TASK',
            priority: 'med',
            status: 'todo'
        });
        expect(result.current.tasks[0].id).toBeDefined();
        expect(result.current.tasks[0].createdAt).toBeDefined();
    });

    it('should update a task', () => {
        const { result } = renderHook(() => useStore());
        let taskId = '';

        act(() => {
            result.current.addTask({ title: 'Initial Title', priority: 'low' });
        });
        taskId = result.current.tasks[0].id;

        act(() => {
            result.current.updateTask(taskId, { title: 'Updated Title', status: 'doing' });
        });

        const updatedTask = result.current.tasks.find(t => t.id === taskId);
        // updateTask also uppercases titles
        expect(updatedTask?.title).toBe('UPDATED TITLE');
        expect(updatedTask?.status).toBe('doing');
    });

    it('should soft-delete a task (set deletedAt, keep in array)', () => {
        const { result } = renderHook(() => useStore());
        let taskId = '';

        act(() => {
            result.current.addTask({ title: 'To Delete', priority: 'low' });
        });
        taskId = result.current.tasks[0].id;

        act(() => {
            result.current.removeTask(taskId);
        });

        expect(result.current.tasks).toHaveLength(1);
        expect(result.current.tasks[0].deletedAt).not.toBeNull();
        expect(result.current.tasks[0].updatedAt).toBeGreaterThan(0);
    });

    it('should move a task (change status)', () => {
        const { result } = renderHook(() => useStore());
        let taskId = '';

        act(() => {
            result.current.addTask({ title: 'Moving Task', priority: 'med' });
        });
        taskId = result.current.tasks[0].id;

        act(() => {
            result.current.moveTask(taskId, 'done');
        });

        const task = result.current.tasks.find(t => t.id === taskId);
        expect(task?.status).toBe('done');
    });

    it('should moveProject: move all tasks of a project from one status to another', () => {
        const { result } = renderHook(() => useStore());

        act(() => {
            result.current.addTask({ title: 'Task A', project: 'ALPHA', priority: 'med', status: 'todo' });
            result.current.addTask({ title: 'Task B', project: 'ALPHA', priority: 'low', status: 'todo' });
            result.current.addTask({ title: 'Task C', project: 'BETA', priority: 'high', status: 'todo' });
        });

        act(() => {
            result.current.moveProject('ALPHA', 'todo', 'doing');
        });

        const alphaTasks = result.current.tasks.filter(t => t.project === 'ALPHA');
        const betaTasks = result.current.tasks.filter(t => t.project === 'BETA');

        expect(alphaTasks.every(t => t.status === 'doing')).toBe(true);
        expect(betaTasks[0].status).toBe('todo');
    });

    it('should moveProject to done: set completedAt', () => {
        const { result } = renderHook(() => useStore());

        act(() => {
            result.current.addTask({ title: 'Task A', project: 'GAMMA', priority: 'med', status: 'doing' });
        });

        act(() => {
            result.current.moveProject('GAMMA', 'doing', 'done');
        });

        const task = result.current.tasks.find(t => t.project === 'GAMMA');
        expect(task?.status).toBe('done');
        expect(task?.completedAt).not.toBeNull();
    });

    it('should archiveProject: set archived + archivedAt on all project tasks', () => {
        const { result } = renderHook(() => useStore());

        act(() => {
            result.current.addTask({ title: 'Task A', project: 'DELTA', priority: 'med' });
            result.current.addTask({ title: 'Task B', project: 'DELTA', priority: 'low' });
        });

        act(() => {
            result.current.archiveProject('DELTA');
        });

        const deltaTasks = result.current.tasks.filter(t => t.project === 'DELTA');
        expect(deltaTasks.every(t => t.archived === true)).toBe(true);
        expect(deltaTasks.every(t => t.archivedAt !== null)).toBe(true);
    });

    it('should deleteArchivedProject: soft-delete all archived tasks of a project', () => {
        const { result } = renderHook(() => useStore());

        act(() => {
            result.current.addTask({ title: 'Task A', project: 'EPSILON', priority: 'med' });
        });

        act(() => {
            result.current.archiveProject('EPSILON');
        });

        act(() => {
            result.current.deleteArchivedProject('EPSILON');
        });

        const epsilonTasks = result.current.tasks.filter(t => t.project === 'EPSILON');
        expect(epsilonTasks).toHaveLength(1);
        expect(epsilonTasks[0].deletedAt).not.toBeNull();
    });
});

// ── Review workflow ────────────────────────────────────────────────────────

describe('review workflow', () => {
    beforeEach(() => {
        act(() => {
            useStore.setState({
                tasks: [],
                users: [ALICE, BOB],
                projectHistory: [],
                collapsedProjects: {},
                currentUser: 'alice',
                appNotifications: [],
            });
        });
    });

    it('setReviewers: sets reviewers and auto-assigns them', () => {
        const { result } = renderHook(() => useStore());

        act(() => {
            result.current.addTask({ title: 'Ma tâche', priority: 'med', assignedTo: ['alice'] });
        });
        const taskId = result.current.tasks[0].id;

        act(() => {
            result.current.setReviewers(taskId, ['bob']);
        });

        const task = result.current.tasks.find(t => t.id === taskId)!;
        expect(task.reviewers).toEqual(['bob']);
        // Bob doit être auto-assigné à la tâche
        expect(task.assignedTo).toContain('bob');
    });

    it('setReviewers: creates review_requested notification for each reviewer', () => {
        const { result } = renderHook(() => useStore());

        act(() => {
            result.current.addTask({ title: 'Notification test', priority: 'low', assignedTo: ['alice'] });
        });
        const taskId = result.current.tasks[0].id;

        act(() => {
            result.current.setReviewers(taskId, ['bob']);
        });

        const notifs = result.current.appNotifications.filter(n => n.type === 'review_requested');
        expect(notifs).toHaveLength(1);
        expect(notifs[0].toUserId).toBe('bob');
        expect(notifs[0].fromUserId).toBe('alice');
        expect(notifs[0].taskId).toBe(taskId);
    });

    it('setReviewers: no-op if currentUser is null', () => {
        // Injecter directement une tâche (addTask est no-op sans currentUser)
        const fakeTask = { id: 'task-null-user', title: 'TACHE', project: 'TEST', priority: 'low' as const, status: 'todo' as const,
            due: null, assignedTo: [], createdBy: 'alice', createdAt: 0, updatedAt: 0, completedAt: null,
            notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null,
            ganttDays: [], order: 0 };
        act(() => { useStore.setState({ tasks: [fakeTask], currentUser: null }); });
        const { result } = renderHook(() => useStore());

        act(() => {
            result.current.setReviewers('task-null-user', ['bob']);
        });

        const task = result.current.tasks.find(t => t.id === 'task-null-user')!;
        expect(task.reviewers ?? []).toHaveLength(0);
    });

    it('validateTask: sets status to done and records validator', () => {
        const { result } = renderHook(() => useStore());

        act(() => {
            result.current.addTask({ title: 'À valider', priority: 'med', status: 'review', assignedTo: ['alice'] });
        });
        const taskId = result.current.tasks[0].id;

        act(() => {
            result.current.validateTask(taskId);
        });

        const task = result.current.tasks.find(t => t.id === taskId)!;
        expect(task.status).toBe('done');
        expect(task.reviewValidatedBy).toBe('alice');
        expect(task.reviewValidatedAt).toBeGreaterThan(0);
        expect(task.completedAt).not.toBeNull();
    });

    it('validateTask: creates review_validated notifications for all assignees', () => {
        const { result } = renderHook(() => useStore());

        act(() => {
            result.current.addTask({ title: 'Tâche validée', priority: 'med', status: 'review', assignedTo: ['alice', 'bob'] });
        });
        const taskId = result.current.tasks[0].id;

        act(() => {
            result.current.validateTask(taskId);
        });

        const notifs = result.current.appNotifications.filter(n => n.type === 'review_validated');
        expect(notifs).toHaveLength(2);
        const toIds = notifs.map(n => n.toUserId).sort();
        expect(toIds).toEqual(['alice', 'bob']);
    });

    it('requestCorrections: sets status to doing and records rejection info', () => {
        const { result } = renderHook(() => useStore());

        act(() => {
            result.current.addTask({ title: 'À corriger', priority: 'med', status: 'review', assignedTo: ['alice'] });
        });
        const taskId = result.current.tasks[0].id;

        act(() => {
            result.current.requestCorrections(taskId, 'Le titre est trop vague');
        });

        const task = result.current.tasks.find(t => t.id === taskId)!;
        expect(task.status).toBe('doing');
        expect(task.reviewRejectedBy).toBe('alice');
        expect(task.reviewRejectedAt).toBeGreaterThan(0);
        expect(task.rejectionComment).toBe('Le titre est trop vague');
    });

    it('requestCorrections: adds a comment in the task thread', () => {
        const { result } = renderHook(() => useStore());

        act(() => {
            result.current.addTask({ title: 'Tâche commentée', priority: 'low', status: 'review', assignedTo: ['alice'] });
        });
        const taskId = result.current.tasks[0].id;

        act(() => {
            result.current.requestCorrections(taskId, 'Voir remarques');
        });

        const comments = result.current.comments[taskId] ?? [];
        expect(comments.length).toBeGreaterThan(0);
        expect(comments[0].text).toContain('Voir remarques');
    });

    it('requestCorrections: creates review_rejected notifications for all assignees', () => {
        const { result } = renderHook(() => useStore());

        act(() => {
            result.current.addTask({ title: 'Rejet notif', priority: 'low', status: 'review', assignedTo: ['alice', 'bob'] });
        });
        const taskId = result.current.tasks[0].id;

        act(() => {
            result.current.requestCorrections(taskId, 'Corrections requises');
        });

        const notifs = result.current.appNotifications.filter(n => n.type === 'review_rejected');
        expect(notifs).toHaveLength(2);
    });

    it('reopenTask: sets status to doing and clears all review fields', () => {
        const { result } = renderHook(() => useStore());

        act(() => {
            result.current.addTask({ title: 'Rouvrir', priority: 'med', status: 'done', assignedTo: ['alice'] });
        });
        const taskId = result.current.tasks[0].id;
        act(() => {
            result.current.updateTask(taskId, {
                reviewValidatedBy: 'alice',
                reviewValidatedAt: Date.now(),
            });
        });

        act(() => {
            result.current.reopenTask(taskId);
        });

        const task = result.current.tasks.find(t => t.id === taskId)!;
        expect(task.status).toBe('doing');
        expect(task.reviewValidatedBy).toBeUndefined();
        expect(task.reviewValidatedAt).toBeUndefined();
        expect(task.reviewRejectedBy).toBeUndefined();
        expect(task.rejectionComment).toBeUndefined();
    });
});

// ── convertSubtaskBack ─────────────────────────────────────────────────────

describe('convertSubtaskBack', () => {
    beforeEach(() => {
        act(() => {
            useStore.setState({
                tasks: [],
                users: [ALICE],
                projectHistory: [],
                collapsedProjects: {},
                currentUser: 'alice',
                appNotifications: [],
            });
        });
    });

    it('returns ok and re-adds the subtask to the parent', () => {
        const { result } = renderHook(() => useStore());

        // Créer la tâche parente
        act(() => { result.current.addTask({ title: 'Parent', priority: 'med' }); });
        const parentId = result.current.tasks[0].id;

        // Créer la tâche fille simulant une sous-tâche convertie (addTask uppercasse le titre)
        act(() => {
            result.current.addTask({
                title: 'Sous-tâche convertie',
                priority: 'low',
                convertedFromSubtask: { parentTaskId: parentId, parentTaskTitle: 'PARENT' },
            });
        });
        const childId = result.current.tasks.find(t => t.title === 'SOUS-TÂCHE CONVERTIE')!.id;

        let returnValue: ReturnType<typeof result.current.convertSubtaskBack>;
        act(() => {
            returnValue = result.current.convertSubtaskBack(childId);
        });

        expect(returnValue!).toBe('ok');

        // La tâche fille doit être soft-deleted
        const child = result.current.tasks.find(t => t.id === childId)!;
        expect(child.deletedAt).not.toBeNull();

        // La sous-tâche doit être rattachée au parent
        const parent = result.current.tasks.find(t => t.id === parentId)!;
        expect(parent.subtasks?.some(st => st.title === 'SOUS-TÂCHE CONVERTIE')).toBe(true);
    });

    it('returns parent_deleted when parent is archived (but not deleted)', () => {
        const { result } = renderHook(() => useStore());

        act(() => { result.current.addTask({ title: 'Parent archivé', priority: 'low' }); });
        const parentId = result.current.tasks[0].id;
        act(() => { result.current.archiveTask(parentId); });

        act(() => {
            result.current.addTask({
                title: 'Enfant',
                priority: 'low',
                convertedFromSubtask: { parentTaskId: parentId, parentTaskTitle: 'PARENT ARCHIVÉ' },
            });
        });
        const childId = result.current.tasks.find(t => t.title === 'ENFANT')!.id;

        let returnValue: ReturnType<typeof result.current.convertSubtaskBack>;
        act(() => { returnValue = result.current.convertSubtaskBack(childId); });

        expect(returnValue!).toBe('parent_deleted');
    });

    it('returns parent_not_found when parent task does not exist', () => {
        const { result } = renderHook(() => useStore());

        act(() => {
            result.current.addTask({
                title: 'Orphelin',
                priority: 'low',
                convertedFromSubtask: { parentTaskId: 'inexistant-id', parentTaskTitle: 'Ghost' },
            });
        });
        const childId = result.current.tasks[0].id;

        let returnValue: ReturnType<typeof result.current.convertSubtaskBack>;
        act(() => { returnValue = result.current.convertSubtaskBack(childId); });

        expect(returnValue!).toBe('parent_not_found');
    });

    it('returns parent_not_found when parent task is soft-deleted', () => {
        const { result } = renderHook(() => useStore());

        act(() => { result.current.addTask({ title: 'Parent supprimé', priority: 'low' }); });
        const parentId = result.current.tasks[0].id;
        act(() => { result.current.removeTask(parentId); });

        act(() => {
            result.current.addTask({
                title: 'Enfant orphelin',
                priority: 'low',
                convertedFromSubtask: { parentTaskId: parentId, parentTaskTitle: 'PARENT SUPPRIMÉ' },
            });
        });
        const childId = result.current.tasks.find(t => t.title === 'ENFANT ORPHELIN')!.id;

        let returnValue: ReturnType<typeof result.current.convertSubtaskBack>;
        act(() => { returnValue = result.current.convertSubtaskBack(childId); });

        expect(returnValue!).toBe('parent_not_found');
    });

    it('returns parent_not_found when task has no convertedFromSubtask', () => {
        const { result } = renderHook(() => useStore());

        act(() => { result.current.addTask({ title: 'Tâche normale', priority: 'low' }); });
        const taskId = result.current.tasks[0].id;

        let returnValue: ReturnType<typeof result.current.convertSubtaskBack>;
        act(() => { returnValue = result.current.convertSubtaskBack(taskId); });

        expect(returnValue!).toBe('parent_not_found');
    });
});
