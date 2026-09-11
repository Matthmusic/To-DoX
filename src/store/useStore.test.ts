/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures de test partielles (objets
   Task/Subtask volontairement incomplets, réponses API mockées génériques) : le brief de la
   tâche 5 utilise lui-même `as any` pour ce même usage (voir ses tests Step 1, reproduits
   verbatim plus bas) ; retyper chaque fixture avec un objet Task/Subtask complet n'apporterait
   rien à la couverture et alourdirait fortement ce fichier. */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useStore from './useStore';
import * as api from '../services/api';

// Mock via factory (plutôt qu'automock pur) pour préserver la vraie classe ApiError :
// l'automock par défaut de Vitest remplace le constructeur des classes exportées et ne
// reproduit pas l'affectation de `.message`/`.status`, ce qui casse les tests qui
// construisent un ApiError réel pour simuler une erreur serveur.
vi.mock('../services/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../services/api')>();
    return { ...actual, apiGet: vi.fn(), apiPost: vi.fn(), apiPut: vi.fn(), apiPatch: vi.fn(), apiDelete: vi.fn() };
});

const ALICE = { id: 'alice', name: 'Alice Dupont', email: 'alice@test.com' };
const BOB   = { id: 'bob',   name: 'Bob Martin',   email: 'bob@test.com'   };

/**
 * Mocks par défaut de apiPost/apiPut/apiDelete/apiPatch, appelés dans le beforeEach de
 * chaque describe ci-dessous. Ils imitent d'assez près le comportement réel du backend
 * (todox-backend/src/routes/tasks.ts et .../subtasks.ts) pour que les tests écrits à
 * l'origine pour un store 100% local restent représentatifs sans retaper un objet Task
 * complet dans chaque test :
 * - apiPost : renvoie un objet plausible côté serveur (id généré, champs du payload
 *   recopiés) pour /api/tasks et /api/tasks/:id/subtasks.
 * - apiPut : recopie le corps envoyé (comme le ferait une vraie réponse PATCH-like), sauf
 *   pour 2 comportements serveur qu'il reproduit explicitement car des tests en dépendent :
 *   (a) `completedAt` est déduit automatiquement du changement de statut / de `completed`
 *   (jamais envoyé par le client, voir le commentaire de `updateTask` dans useStore.ts) ;
 *   (b) les champs de workflow de révision sont normalisés `null` → `undefined` quand ils
 *   sont vidés, exactement comme `formatTask` côté backend (voir le commentaire du type
 *   `TaskPatch` dans useStore.ts).
 * - apiDelete/apiPatch : résolvent simplement (204 / {ok:true}), ces actions ne dépendent
 *   pas du contenu de la réponse.
 * Un test qui a besoin d'une réponse exacte (les 4 tests de l'étape 1 du brief, entre
 * autres) écrase ce mock par défaut avec son propre `mockResolvedValue`/`mockResolvedValueOnce`.
 */
