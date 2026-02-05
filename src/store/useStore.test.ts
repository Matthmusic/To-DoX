import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useStore from './useStore';

describe('useStore', () => {
    beforeEach(() => {
        const { setState } = useStore;
        act(() => {
            setState({
                tasks: [],
                users: [],
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
        expect(result.current.tasks[0]).toMatchObject({
            title: 'Test Task',
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
        expect(updatedTask?.title).toBe('Updated Title');
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
