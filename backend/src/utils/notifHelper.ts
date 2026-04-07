import { PrismaClient } from '@prisma/client';
import { sseManager } from '../sse/sseManager';

interface CreateNotifParams {
  prisma: PrismaClient;
  type: string;
  taskId: string;
  taskTitle: string;
  fromUserId: string;
  toUserId: string;
  message: string;
}

/** Crée une notification en DB et la diffuse via SSE au destinataire. */
export async function createNotif({
  prisma, type, taskId, taskTitle, fromUserId, toUserId, message,
}: CreateNotifParams): Promise<void> {
  const notif = await prisma.appNotification.create({
    data: { type, taskId, taskTitle, fromUserId, toUserId, message },
  });

  sseManager.broadcast('notification:new', {
    notification: {
      id: notif.id,
      type: notif.type,
      taskId: notif.taskId,
      taskTitle: notif.taskTitle,
      fromUserId: notif.fromUserId,
      toUserId: notif.toUserId,
      message: notif.message,
      createdAt: new Date(notif.createdAt).getTime(),
      readAt: undefined,
      deletedBy: [],
    },
    toUserId: notif.toUserId,
  });
}

/** Normalise une task Prisma vers le format frontend (timestamps ms, enums lowercase). */
export function normalizeTaskForClient(task: any): any {
  return {
    ...task,
    priority: (task.priority as string)?.toLowerCase(),
    status:   (task.status   as string)?.toLowerCase(),
    createdAt:  task.createdAt  ? new Date(task.createdAt).getTime()  : null,
    updatedAt:  task.updatedAt  ? new Date(task.updatedAt).getTime()  : null,
    completedAt: task.completedAt ? new Date(task.completedAt).getTime() : null,
    archivedAt:  task.archivedAt  ? new Date(task.archivedAt).getTime()  : null,
    reviewValidatedAt: task.reviewValidatedAt ? new Date(task.reviewValidatedAt).getTime() : undefined,
    reviewRejectedAt:  task.reviewRejectedAt  ? new Date(task.reviewRejectedAt).getTime()  : undefined,
    movedToReviewAt:   task.movedToReviewAt   ? new Date(task.movedToReviewAt).getTime()   : undefined,
  };
}

/** Crée la prochaine occurrence d'une tâche récurrente (logique identique au store frontend). */
export function buildNextRecurringTask(task: any, createdById: string): any | null {
  const recurrence = task.recurrence as { type: string; endsAt?: number } | null;
  if (!recurrence) return null;
  if (recurrence.endsAt && Date.now() >= recurrence.endsAt) return null;

  const baseDate = task.due ? new Date(task.due) : new Date();
  const nextDate = new Date(baseDate);
  if (recurrence.type === 'daily')   nextDate.setDate(nextDate.getDate() + 1);
  else if (recurrence.type === 'weekly')  nextDate.setDate(nextDate.getDate() + 7);
  else if (recurrence.type === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);

  return {
    title:       task.title,
    project:     task.project,
    due:         nextDate.toISOString().split('T')[0],
    priority:    task.priority,
    status:      'TODO',
    notes:       task.notes,
    assignedTo:  task.assignedTo,
    reviewers:   task.reviewers,
    subtasks:    (task.subtasks as any[]).map((st: any) => ({ ...st, completed: false, completedAt: null })),
    ganttDays:   task.ganttDays,
    recurrence:  task.recurrence,
    order:       0,
    createdById,
  };
}