function installDefaultApiMocks() {
    vi.mocked(api.apiPost).mockImplementation(async (path: string, body: any) => {
        if (path.endsWith('/subtasks')) {
            return {
                id: 'sub-' + Math.random().toString(36).slice(2),
                title: body.title,
                completed: false,
                createdAt: Date.now(),
                completedAt: null,
                completedBy: null,
            };
        }
        if (path.endsWith('/comments')) {
            // Réplique POST /api/tasks/:taskId/comments (todox-backend/src/routes/comments.ts) :
            // userId vient de l'utilisateur authentifié côté serveur, jamais du body.
            const taskId = path.split('/').filter(Boolean)[2];
            return {
                id: 'cmt-' + Math.random().toString(36).slice(2),
                taskId,
                userId: useStore.getState().currentUser,
                text: body.text,
                createdAt: Date.now(),
                deletedAt: null,
            };
        }
        return {
            id: 'srv-' + Math.random().toString(36).slice(2),
            title: body.title,
            project: body.project,
            due: body.due ?? null,
            priority: body.priority ?? 'med',
            status: body.status ?? 'todo',
            createdBy: body.assignedTo?.[0] ?? 'unassigned',
            assignedTo: body.assignedTo ?? [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            completedAt: body.status === 'done' ? Date.now() : null,
            notes: body.notes ?? '',
            archived: false,
            archivedAt: null,
            favorite: !!body.favorite,
            deletedAt: null,
            subtasks: [],
            reviewers: [],
        };
    });
    vi.mocked(api.apiPut).mockImplementation(async (path: string, body: any) => {
        const id = path.split('/').filter(Boolean).pop()!;
        const result: any = { id, ...body };
        for (const f of ['reviewValidatedBy', 'reviewValidatedAt', 'reviewRejectedBy', 'reviewRejectedAt', 'rejectionComment']) {
            if (result[f] === null) result[f] = undefined;
        }
        if (body.status === 'done') result.completedAt = Date.now();
        else if (body.status) result.completedAt = null;
        if (body.completed !== undefined) {
            result.completedAt = body.completed ? Date.now() : null;
            // Réplique PUT /api/tasks/:taskId/subtasks/:subId : `completedBy` est déduit
            // serveur de l'appelant (req.userId), jamais envoyé par le client (voir
            // todox-backend/src/routes/subtasks.ts).
            result.completedBy = body.completed ? useStore.getState().currentUser : null;
        }
        return result;
    });
    vi.mocked(api.apiDelete).mockResolvedValue(undefined);
    vi.mocked(api.apiPatch).mockResolvedValue({ ok: true });
}

describe('useStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
                authToken: 'tok',
            });
        });
        installDefaultApiMocks();
    });

    it('should add a task', async () => {
        const { result } = renderHook(() => useStore());

        const newTaskData = {
            title: 'Test Task',
            priority: 'med' as const,
        };

        await act(async () => {
            await result.current.addTask(newTaskData);
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

    it('should update a task', async () => {
        const { result } = renderHook(() => useStore());
        let taskId = '';

        await act(async () => {
            await result.current.addTask({ title: 'Initial Title', priority: 'low' });
        });
        taskId = result.current.tasks[0].id;

        await act(async () => {
            await result.current.updateTask(taskId, { title: 'Updated Title', status: 'doing' });
        });

        const updatedTask = result.current.tasks.find(t => t.id === taskId);
        // updateTask also uppercases titles
        expect(updatedTask?.title).toBe('UPDATED TITLE');
        expect(updatedTask?.status).toBe('doing');
    });

    it('should soft-delete a task (set deletedAt, keep in array)', async () => {
        const { result } = renderHook(() => useStore());
        let taskId = '';

        await act(async () => {
            await result.current.addTask({ title: 'To Delete', priority: 'low' });
        });
        taskId = result.current.tasks[0].id;

        await act(async () => {
            await result.current.removeTask(taskId);
        });

        expect(result.current.tasks).toHaveLength(1);
        expect(result.current.tasks[0].deletedAt).not.toBeNull();
        expect(result.current.tasks[0].updatedAt).toBeGreaterThan(0);
        expect(api.apiDelete).toHaveBeenCalledWith(`/api/tasks/${taskId}`, 'tok');
    });

    it('should move a task (change status)', async () => {
        const { result } = renderHook(() => useStore());
        let taskId = '';

        await act(async () => {
            await result.current.addTask({ title: 'Moving Task', priority: 'med' });
        });
        taskId = result.current.tasks[0].id;

        await act(async () => {
            await result.current.moveTask(taskId, 'done');
        });

        const task = result.current.tasks.find(t => t.id === taskId);
        expect(task?.status).toBe('done');
    });

    it('should moveProject: move all tasks of a project from one status to another', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => {
            await result.current.addTask({ title: 'Task A', project: 'ALPHA', priority: 'med', status: 'todo' });
            await result.current.addTask({ title: 'Task B', project: 'ALPHA', priority: 'low', status: 'todo' });
            await result.current.addTask({ title: 'Task C', project: 'BETA', priority: 'high', status: 'todo' });
        });

        act(() => {
            result.current.moveProject('ALPHA', 'todo', 'doing');
        });

        const alphaTasks = result.current.tasks.filter(t => t.project === 'ALPHA');
        const betaTasks = result.current.tasks.filter(t => t.project === 'BETA');

        expect(alphaTasks.every(t => t.status === 'doing')).toBe(true);
        expect(betaTasks[0].status).toBe('todo');
    });

    it('should moveProject to done: set completedAt', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => {
            await result.current.addTask({ title: 'Task A', project: 'GAMMA', priority: 'med', status: 'doing' });
        });

        act(() => {
            result.current.moveProject('GAMMA', 'doing', 'done');
        });

        const task = result.current.tasks.find(t => t.project === 'GAMMA');
        expect(task?.status).toBe('done');
        expect(task?.completedAt).not.toBeNull();
    });

    it('should archiveProject: set archived + archivedAt on all project tasks', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => {
            await result.current.addTask({ title: 'Task A', project: 'DELTA', priority: 'med' });
            await result.current.addTask({ title: 'Task B', project: 'DELTA', priority: 'low' });
        });

        act(() => {
            result.current.archiveProject('DELTA');
        });

        const deltaTasks = result.current.tasks.filter(t => t.project === 'DELTA');
        expect(deltaTasks.every(t => t.archived === true)).toBe(true);
        expect(deltaTasks.every(t => t.archivedAt !== null)).toBe(true);
    });

    it('should deleteArchivedProject: soft-delete all archived tasks of a project', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => {
            await result.current.addTask({ title: 'Task A', project: 'EPSILON', priority: 'med' });
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

// ── Tasks via API (brief Step 1 — subset couvrant create / PATCH semantics / delete / subtask) ──

describe('tasks via API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useStore.setState({ authToken: 'tok', tasks: [], currentUser: 'u1' });
    });

    it('addTask posts to /api/tasks and stores the server-returned task (server id, not client uid())', async () => {
        const serverTask = { id: 'srv-1', title: 'TEST TASK', project: 'X', status: 'todo', priority: 'med', createdBy: 'u1', assignedTo: ['u1'], createdAt: 1000, updatedAt: 1000, completedAt: null, notes: '', archived: false, archivedAt: null, favorite: false, deletedAt: null, subtasks: [], reviewers: [] };
        vi.mocked(api.apiPost).mockResolvedValue(serverTask);
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.addTask({ title: 'Test Task', project: 'X', priority: 'med' }); });

        expect(api.apiPost).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({ title: 'TEST TASK', project: 'X' }), 'tok');
        expect(result.current.tasks[0].id).toBe('srv-1');
    });

    it('updateTask sends only the changed fields (PATCH semantics) via PUT', async () => {
        useStore.setState({ tasks: [{ id: 't1', title: 'A', status: 'todo' } as any] });
        vi.mocked(api.apiPut).mockResolvedValue({ id: 't1', title: 'A', status: 'doing' });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.updateTask('t1', { status: 'doing' }); });

        expect(api.apiPut).toHaveBeenCalledWith('/api/tasks/t1', { status: 'doing' }, 'tok');
    });

    it('removeTask calls DELETE (soft-delete server-side)', async () => {
        useStore.setState({ tasks: [{ id: 't1', title: 'A' } as any] });
        vi.mocked(api.apiDelete).mockResolvedValue(undefined);
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.removeTask('t1'); });

        expect(api.apiDelete).toHaveBeenCalledWith('/api/tasks/t1', 'tok');
    });

    it('addSubtask posts to /api/tasks/:taskId/subtasks', async () => {
        useStore.setState({ tasks: [{ id: 't1', title: 'A', subtasks: [] } as any] });
        vi.mocked(api.apiPost).mockResolvedValue({ id: 's1', title: 'Sub', completed: false, createdAt: 1000, completedAt: null, completedBy: null, assignedTo: [], startDate: null, endDate: null });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.addSubtask('t1', 'Sub'); });

        expect(api.apiPost).toHaveBeenCalledWith('/api/tasks/t1/subtasks', { title: 'Sub' }, 'tok');
        expect(result.current.tasks[0].subtasks).toHaveLength(1);
    });

    it('addTask preserves ganttDays/convertedFromSubtask locally even though the server response never includes them', async () => {
        // Le backend n'a aucune colonne pour ces 2 champs (voir todox-backend formatTask) —
        // updateTask/addTask doivent donc les recréer/conserver localement plutôt que de
        // remplacer intégralement la tâche par la réponse serveur.
        vi.mocked(api.apiPost).mockResolvedValue({ id: 'srv-2', title: 'ENFANT', project: 'X', status: 'todo', priority: 'med', createdBy: 'u1', assignedTo: ['u1'], createdAt: 1000, updatedAt: 1000, completedAt: null, notes: '', archived: false, archivedAt: null, favorite: false, deletedAt: null, subtasks: [], reviewers: [] });
        const { result } = renderHook(() => useStore());

        await act(async () => {
            await result.current.addTask({
                title: 'Enfant',
                project: 'X',
                priority: 'med',
                convertedFromSubtask: { parentTaskId: 'parent-1', parentTaskTitle: 'PARENT' },
            });
        });

        expect(result.current.tasks[0].ganttDays).toEqual([]);
        expect(result.current.tasks[0].convertedFromSubtask).toEqual({ parentTaskId: 'parent-1', parentTaskTitle: 'PARENT' });
    });

    it('updateTask does not overwrite ganttDays with a server response that omits it', async () => {
        useStore.setState({
            tasks: [{ id: 't1', title: 'A', status: 'todo', ganttDays: [{ date: '2026-01-01' }] } as any],
        });
        // Réponse serveur réaliste : pas de champ ganttDays du tout (comme formatTask le ferait).
        vi.mocked(api.apiPut).mockResolvedValue({ id: 't1', title: 'A', status: 'doing' } as any);
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.updateTask('t1', { status: 'doing' }); });

        expect(result.current.tasks[0].ganttDays).toEqual([{ date: '2026-01-01' }]);
    });
});

