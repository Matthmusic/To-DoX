import type { Task, Subtask, GanttDay } from '../types';
import { uid } from '../utils';

export interface MigrationOptions {
  fallbackUser: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStatus = (value: unknown): value is Task['status'] =>
  value === 'todo' || value === 'doing' || value === 'review' || value === 'done';

const isPriority = (value: unknown): value is Task['priority'] =>
  value === 'low' || value === 'med' || value === 'high';

const toNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const toString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim().length > 0 ? value : fallback;

const toBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const normalizeAssignedTo = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }
  if (typeof value === 'string' && value.length > 0) return [value];
  return [];
};

const normalizeGanttDays = (value: unknown): GanttDay[] => {
  if (!Array.isArray(value)) return [];
  const days: GanttDay[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.length > 0) {
      // Migration depuis l'ancien format string[]
      days.push({ date: item });
    } else if (isRecord(item) && typeof item.date === 'string' && item.date.length > 0) {
      // Collecter les userIds depuis l'ancien userId (string) ou le nouveau userIds (string[])
      const userIds: string[] = [];
      if (typeof item.userId === 'string' && item.userId.length > 0) {
        userIds.push(item.userId); // migration ancienne version mono-utilisateur
      }
      if (Array.isArray(item.userIds)) {
        for (const uid of item.userIds) {
          if (typeof uid === 'string' && uid.length > 0 && !userIds.includes(uid)) {
            userIds.push(uid);
          }
        }
      }
      days.push({
        date: item.date,
        userIds: userIds.length > 0 ? userIds : undefined,
      });
    }
  }
  return days;
};

const normalizeSubtasks = (value: unknown): Subtask[] => {
  if (!Array.isArray(value)) return [];
  const subtasks: Subtask[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    subtasks.push({
      id: typeof item.id === 'string' ? item.id : uid(),
      title: toString(item.title, 'Sans titre'),
      completed: toBoolean(item.completed, false),
      createdAt: toNumber(item.createdAt, Date.now()),
      completedAt: typeof item.completedAt === 'number' ? item.completedAt : null,
    });
  }

  return subtasks;
};

export function migrateTask(raw: unknown, options: MigrationOptions): Task {
  const data = isRecord(raw) ? raw : {};

  const status = isStatus(data.status) ? data.status : 'todo';
  const updatedAt = toNumber(data.updatedAt, Date.now());
  const completedAtRaw = typeof data.completedAt === 'number' ? data.completedAt : null;
  const completedAt = status === 'done' && completedAtRaw === null ? updatedAt : completedAtRaw;

  const rawAssignedTo = normalizeAssignedTo(data.assignedTo);
  const hasRealAssignee = rawAssignedTo.some((id) => id !== 'unassigned');
  const createdBy = typeof data.createdBy === 'string' ? data.createdBy : null;
  const needsMigration = !createdBy || createdBy === 'unassigned';
  const fallbackUser = options.fallbackUser;

  return {
    id: typeof data.id === 'string' ? data.id : uid(),
    title: toString(data.title, 'Sans titre').toUpperCase(),
    project: toString(data.project, 'DIVERS'),
    due: typeof data.due === 'string' || data.due === null ? data.due : null,
    priority: isPriority(data.priority) ? data.priority : 'med',
    status,
    createdBy: (needsMigration && fallbackUser) ? fallbackUser : (createdBy || 'unassigned'),
    assignedTo: (needsMigration && !hasRealAssignee && fallbackUser) ? [fallbackUser] : rawAssignedTo,
    createdAt: toNumber(data.createdAt, updatedAt),
    updatedAt,
    completedAt,
    notes: toString(data.notes, ''),
    archived: toBoolean(data.archived, false),
    archivedAt: typeof data.archivedAt === 'number' ? data.archivedAt : null,
    subtasks: normalizeSubtasks(data.subtasks),
    favorite: toBoolean(data.favorite, false),
    deletedAt: typeof data.deletedAt === 'number' ? data.deletedAt : null,
    ganttDays: normalizeGanttDays(data.ganttDays),
  };
}

export function mergeTasksByUpdatedAt(existing: Task[], incoming: Task[]): Task[] {
  const map = new Map<string, Task>();
  existing.forEach((t) => map.set(t.id, t));
  incoming.forEach((t) => {
    const current = map.get(t.id);
    if (!current || t.updatedAt >= current.updatedAt) {
      map.set(t.id, t);
    }
  });
  return Array.from(map.values());
}
