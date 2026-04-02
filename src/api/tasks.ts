import { apiFetch } from './client';
import type { Task, TimeEntry } from '../types';

// ── Tâches ────────────────────────────────────────────────────────────────────

export async function apiGetTasks(): Promise<Task[]> {
  const rows = await apiFetch<any[]>('/api/tasks');
  return rows.map(normalizeTask);
}

export async function apiCreateTask(task: Task): Promise<Task> {
  const row = await apiFetch<any>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(taskToApi(task)),
  });
  return normalizeTask(row);
}

export async function apiUpdateTask(id: string, patch: Partial<Task>): Promise<Task> {
  const row = await apiFetch<any>(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(taskToApi(patch as Task)),
  });
  return normalizeTask(row);
}

// ── Time entries ──────────────────────────────────────────────────────────────

export async function apiGetTimeEntries(): Promise<TimeEntry[]> {
  const rows = await apiFetch<any[]>('/api/time-entries');
  return rows.map(normalizeTimeEntry);
}

export async function apiCreateTimeEntry(e: TimeEntry): Promise<TimeEntry> {
  const row = await apiFetch<any>('/api/time-entries', {
    method: 'POST',
    body: JSON.stringify({ project: e.project, date: e.date, hours: e.hours, note: e.note }),
  });
  return normalizeTimeEntry(row);
}

export async function apiUpdateTimeEntry(id: string, patch: Partial<TimeEntry>): Promise<TimeEntry> {
  const row = await apiFetch<any>(`/api/time-entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  return normalizeTimeEntry(row);
}

export async function apiDeleteTimeEntry(id: string): Promise<void> {
  await apiFetch(`/api/time-entries/${id}`, { method: 'DELETE' });
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function apiGetSetting<T>(key: string): Promise<T | null> {
  return apiFetch<T | null>(`/api/settings/${key}`);
}

export async function apiPutSetting(key: string, value: unknown): Promise<void> {
  await apiFetch(`/api/settings/${key}`, {
    method: 'PUT',
    body: JSON.stringify(value),
  });
}

// ── Normalization helpers ─────────────────────────────────────────────────────

/** API uses ISO dates + enum uppercase → frontend expects timestamps + lowercase */
function normalizeTask(row: any): Task {
  return {
    ...row,
    priority: (row.priority as string)?.toLowerCase() as Task['priority'],
    status:   (row.status   as string)?.toLowerCase() as Task['status'],
    createdAt:  row.createdAt  ? new Date(row.createdAt).getTime()  : Date.now(),
    updatedAt:  row.updatedAt  ? new Date(row.updatedAt).getTime()  : Date.now(),
    completedAt: row.completedAt ? new Date(row.completedAt).getTime() : null,
    archivedAt:  row.archivedAt  ? new Date(row.archivedAt).getTime()  : null,
    deletedAt:   row.deletedAt   ? new Date(row.deletedAt).getTime()   : null,
    reviewValidatedAt: row.reviewValidatedAt ? new Date(row.reviewValidatedAt).getTime() : undefined,
    reviewRejectedAt:  row.reviewRejectedAt  ? new Date(row.reviewRejectedAt).getTime()  : undefined,
    movedToReviewAt:   row.movedToReviewAt   ? new Date(row.movedToReviewAt).getTime()   : undefined,
    subtasks: row.subtasks ?? [],
    ganttDays: row.ganttDays ?? [],
    assignedTo: row.assignedTo ?? [],
    reviewers: row.reviewers ?? [],
    notes: row.notes ?? '',
  };
}

/** Frontend timestamps + lowercase enums → API ISO dates + uppercase enums */
function taskToApi(task: Partial<Task>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...task };
  if (task.priority) out.priority = task.priority.toUpperCase();
  if (task.status)   out.status   = task.status.toUpperCase();
  if (typeof task.createdAt  === 'number') out.createdAt  = new Date(task.createdAt).toISOString();
  if (typeof task.updatedAt  === 'number') out.updatedAt  = new Date(task.updatedAt).toISOString();
  if (typeof task.completedAt === 'number') out.completedAt = new Date(task.completedAt).toISOString();
  if (typeof task.archivedAt  === 'number') out.archivedAt  = new Date(task.archivedAt).toISOString();
  if (typeof task.deletedAt   === 'number') out.deletedAt   = new Date(task.deletedAt).toISOString();
  return out;
}

function normalizeTimeEntry(row: any): TimeEntry {
  return {
    id:        row.id,
    project:   row.project,
    date:      row.date,
    hours:     row.hours,
    userId:    row.userId,
    note:      row.note ?? undefined,
    createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).getTime() : Date.now(),
  };
}