// ── Subtasks via API ─────────────────────────────────────────────────────────

describe('subtasks via API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useStore.setState({ authToken: 'tok', currentUser: 'alice', users: [ALICE, BOB] });
        installDefaultApiMocks();
    });

    function taskWithSubtask() {
        return {
            id: 't1',
            title: 'A',
            subtasks: [{ id: 's1', title: 'Sub', completed: false, createdAt: 1, completedAt: null, completedBy: null }],
        } as any;
    }

    it('toggleSubtask PUTs { completed } and updates local state', async () => {
        useStore.setState({ tasks: [taskWithSubtask()] });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.toggleSubtask('t1', 's1'); });

        expect(api.apiPut).toHaveBeenCalledWith('/api/tasks/t1/subtasks/s1', { completed: true }, 'tok');
        const sub = result.current.tasks[0].subtasks[0];
        expect(sub.completed).toBe(true);
        expect(sub.completedBy).toBe('alice');
    });

    it('deleteSubtask calls DELETE and removes the subtask locally', async () => {
        useStore.setState({ tasks: [taskWithSubtask()] });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.deleteSubtask('t1', 's1'); });

        expect(api.apiDelete).toHaveBeenCalledWith('/api/tasks/t1/subtasks/s1', 'tok');
        expect(result.current.tasks[0].subtasks).toHaveLength(0);
    });

    it('updateSubtaskTitle PUTs { title } and updates local state', async () => {
        useStore.setState({ tasks: [taskWithSubtask()] });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.updateSubtaskTitle('t1', 's1', 'Nouveau titre'); });

        expect(api.apiPut).toHaveBeenCalledWith('/api/tasks/t1/subtasks/s1', { title: 'Nouveau titre' }, 'tok');
        expect(result.current.tasks[0].subtasks[0].title).toBe('Nouveau titre');
    });

    it('reorderSubtasks reorders locally then PATCHes the new order', async () => {
        useStore.setState({
            tasks: [{
                id: 't1', title: 'A',
                subtasks: [
                    { id: 's1', title: 'First', completed: false, createdAt: 1, completedAt: null, completedBy: null },
                    { id: 's2', title: 'Second', completed: false, createdAt: 2, completedAt: null, completedBy: null },
                ],
            } as any],
        });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.reorderSubtasks('t1', 0, 1); });

        expect(result.current.tasks[0].subtasks.map(s => s.id)).toEqual(['s2', 's1']);
        expect(api.apiPatch).toHaveBeenCalledWith('/api/tasks/t1/subtasks/reorder', { order: ['s2', 's1'] }, 'tok');
    });

    it('assignSubtask PUTs { assignedTo } (adds the user) and updates local state', async () => {
        useStore.setState({ tasks: [taskWithSubtask()] });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.assignSubtask('t1', 's1', 'bob'); });

        expect(api.apiPut).toHaveBeenCalledWith('/api/tasks/t1/subtasks/s1', { assignedTo: ['bob'] }, 'tok');
        expect(result.current.tasks[0].subtasks[0].assignedTo).toEqual(['bob']);
    });

    it('assignSubtask is a no-op (no API call) if the user is already assigned', async () => {
        useStore.setState({ tasks: [{ id: 't1', title: 'A', subtasks: [{ id: 's1', title: 'Sub', completed: false, createdAt: 1, completedAt: null, completedBy: null, assignedTo: ['bob'] }] } as any] });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.assignSubtask('t1', 's1', 'bob'); });

        expect(api.apiPut).not.toHaveBeenCalled();
    });

    it('unassignSubtask PUTs { assignedTo } (removes the user) and updates local state', async () => {
        useStore.setState({ tasks: [{ id: 't1', title: 'A', subtasks: [{ id: 's1', title: 'Sub', completed: false, createdAt: 1, completedAt: null, completedBy: null, assignedTo: ['alice', 'bob'] }] } as any] });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.unassignSubtask('t1', 's1', 'bob'); });

        expect(api.apiPut).toHaveBeenCalledWith('/api/tasks/t1/subtasks/s1', { assignedTo: ['alice'] }, 'tok');
        expect(result.current.tasks[0].subtasks[0].assignedTo).toEqual(['alice']);
    });

    it('setSubtaskDates PUTs only the provided field(s) (PATCH semantics) and updates local state', async () => {
        useStore.setState({ tasks: [taskWithSubtask()] });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.setSubtaskDates('t1', 's1', { startDate: '2026-01-01' }); });

        // Seul `startDate` était fourni : `endDate` ne doit pas apparaître dans le corps envoyé.
        expect(api.apiPut).toHaveBeenCalledWith('/api/tasks/t1/subtasks/s1', { startDate: '2026-01-01' }, 'tok');
        expect(result.current.tasks[0].subtasks[0].startDate).toBe('2026-01-01');
    });

    it('toggleSubtask uses the server-returned completedBy (no client-side derivation)', async () => {
        useStore.setState({ tasks: [taskWithSubtask()] });
        vi.mocked(api.apiPut).mockResolvedValue({ id: 's1', title: 'Sub', completed: true, createdAt: 1, completedAt: 2000, completedBy: 'alice', assignedTo: [], startDate: null, endDate: null });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.toggleSubtask('t1', 's1'); });

        expect(api.apiPut).toHaveBeenCalledWith('/api/tasks/t1/subtasks/s1', { completed: true }, 'tok');
        expect(result.current.tasks[0].subtasks[0].completedBy).toBe('alice');
    });
});

