import { describe, it, expect } from 'vitest';
import { migrateTask, mergeTasksByUpdatedAt } from './taskMigration';
import type { Task } from '../types';

describe('migrateTask', () => {
    const opts = { fallbackUser: 'matthieu' };

    it('should produce a valid Task from an empty object', () => {
        const task = migrateTask({}, opts);
        expect(task.id).toBeDefined();
        expect(task.title).toBe('Sans titre');
        expect(task.project).toBe('DIVERS');
        expect(task.status).toBe('todo');
        expect(task.priority).toBe('med');
        expect(task.createdBy).toBe('matthieu');
        expect(task.assignedTo).toEqual(['matthieu']);
        expect(task.archived).toBe(false);
        expect(task.deletedAt).toBeNull();
        expect(task.subtasks).toEqual([]);
    });

    it('should preserve existing valid fields', () => {
        const raw = {
            id: 'abc-123',
            title: 'Ma tâche',
            project: 'ALPHA',
            status: 'doing',
            priority: 'high',
            createdBy: 'william',
            assignedTo: ['william', 'matteo'],
            createdAt: 1000,
            updatedAt: 2000,
            completedAt: null,
            archived: false,
            archivedAt: null,
            deletedAt: null,
            notes: 'quelques notes',
            subtasks: [],
            favorite: true,
        };

        const task = migrateTask(raw, opts);
        expect(task.id).toBe('abc-123');
        expect(task.title).toBe('Ma tâche');
        expect(task.project).toBe('ALPHA');
        expect(task.status).toBe('doing');
        expect(task.priority).toBe('high');
        expect(task.createdBy).toBe('william');
        expect(task.assignedTo).toEqual(['william', 'matteo']);
        expect(task.favorite).toBe(true);
    });

    it('should set completedAt = updatedAt if status is done but completedAt is missing', () => {
        const raw = { status: 'done', updatedAt: 5000 };
        const task = migrateTask(raw, opts);
        expect(task.completedAt).toBe(5000);
    });

    it('should preserve an explicit completedAt when status is done', () => {
        const raw = { status: 'done', updatedAt: 5000, completedAt: 3000 };
        const task = migrateTask(raw, opts);
        expect(task.completedAt).toBe(3000);
    });

    it('should migrate createdBy=unassigned to fallbackUser', () => {
        const raw = { createdBy: 'unassigned', assignedTo: ['unassigned'] };
        const task = migrateTask(raw, opts);
        expect(task.createdBy).toBe('matthieu');
        expect(task.assignedTo).toEqual(['matthieu']);
    });

    it('should not overwrite assignedTo if it already has a real user', () => {
        const raw = { createdBy: 'unassigned', assignedTo: ['william'] };
        const task = migrateTask(raw, opts);
        expect(task.createdBy).toBe('matthieu');
        expect(task.assignedTo).toEqual(['william']);
    });

    it('should preserve deletedAt when present', () => {
        const raw = { deletedAt: 9999 };
        const task = migrateTask(raw, opts);
        expect(task.deletedAt).toBe(9999);
    });

    it('should normalize subtasks and add missing ids', () => {
        const raw = {
            subtasks: [
                { title: 'Sub 1', completed: true, createdAt: 100 },
                { id: 'sub-2', title: 'Sub 2', completed: false, createdAt: 200, completedAt: null },
            ]
        };
        const task = migrateTask(raw, opts);
        expect(task.subtasks).toHaveLength(2);
        expect(task.subtasks[0].id).toBeDefined();
        expect(task.subtasks[0].completed).toBe(true);
        expect(task.subtasks[1].id).toBe('sub-2');
    });

    it('should handle non-object input gracefully', () => {
        const task = migrateTask(null, opts);
        expect(task.title).toBe('Sans titre');
        expect(task.status).toBe('todo');
    });
});

describe('mergeTasksByUpdatedAt', () => {
    const makeTask = (id: string, updatedAt: number, overrides: Partial<Task> = {}): Task => ({
        id,
        title: `Task ${id}`,
        project: 'TEST',
        due: null,
        priority: 'med',
        status: 'todo',
        createdBy: 'matthieu',
        assignedTo: ['matthieu'],
        createdAt: 1000,
        updatedAt,
        completedAt: null,
        notes: '',
        archived: false,
        archivedAt: null,
        subtasks: [],
        favorite: false,
        deletedAt: null,
        ...overrides,
    });

    it('should keep all tasks when there is no overlap', () => {
        const existing = [makeTask('a', 1000)];
        const incoming = [makeTask('b', 2000)];
        const merged = mergeTasksByUpdatedAt(existing, incoming);
        expect(merged).toHaveLength(2);
    });

    it('should pick the version with higher updatedAt on overlap', () => {
        const existing = [makeTask('a', 1000, { title: 'Old' })];
        const incoming = [makeTask('a', 2000, { title: 'New' })];
        const merged = mergeTasksByUpdatedAt(existing, incoming);
        expect(merged).toHaveLength(1);
        expect(merged[0].title).toBe('New');
    });

    it('should keep existing when incoming has lower updatedAt', () => {
        const existing = [makeTask('a', 3000, { title: 'Kept' })];
        const incoming = [makeTask('a', 1000, { title: 'Discarded' })];
        const merged = mergeTasksByUpdatedAt(existing, incoming);
        expect(merged[0].title).toBe('Kept');
    });

    it('should propagate soft-delete: deleted version wins if newer', () => {
        const existing = [makeTask('a', 1000, { title: 'Alive' })];
        const incoming = [makeTask('a', 2000, { deletedAt: 2000 })];
        const merged = mergeTasksByUpdatedAt(existing, incoming);
        expect(merged).toHaveLength(1);
        expect(merged[0].deletedAt).toBe(2000);
    });

    it('should not resurrect a task if delete is newer than the live version', () => {
        const existing = [makeTask('a', 2000, { deletedAt: 2000 })];
        const incoming = [makeTask('a', 1000, { deletedAt: null })];
        const merged = mergeTasksByUpdatedAt(existing, incoming);
        expect(merged[0].deletedAt).toBe(2000);
    });

    it('should handle empty arrays', () => {
        expect(mergeTasksByUpdatedAt([], [])).toHaveLength(0);
        expect(mergeTasksByUpdatedAt([makeTask('a', 1000)], [])).toHaveLength(1);
        expect(mergeTasksByUpdatedAt([], [makeTask('a', 1000)])).toHaveLength(1);
    });
});
