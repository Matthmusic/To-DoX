// Sous-ensemble des types de src/types.ts (app To-DoX) utilisé par le serveur MCP.
// Dupliqué volontairement : le serveur MCP est un paquet Node indépendant de l'app.

export type TaskStatus = 'todo' | 'doing' | 'review' | 'done';
export type TaskPriority = 'low' | 'med' | 'high';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'admin' | 'member';
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  completedAt: number | null;
  completedBy: string | null;
  assignedTo?: string[];
  startDate?: string | null;
  endDate?: string | null;
}

export interface Recurrence {
  type: 'daily' | 'weekly' | 'monthly';
  endsAt?: number;
}

export interface Task {
  id: string;
  title: string;
  project: string;
  due: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  createdBy: string;
  assignedTo: string[];
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  notes: string;
  archived: boolean;
  archivedAt: number | null;
  subtasks: Subtask[];
  favorite: boolean;
  deletedAt: number | null;
  order?: number;
  recurrence?: Recurrence;
  reviewers?: string[];
  reviewValidatedBy?: string;
  reviewValidatedAt?: number;
  reviewRejectedBy?: string;
  reviewRejectedAt?: number;
  rejectionComment?: string;
  movedToReviewBy?: string;
  movedToReviewAt?: number;
  parentTaskId?: string | null;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  text: string;
  createdAt: number;
  deletedAt: number | null;
}

export interface TimeEntry {
  id: string;
  project: string;
  date: string;
  hours: number;
  userId: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  name: string;
  color: number | null;
  directory: string | null;
  sortOrder: number;
}

export interface AppNotification {
  id: string;
  type: string;
  taskId: string;
  taskTitle: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  createdAt: number;
  readAt?: number;
}