// ── Review workflow ────────────────────────────────────────────────────────

describe('review workflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        act(() => {
            useStore.setState({
                tasks: [],
                users: [ALICE, BOB],
                projectHistory: [],
                collapsedProjects: {},
                currentUser: 'alice',
                appNotifications: [],
                authToken: 'tok',
            });
        });
        installDefaultApiMocks();
    });

    it('setReviewers: sets reviewers and auto-assigns them', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => {
            await result.current.addTask({ title: 'Ma tâche', priority: 'med', assignedTo: ['alice'] });
        });
        const taskId = result.current.tasks[0].id;

        await act(async () => {
            await result.current.setReviewers(taskId, ['bob']);
        });

        const task = result.current.tasks.find(t => t.id === taskId)!;
        expect(task.reviewers).toEqual(['bob']);
        // Bob doit être auto-assigné à la tâche
        expect(task.assignedTo).toContain('bob');
        expect(api.apiPut).toHaveBeenCalledWith(`/api/tasks/${taskId}`, { reviewers: ['bob'], assignedTo: expect.arrayContaining(['alice', 'bob']) }, 'tok');
    });

    it('setReviewers: no-op if currentUser is null', async () => {
        // Injecter directement une tâche (addTask est no-op sans currentUser)
        const fakeTask = { id: 'task-null-user', title: 'TACHE', project: 'TEST', priority: 'low' as const, status: 'todo' as const,
            due: null, assignedTo: [], createdBy: 'alice', createdAt: 0, updatedAt: 0, completedAt: null,
            notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null,
            ganttDays: [], order: 0 };
        act(() => { useStore.setState({ tasks: [fakeTask], currentUser: null }); });
        const { result } = renderHook(() => useStore());

        await act(async () => {
            await result.current.setReviewers('task-null-user', ['bob']);
        });

        const task = result.current.tasks.find(t => t.id === 'task-null-user')!;
        expect(task.reviewers ?? []).toHaveLength(0);
        expect(api.apiPut).not.toHaveBeenCalled();
    });

    it('validateTask: sets status to done and records validator', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => {
            await result.current.addTask({ title: 'À valider', priority: 'med', status: 'review', assignedTo: ['alice'] });
        });
        const taskId = result.current.tasks[0].id;

        await act(async () => {
            await result.current.validateTask(taskId);
        });

        const task = result.current.tasks.find(t => t.id === taskId)!;
        expect(task.status).toBe('done');
        expect(task.reviewValidatedBy).toBe('alice');
        expect(task.reviewValidatedAt).toBeGreaterThan(0);
        expect(task.completedAt).not.toBeNull();
    });

    it('requestCorrections: sets status to doing and records rejection info', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => {
            await result.current.addTask({ title: 'À corriger', priority: 'med', status: 'review', assignedTo: ['alice'] });
        });
        const taskId = result.current.tasks[0].id;

        await act(async () => {
            await result.current.requestCorrections(taskId, 'Le titre est trop vague');
        });

        const task = result.current.tasks.find(t => t.id === taskId)!;
        expect(task.status).toBe('doing');
        expect(task.reviewRejectedBy).toBe('alice');
        expect(task.reviewRejectedAt).toBeGreaterThan(0);
        expect(task.rejectionComment).toBe('Le titre est trop vague');
    });

    it('requestCorrections: adds a comment in the task thread', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => {
            await result.current.addTask({ title: 'Tâche commentée', priority: 'low', status: 'review', assignedTo: ['alice'] });
        });
        const taskId = result.current.tasks[0].id;

        await act(async () => {
            await result.current.requestCorrections(taskId, 'Voir remarques');
        });

        const comments = result.current.comments[taskId] ?? [];
        expect(comments.length).toBeGreaterThan(0);
        expect(comments[0].text).toContain('Voir remarques');
    });

    it('reopenTask: sets status to doing and clears all review fields', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => {
            await result.current.addTask({ title: 'Rouvrir', priority: 'med', status: 'done', assignedTo: ['alice'] });
        });
        const taskId = result.current.tasks[0].id;
        await act(async () => {
            await result.current.updateTask(taskId, {
                reviewValidatedBy: 'alice',
                reviewValidatedAt: Date.now(),
            });
        });

        await act(async () => {
            await result.current.reopenTask(taskId);
        });

        const task = result.current.tasks.find(t => t.id === taskId)!;
        expect(task.status).toBe('doing');
        expect(task.reviewValidatedBy).toBeUndefined();
        expect(task.reviewValidatedAt).toBeUndefined();
        expect(task.reviewRejectedBy).toBeUndefined();
        expect(task.rejectionComment).toBeUndefined();
    });

    it('reopenTask: sends explicit null (not undefined) for review fields so the server actually clears them', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => {
            await result.current.addTask({ title: 'Rouvrir 2', priority: 'med', status: 'done', assignedTo: ['alice'] });
        });
        const taskId = result.current.tasks[0].id;

        await act(async () => {
            await result.current.reopenTask(taskId);
        });

        // Un patch `undefined` serait supprimé par JSON.stringify (voir services/api.ts) et
        // ne viderait donc jamais ces champs côté serveur — seul `null` explicite le permet.
        expect(api.apiPut).toHaveBeenCalledWith(`/api/tasks/${taskId}`, expect.objectContaining({
            status: 'doing',
            reviewValidatedBy: null,
            reviewValidatedAt: null,
            reviewRejectedBy: null,
            reviewRejectedAt: null,
            rejectionComment: null,
        }), 'tok');
    });

    // Régression du point critique du brief de la tâche 5 : PUT /api/tasks/:id crée déjà les
    // AppNotifications de revue côté serveur (todox-backend, `createReviewNotifications`) —
    // ces 4 actions ne doivent plus en créer localement (elles le faisaient avant cette
    // tâche), sous peine de double notification. `fetchAppNotifications` (hors périmètre de
    // cette tâche) sera la seule source qui peuple `appNotifications` à l'avenir.
    // (On filtre sur les 3 types review_* spécifiquement, pas sur `appNotifications` en
    // entier : `requestCorrections` appelle légitimement `addComment`, qui crée de son côté
    // une notification `comment_added` pour les autres assignés — comportement inchangé,
    // sans rapport avec le bug de double notification visé ici, voir addComment.)
    it('setReviewers/validateTask/requestCorrections/reopenTask never create review_* AppNotifications locally (server creates them)', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => {
            await result.current.addTask({ title: 'Sans double notif', priority: 'med', status: 'review', assignedTo: ['alice', 'bob'] });
        });
        const taskId = result.current.tasks[0].id;
        const reviewNotifTypes = new Set(['review_requested', 'review_validated', 'review_rejected']);
        const countReviewNotifs = () => result.current.appNotifications.filter(n => reviewNotifTypes.has(n.type)).length;

        await act(async () => { await result.current.setReviewers(taskId, ['bob']); });
        expect(countReviewNotifs()).toBe(0);

        await act(async () => { await result.current.validateTask(taskId); });
        expect(countReviewNotifs()).toBe(0);

        await act(async () => { await result.current.reopenTask(taskId); });
        await act(async () => { await result.current.requestCorrections(taskId, 'Corrige ceci'); });
        expect(countReviewNotifs()).toBe(0);
    });
});

