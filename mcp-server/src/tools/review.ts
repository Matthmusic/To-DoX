import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TodoxClient } from '../api.js';
import { resolveUser, summarizeTask, userName } from '../helpers.js';
import type { AppNotification, Comment } from '../types.js';
import { fetchTask, fetchTasks, ok, safe } from './common.js';
import { putTask } from './tasks.js';

// Workflow de révision : mêmes effets que setReviewers / validateTask /
// requestCorrections dans src/store/useStore.ts. Les notifications in-app sont
// créées par le backend lors du PUT (changement de reviewers / validation / rejet).

export function registerReviewTools(server: McpServer, client: TodoxClient) {
  server.registerTool(
    'set_reviewers',
    {
      title: 'Désigner les réviseurs',
      description:
        'Désigne les réviseurs d\'une tâche (ils sont aussi ajoutés aux personnes affectées et reçoivent une notification). ' +
        'submit=true passe aussi la tâche en révision.',
      inputSchema: {
        taskId: z.string(),
        reviewers: z.array(z.string()).min(1).describe('"me", id, email ou nom'),
        submit: z.boolean().optional().describe('Passer aussi la tâche au statut "review"'),
      },
    },
    safe(async ({ taskId, reviewers, submit }) => {
      const [task, users, me] = await Promise.all([fetchTask(client, taskId), client.users(), client.currentUser()]);
      const reviewerIds = [...new Set(reviewers.map((r) => resolveUser(r, users, me).id))];
      const base = task.assignedTo.filter((id) => id !== 'unassigned');
      const extra = reviewerIds.filter((id) => !task.assignedTo.includes(id));
      const patch: Record<string, unknown> = {
        reviewers: reviewerIds,
        assignedTo: extra.length ? [...base, ...extra] : task.assignedTo,
      };
      if (submit) patch.status = 'review';
      const { updated } = await putTask(client, task, patch);
      return ok({ updated: summarizeTask(updated, users) });
    })
  );

  server.registerTool(
    'validate_task',
    {
      title: 'Valider une révision',
      description: 'Valide une tâche en révision : elle passe en "done" (Terminé).',
      inputSchema: { taskId: z.string() },
    },
    safe(async ({ taskId }) => {
      const [task, me] = await Promise.all([fetchTask(client, taskId), client.currentUser()]);
      const { updated, nextOccurrence } = await putTask(client, task, {
        status: 'done',
        reviewValidatedBy: me.id,
        reviewValidatedAt: Date.now(),
      });
      const users = await client.users();
      return ok({
        updated: summarizeTask(updated, users),
        ...(nextOccurrence ? { nextOccurrence: summarizeTask(nextOccurrence, users) } : {}),
      });
    })
  );

  server.registerTool(
    'request_corrections',
    {
      title: 'Demander des corrections',
      description: 'Renvoie une tâche en "doing" avec un commentaire de correction (ajouté au fil de commentaires).',
      inputSchema: { taskId: z.string(), comment: z.string().min(1) },
    },
    safe(async ({ taskId, comment }) => {
      const [task, me] = await Promise.all([fetchTask(client, taskId), client.currentUser()]);
      const { updated } = await putTask(client, task, {
        status: 'doing',
        reviewRejectedBy: me.id,
        reviewRejectedAt: Date.now(),
        rejectionComment: comment,
      });
      await client.post<Comment>(`/api/tasks/${taskId}/comments`, { text: `↩️ Corrections demandées : ${comment}` });
      return ok({ updated: summarizeTask(updated, await client.users()) });
    })
  );

  server.registerTool(
    'list_my_reviews',
    {
      title: 'Mes révisions en attente',
      description: 'Tâches en révision dont je suis réviseur, et tâches que j\'ai soumises en révision.',
      annotations: { readOnlyHint: true },
    },
    safe(async () => {
      const [tasks, users, me] = await Promise.all([fetchTasks(client), client.users(), client.currentUser()]);
      const inReview = tasks.filter((t) => t.status === 'review' && !t.archived);
      return ok({
        toReview: inReview.filter((t) => t.reviewers?.includes(me.id)).map((t) => summarizeTask(t, users)),
        submittedByMe: inReview
          .filter((t) => t.movedToReviewBy === me.id)
          .map((t) => summarizeTask(t, users)),
      });
    })
  );

  server.registerTool(
    'list_notifications',
    {
      title: 'Notifications',
      description: 'Notifications To-DoX (révisions, mentions, commentaires). markRead=true les marque toutes comme lues.',
      inputSchema: {
        unreadOnly: z.boolean().optional().describe('Défaut true'),
        markRead: z.boolean().optional(),
      },
    },
    safe(async ({ unreadOnly = true, markRead }) => {
      const [notifs, users, me] = await Promise.all([
        client.get<AppNotification[]>('/api/notifications'),
        client.users(),
        client.currentUser(),
      ]);
      const mine = notifs
        .filter((n) => n.toUserId === me.id && (!unreadOnly || !n.readAt))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((n) => ({
          type: n.type,
          taskId: n.taskId,
          taskTitle: n.taskTitle,
          from: userName(n.fromUserId, users),
          message: n.message,
          at: new Date(n.createdAt).toISOString(),
          read: Boolean(n.readAt),
        }));
      if (markRead) await client.patch('/api/notifications/read-all', {});
      return ok({ count: mine.length, notifications: mine });
    })
  );
}