// ── convertSubtaskBack ─────────────────────────────────────────────────────

describe('convertSubtaskBack', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        act(() => {
            useStore.setState({
                tasks: [],
                users: [ALICE],
                projectHistory: [],
                collapsedProjects: {},
                currentUser: 'alice',
                appNotifications: [],
                authToken: 'tok',
            });
        });
        installDefaultApiMocks();
    });

    it('returns ok and re-adds the subtask to the parent', async () => {
        const { result } = renderHook(() => useStore());

        // Créer la tâche parente
        await act(async () => { await result.current.addTask({ title: 'Parent', priority: 'med' }); });
        const parentId = result.current.tasks[0].id;

        // Créer la tâche fille simulant une sous-tâche convertie (addTask uppercasse le titre)
        await act(async () => {
            await result.current.addTask({
                title: 'Sous-tâche convertie',
                priority: 'low',
                convertedFromSubtask: { parentTaskId: parentId, parentTaskTitle: 'PARENT' },
            });
        });
        const childId = result.current.tasks.find(t => t.title === 'SOUS-TÂCHE CONVERTIE')!.id;

        let returnValue: Awaited<ReturnType<typeof result.current.convertSubtaskBack>>;
        await act(async () => {
            returnValue = await result.current.convertSubtaskBack(childId);
        });

        expect(returnValue!).toBe('ok');

        // La tâche fille doit être soft-deleted
        const child = result.current.tasks.find(t => t.id === childId)!;
        expect(child.deletedAt).not.toBeNull();

        // La sous-tâche doit être rattachée au parent
        const parent = result.current.tasks.find(t => t.id === parentId)!;
        expect(parent.subtasks?.some(st => st.title === 'SOUS-TÂCHE CONVERTIE')).toBe(true);
    });

    it('returns parent_deleted when parent is archived (but not deleted)', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.addTask({ title: 'Parent archivé', priority: 'low' }); });
        const parentId = result.current.tasks[0].id;
        await act(async () => { await result.current.archiveTask(parentId); });

        await act(async () => {
            await result.current.addTask({
                title: 'Enfant',
                priority: 'low',
                convertedFromSubtask: { parentTaskId: parentId, parentTaskTitle: 'PARENT ARCHIVÉ' },
            });
        });
        const childId = result.current.tasks.find(t => t.title === 'ENFANT')!.id;

        let returnValue: Awaited<ReturnType<typeof result.current.convertSubtaskBack>>;
        await act(async () => {
            returnValue = await result.current.convertSubtaskBack(childId);
        });

        expect(returnValue!).toBe('parent_deleted');
    });

    it('returns parent_not_found when parent task does not exist', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => {
            await result.current.addTask({
                title: 'Orphelin',
                priority: 'low',
                convertedFromSubtask: { parentTaskId: 'inexistant-id', parentTaskTitle: 'Ghost' },
            });
        });
        const childId = result.current.tasks[0].id;

        let returnValue: Awaited<ReturnType<typeof result.current.convertSubtaskBack>>;
        await act(async () => { returnValue = await result.current.convertSubtaskBack(childId); });

        expect(returnValue!).toBe('parent_not_found');
    });

    it('returns parent_not_found when parent task is soft-deleted', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.addTask({ title: 'Parent supprimé', priority: 'low' }); });
        const parentId = result.current.tasks[0].id;
        await act(async () => { await result.current.removeTask(parentId); });

        await act(async () => {
            await result.current.addTask({
                title: 'Enfant orphelin',
                priority: 'low',
                convertedFromSubtask: { parentTaskId: parentId, parentTaskTitle: 'PARENT SUPPRIMÉ' },
            });
        });
        const childId = result.current.tasks.find(t => t.title === 'ENFANT ORPHELIN')!.id;

        let returnValue: Awaited<ReturnType<typeof result.current.convertSubtaskBack>>;
        await act(async () => { returnValue = await result.current.convertSubtaskBack(childId); });

        expect(returnValue!).toBe('parent_not_found');
    });

    it('returns parent_not_found when task has no convertedFromSubtask', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.addTask({ title: 'Tâche normale', priority: 'low' }); });
        const taskId = result.current.tasks[0].id;

        let returnValue: Awaited<ReturnType<typeof result.current.convertSubtaskBack>>;
        await act(async () => { returnValue = await result.current.convertSubtaskBack(taskId); });

        expect(returnValue!).toBe('parent_not_found');
    });

    // Régression du finding de review : addSubtask/removeTask sont maintenant de vrais appels
    // réseau (avant cette tâche, c'étaient des mutations locales synchrones qui ne pouvaient
    // jamais échouer) — si addSubtask réussit mais removeTask échoue ensuite, l'app se
    // retrouve avec la sous-tâche dupliquée sur le parent ET la tâche d'origine toujours
    // présente. Ce test prouve que cet état partiellement converti est réel et détectable
    // (via le retour 'error'), pas silencieusement empêché.
    it('returns error (without silently losing the failure) when removeTask fails after addSubtask already succeeded', async () => {
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.addTask({ title: 'Parent', priority: 'med' }); });
        const parentId = result.current.tasks[0].id;

        await act(async () => {
            await result.current.addTask({
                title: 'Enfant en échec',
                priority: 'low',
                convertedFromSubtask: { parentTaskId: parentId, parentTaskTitle: 'PARENT' },
            });
        });
        const childId = result.current.tasks.find(t => t.title === 'ENFANT EN ÉCHEC')!.id;

        // removeTask échoue (erreur réseau), après qu'addSubtask (mock par défaut) a réussi.
        vi.mocked(api.apiDelete).mockRejectedValue(new Error('network error'));

        let returnValue: Awaited<ReturnType<typeof result.current.convertSubtaskBack>>;
        await act(async () => {
            returnValue = await result.current.convertSubtaskBack(childId);
        });

        expect(returnValue!).toBe('error');

        // La sous-tâche A BIEN été ajoutée au parent (addSubtask a réussi) : l'état
        // partiellement converti est réel, pas empêché.
        expect(api.apiPost).toHaveBeenCalledWith(`/api/tasks/${parentId}/subtasks`, { title: 'ENFANT EN ÉCHEC' }, 'tok');
        const parent = result.current.tasks.find(t => t.id === parentId)!;
        expect(parent.subtasks?.some(st => st.title === 'ENFANT EN ÉCHEC')).toBe(true);

        // La tâche d'origine n'a PAS été soft-deleted (removeTask a échoué avant de mettre
        // à jour l'état local).
        const child = result.current.tasks.find(t => t.id === childId)!;
        expect(child.deletedAt).toBeNull();
    });
});

// ── Users via API ───────────────────────────────────────────────────────────

describe('users via API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useStore.setState({ authToken: 'tok', users: [] });
    });

    it('fetchUsers loads users from the API into the store', async () => {
        vi.mocked(api.apiGet).mockResolvedValue([
            { id: 'u1', email: 'a@b.com', name: 'A', role: 'member' },
        ]);
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.fetchUsers(); });

        expect(api.apiGet).toHaveBeenCalledWith('/api/users', 'tok');
        // fetchUsers passe par setUsers -> normalizeUsers, qui garantit toujours une entrée
        // "unassigned" (annuaire local, voir utils/users.ts) en plus des users reçus de l'API.
        expect(result.current.users).toEqual([
            { id: 'u1', email: 'a@b.com', name: 'A', role: 'member' },
            { id: 'unassigned', name: 'Non assigné', email: '' },
        ]);
    });

    it('createUser posts to the API and appends the result', async () => {
        vi.mocked(api.apiPost).mockResolvedValue({ id: 'u2', email: 'c@d.com', name: 'C', role: 'member' });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.createUser({ email: 'c@d.com', name: 'C', password: 'x' }); });

        expect(api.apiPost).toHaveBeenCalledWith('/api/users', { email: 'c@d.com', name: 'C', password: 'x' }, 'tok');
        expect(result.current.users.find(u => u.id === 'u2')).toBeTruthy();
    });
});

// ── Projects via API ────────────────────────────────────────────────────────

describe('projects via API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useStore.setState({ authToken: 'tok', directories: {}, projectHistory: [], projectColors: {} });
    });

    it('fetchProjects fans the API response into directories/projectHistory/projectColors', async () => {
        vi.mocked(api.apiGet).mockResolvedValue([
            { name: 'ACME', color: 2, directory: 'C:\\Acme', sortOrder: 0 },
            { name: 'BETA', color: null, directory: null, sortOrder: 1 },
        ]);
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.fetchProjects(); });

        expect(result.current.projectHistory).toEqual(['ACME', 'BETA']);
        expect(result.current.projectColors).toEqual({ ACME: 2 });
        expect(result.current.directories).toEqual({ ACME: 'C:\\Acme' });
    });

    it('setProjectColor calls PUT /api/projects/:name/color', async () => {
        vi.mocked(api.apiPut).mockResolvedValue({ ok: true });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.setProjectColor('ACME', 3); });

        expect(api.apiPut).toHaveBeenCalledWith('/api/projects/ACME/color', { color: 3 }, 'tok');
        expect(result.current.projectColors.ACME).toBe(3);
    });

    it('setProjectDirectory calls PUT /api/projects/:name/directory', async () => {
        vi.mocked(api.apiPut).mockResolvedValue({ ok: true });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.setProjectDirectory('ACME', 'C:\\Acme'); });

        expect(api.apiPut).toHaveBeenCalledWith('/api/projects/ACME/directory', { directory: 'C:\\Acme' }, 'tok');
        expect(result.current.directories.ACME).toBe('C:\\Acme');
    });

    it('removeProjectDirectory calls DELETE /api/projects/:name/directory', async () => {
        useStore.setState({ directories: { ACME: 'C:\\Acme' } });
        vi.mocked(api.apiDelete).mockResolvedValue(undefined);
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.removeProjectDirectory('ACME'); });

        expect(api.apiDelete).toHaveBeenCalledWith('/api/projects/ACME/directory', 'tok');
        expect(result.current.directories.ACME).toBeUndefined();
    });

    it('setProjectOrder calls PUT /api/projects/:name/order and repositions the project in projectHistory', async () => {
        useStore.setState({ projectHistory: ['ACME', 'BETA', 'GAMMA'] });
        vi.mocked(api.apiPut).mockResolvedValue({ ok: true });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.setProjectOrder('GAMMA', 0); });

        expect(api.apiPut).toHaveBeenCalledWith('/api/projects/GAMMA/order', { order: 0 }, 'tok');
        expect(result.current.projectHistory).toEqual(['GAMMA', 'ACME', 'BETA']);
    });
});

// ── Comments via API ────────────────────────────────────────────────────────

describe('comments via API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useStore.setState({ authToken: 'tok', comments: {}, currentUser: 'u1', users: [], tasks: [] });
    });

    it('fetchComments groups the flat bulk response by taskId', async () => {
        vi.mocked(api.apiGet).mockResolvedValue([
            { id: 'c1', taskId: 't1', userId: 'u1', text: 'A', createdAt: 1000, deletedAt: null },
            { id: 'c2', taskId: 't1', userId: 'u1', text: 'B', createdAt: 2000, deletedAt: null },
            { id: 'c3', taskId: 't2', userId: 'u1', text: 'C', createdAt: 3000, deletedAt: null },
        ]);
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.fetchComments(); });

        expect(api.apiGet).toHaveBeenCalledWith('/api/comments', 'tok');
        expect(result.current.comments.t1).toHaveLength(2);
        expect(result.current.comments.t2).toHaveLength(1);
    });

    it('addComment posts to /api/tasks/:taskId/comments and appends the server result', async () => {
        vi.mocked(api.apiPost).mockResolvedValue({ id: 'c9', taskId: 't1', userId: 'u1', text: 'Hi @bob', createdAt: 1000, deletedAt: null });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.addComment('t1', 'Hi @bob'); });

        expect(api.apiPost).toHaveBeenCalledWith('/api/tasks/t1/comments', { text: 'Hi @bob' }, 'tok');
        expect(result.current.comments.t1?.[0]?.id).toBe('c9');
    });

    it('addComment still notifies a mentioned user, using the server-assigned comment (not a locally-generated one)', async () => {
        useStore.setState({ users: [ALICE, BOB], appNotifications: [] });
        vi.mocked(api.apiPost).mockResolvedValue({ id: 'c9', taskId: 't1', userId: ALICE.id, text: `Hi @${BOB.name}`, createdAt: 1000, deletedAt: null });
        useStore.setState({ currentUser: ALICE.id });
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.addComment('t1', `Hi @${BOB.name}`); });

        const mentionNotifs = result.current.appNotifications.filter(n => n.type === 'comment_mention');
        expect(mentionNotifs).toHaveLength(1);
        expect(mentionNotifs[0].toUserId).toBe(BOB.id);
    });

    it('deleteComment calls DELETE /api/comments/:id', async () => {
        useStore.setState({ comments: { t1: [{ id: 'c1', taskId: 't1', userId: 'u1', text: 'A', createdAt: 1000, deletedAt: null } as any] } });
        vi.mocked(api.apiDelete).mockResolvedValue(undefined);
        const { result } = renderHook(() => useStore());

        await act(async () => { await result.current.deleteComment('t1', 'c1'); });

        expect(api.apiDelete).toHaveBeenCalledWith('/api/comments/c1', 'tok');
        expect(result.current.comments.t1[0].deletedAt).not.toBeNull();
    });
});

// ── Notifications via API ────────────────────────────────────────────────

describe('notifications via API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({ authToken: 'tok', appNotifications: [], currentUser: 'u1' });
  });

  it('fetchAppNotifications loads from GET /api/notifications', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: 'n1', type: 'review_requested', taskId: 't1', taskTitle: 'T', fromUserId: 'u2', toUserId: 'u1', message: 'M', createdAt: 1000, readAt: undefined }]);
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.fetchAppNotifications(); });

    expect(result.current.appNotifications).toHaveLength(1);
  });

  it('markNotificationRead calls PATCH /api/notifications/:id/read', async () => {
    useStore.setState({ appNotifications: [{ id: 'n1', readAt: undefined } as any] });
    vi.mocked(api.apiPatch).mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.markNotificationRead('n1'); });

    expect(api.apiPatch).toHaveBeenCalledWith('/api/notifications/n1/read', {}, 'tok');
    expect(result.current.appNotifications[0].readAt).toBeTruthy();
  });

  it('deleteNotificationForUser calls DELETE /api/notifications/:id and removes it locally', async () => {
    useStore.setState({ appNotifications: [{ id: 'n1' } as any] });
    vi.mocked(api.apiDelete).mockResolvedValue(undefined);
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.deleteNotificationForUser('n1', 'u1'); });

    expect(api.apiDelete).toHaveBeenCalledWith('/api/notifications/n1', 'tok');
    expect(result.current.appNotifications).toHaveLength(0);
  });

  it('fetchNotificationSettings loads from GET /api/notification-settings', async () => {
    vi.mocked(api.apiGet).mockResolvedValue({ enabled: true, checkInterval: 30, quietHoursStart: '20:00' });
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.fetchNotificationSettings(); });

    expect(result.current.notificationSettings.checkInterval).toBe(30);
  });

  it('updateNotificationSettings sends only the patch via PUT', async () => {
    vi.mocked(api.apiPut).mockResolvedValue({ checkInterval: 45 });
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.updateNotificationSettings({ checkInterval: 45 }); });

    expect(api.apiPut).toHaveBeenCalledWith('/api/notification-settings', { checkInterval: 45 }, 'tok');
  });

  it('markAllNotificationsRead calls PATCH /api/notifications/read-all and marks all user notifications as read', async () => {
    useStore.setState({
      appNotifications: [
        { id: 'n1', toUserId: 'u1', readAt: undefined } as any,
        { id: 'n2', toUserId: 'u1', readAt: undefined } as any,
        { id: 'n3', toUserId: 'u2', readAt: undefined } as any,
      ]
    });
    vi.mocked(api.apiPatch).mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.markAllNotificationsRead('u1'); });

    expect(api.apiPatch).toHaveBeenCalledWith('/api/notifications/read-all', {}, 'tok');
    expect(result.current.appNotifications[0].readAt).toBeTruthy(); // u1's first notification
    expect(result.current.appNotifications[1].readAt).toBeTruthy(); // u1's second notification
    expect(result.current.appNotifications[2].readAt).toBeUndefined(); // u2's notification unchanged
  });

  it('markNotificationsByTypeRead calls PATCH for each matching notification and marks them as read', async () => {
    useStore.setState({
      appNotifications: [
        { id: 'n1', type: 'review_requested', toUserId: 'u1', readAt: undefined } as any,
        { id: 'n2', type: 'review_validated', toUserId: 'u1', readAt: undefined } as any,
        { id: 'n3', type: 'review_requested', toUserId: 'u1', readAt: undefined } as any,
        { id: 'n4', type: 'comment_mention', toUserId: 'u2', readAt: undefined } as any,
      ]
    });
    vi.mocked(api.apiPatch).mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useStore());

    await act(async () => { await result.current.markNotificationsByTypeRead(['review_requested'], 'u1'); });

    // Should be called once for each matching notification (n1 and n3)
    expect(api.apiPatch).toHaveBeenCalledTimes(2);
    expect(api.apiPatch).toHaveBeenCalledWith('/api/notifications/n1/read', {}, 'tok');
    expect(api.apiPatch).toHaveBeenCalledWith('/api/notifications/n3/read', {}, 'tok');
    // Only matching notifications should be marked as read
    expect(result.current.appNotifications[0].readAt).toBeTruthy(); // n1 matched
    expect(result.current.appNotifications[1].readAt).toBeUndefined(); // n2 different type
    expect(result.current.appNotifications[2].readAt).toBeTruthy(); // n3 matched
    expect(result.current.appNotifications[3].readAt).toBeUndefined(); // n4 different user
  });
});
