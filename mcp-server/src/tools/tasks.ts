import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TodoxClient } from '../api.js';
import { ISO_DATE, nextRecurrenceDue, resolveUser, summarizeTask, todayISO, userName } from '../helpers.js';
import type { Comment, Project, Subtask, Task } from '../types.js';
import { fetchTask, fetchTasks, ok, safe } from './common.js';

const status = z.enum(['todo', 'doing', 'review', 'done']);
const priority = z.enum(['low', 'med', 'high']);
const isoDate = z.string().regex(ISO_DATE, 'Format attendu : YYYY-MM-DD');
const userRefs = z
  .array(z.string())
  .describe('Utilisateurs : "me", id, email ou nom (ex: ["me", "Julie"])');

async function resolveUserIds(client: TodoxClient, refs: string[]): Promise<string[]> {
  const [users, me] = await Promise.all([client.users(), client.currentUser()]);
  return [...new Set(refs.map((r) => resolveUser(r, users, me).id))];
}

/**
 * PUT /api/tasks/:id avec les mêmes effets de bord que updateTask() côté app :
 * horodatage du passage en révision, et création de l'occurrence suivante
 * d'une tâche récurrente qui passe en "done".
 */
export async function putTask(client: TodoxClient, before: Task, patch: Record<string, unknown>) {
  const me = await client.currentUser();
  const outgoing: Record<string, unknown> = { ...patch };
  if (typeof patch.title === 'string') outgoing.title = patch.title.trim().toUpperCase();
  if (patch.status === 'review' && before.status !== 'review') {
    outgoing.movedToReviewBy = me.id;
    outgoing.movedToReviewAt = Date.now();
  }

  const updated = await client.put<Task>(`/api/tasks/${before.id}`, outgoing);

  let nextOccurrence: Task | null = null;
  if (patch.status === 'done' && before.status !== 'done') {
    const nextDue = nextRecurrenceDue(before);
    if (nextDue) {
      nextOccurrence = await client.post<Task>('/api/tasks', {
        title: before.title,
        project: before.project,
        status: 'todo',
        priority: before.priority,
        due: nextDue,
        notes: before.notes,
        assignedTo: before.assignedTo,
        favorite: before.favorite,
        order: before.order,
        parentTaskId: before.parentTaskId ?? null,
        recurrence: before.recurrence,
      });
      for (const st of before.subtasks ?? []) {
        await client.post<Subtask>(`/api/tasks/${nextOccurrence.id}/subtasks`, { title: st.title });
      }
    }
  }
  return { updated, nextOccurrence };
}

export function registerTaskTools(server: McpServer, client: TodoxClient) {
  server.registerTool(
    'whoami',
    {
      title: 'Utilisateur connecté',
      description: "Renvoie l'utilisateur To-DoX au nom duquel le MCP agit, et la date du jour.",
      annotations: { readOnlyHint: true },
    },
    safe(async () => ok({ user: await client.currentUser(), today: todayISO(), server: client.baseUrl }))
  );

  server.registerTool(
    'list_users',
    {
      title: 'Annuaire',
      description: "Liste les utilisateurs de l'organisation (id, nom, email).",
      annotations: { readOnlyHint: true },
    },
    safe(async () => ok(await client.users()))
  );

  server.registerTool(
    'list_projects',
    {
      title: 'Projets',
      description:
        'Liste les projets (noms en MAJUSCULES) avec le nombre de tâches actives par statut. ' +
        'À utiliser pour retrouver le nom exact d\'un projet avant de créer une tâche ou de pointer des heures.',
      inputSchema: { includeArchived: z.boolean().optional().describe('Inclure les projets dont toutes les tâches sont archivées') },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ includeArchived }) => {
      const [projects, tasks] = await Promise.all([client.get<Project[]>('/api/projects'), fetchTasks(client)]);
      const stats: Record<string, Record<string, number>> = {};
      for (const p of projects) stats[p.name] = {};
      for (const t of tasks) {
        stats[t.project] ??= {};
        const key = t.archived ? 'archived' : t.status;
        stats[t.project][key] = (stats[t.project][key] ?? 0) + 1;
      }
      const rows = Object.entries(stats)
        .map(([name, counts]) => ({ name, ...counts }))
        .filter((r) => includeArchived || Object.keys(r).some((k) => k !== 'name' && k !== 'archived'))
        .sort((a, b) => a.name.localeCompare(b.name));
      return ok(rows);
    })
  );

  server.registerTool(
    'list_tasks',
    {
      title: 'Lister les tâches',
      description:
        'Liste les tâches du Kanban avec filtres. Par défaut : tâches non terminées et non archivées. ' +
        'Statuts : todo (À faire), doing (En cours), review (En révision), done (Terminé).',
      inputSchema: {
        status: z.array(status).optional().describe('Filtrer par statut(s). Défaut : todo, doing, review'),
        project: z.string().optional().describe('Nom du projet (insensible à la casse)'),
        assignedTo: z.string().optional().describe('"me", id, email ou nom'),
        search: z.string().optional().describe('Texte recherché dans le titre et les notes'),
        dueBefore: isoDate.optional().describe('Échéance au plus tard le (inclus)'),
        includeArchived: z.boolean().optional(),
        limit: z.number().int().min(1).max(500).optional().describe('Défaut 100'),
      },
      annotations: { readOnlyHint: true },
    },
    safe(async (a) => {
      const [tasks, users, me] = await Promise.all([fetchTasks(client), client.users(), client.currentUser()]);
      const statuses = a.status ?? ['todo', 'doing', 'review'];
      const userId = a.assignedTo ? resolveUser(a.assignedTo, users, me).id : null;
      const q = a.search?.toLowerCase();
      const filtered = tasks
        .filter((t) => a.includeArchived || !t.archived)
        .filter((t) => statuses.includes(t.status))
        .filter((t) => !a.project || t.project.toLowerCase() === a.project.toLowerCase())
        .filter((t) => !userId || t.assignedTo.includes(userId))
        .filter((t) => !q || t.title.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q))
        .filter((t) => !a.dueBefore || (t.due !== null && t.due <= a.dueBefore))
        .sort((x, y) => (x.due ?? '9999').localeCompare(y.due ?? '9999'));
      const limit = a.limit ?? 100;
      return ok({
        count: filtered.length,
        ...(filtered.length > limit ? { truncated: true } : {}),
        tasks: filtered.slice(0, limit).map((t) => summarizeTask(t, users)),
      });
    })
  );

  server.registerTool(
    'get_task',
    {
      title: 'Détail d\'une tâche',
      description: 'Détail complet d\'une tâche : notes, sous-tâches (avec leurs id), réviseurs, commentaires.',
      inputSchema: { taskId: z.string() },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ taskId }) => {
      const [task, users, comments] = await Promise.all([
        fetchTask(client, taskId),
        client.users(),
        client.get<Comment[]>('/api/comments'),
      ]);
      const name = (id: string | undefined) => (id ? userName(id, users) : undefined);
      return ok({
        ...summarizeTask(task, users),
        notes: task.notes,
        createdBy: name(task.createdBy),
        createdAt: new Date(task.createdAt).toISOString(),
        completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : null,
        parentTaskId: task.parentTaskId ?? null,
        rejectionComment: task.rejectionComment,
        subtasks: (task.subtasks ?? []).map((s) => ({
          id: s.id,
          title: s.title,
          completed: s.completed,
          ...(s.assignedTo?.length ? { assignedTo: s.assignedTo.map((id) => userName(id, users)) } : {}),
        })),
        comments: comments
          .filter((c) => c.taskId === task.id && !c.deletedAt)
          .sort((x, y) => x.createdAt - y.createdAt)
          .map((c) => ({ author: name(c.userId), at: new Date(c.createdAt).toISOString(), text: c.text })),
      });
    })
  );

  server.registerTool(
    'create_task',
    {
      title: 'Créer une tâche',
      description:
        'Crée une tâche dans le Kanban. Titre et projet sont mis en MAJUSCULES (convention To-DoX). ' +
        'Par défaut : projet DIVERS, échéance aujourd\'hui, priorité med, statut todo, assignée à moi.',
      inputSchema: {
        title: z.string().min(1),
        project: z.string().optional(),
        due: isoDate.optional(),
        priority: priority.optional(),
        status: status.optional(),
        assignedTo: userRefs.optional(),
        notes: z.string().optional(),
        subtasks: z.array(z.string()).optional().describe('Titres de sous-tâches à créer'),
        recurrence: z.enum(['daily', 'weekly', 'monthly']).optional(),
      },
    },
    safe(async (a) => {
      const me = await client.currentUser();
      const assignedTo = a.assignedTo?.length ? await resolveUserIds(client, a.assignedTo) : [me.id];
      const created = await client.post<Task>('/api/tasks', {
        title: a.title.trim().toUpperCase(),
        project: (a.project?.trim() || 'DIVERS').toUpperCase(),
        due: a.due ?? todayISO(),
        priority: a.priority ?? 'med',
        status: a.status ?? 'todo',
        assignedTo,
        notes: a.notes ?? '',
        favorite: false,
        ...(a.recurrence ? { recurrence: { type: a.recurrence } } : {}),
      });
      const subtasks: Subtask[] = [];
      for (const title of a.subtasks ?? []) {
        if (title.trim()) subtasks.push(await client.post<Subtask>(`/api/tasks/${created.id}/subtasks`, { title: title.trim() }));
      }
      return ok({ created: summarizeTask({ ...created, subtasks }, await client.users()) });
    })
  );

  server.registerTool(
    'update_task',
    {
      title: 'Modifier une tâche',
      description:
        'Modifie une tâche : titre, projet, échéance, priorité, statut (déplacer dans le Kanban), notes, affectation, favori. ' +
        'Passer en "review" sans réviseur : utiliser ensuite set_reviewers. Passer en "done" crée la prochaine occurrence si la tâche est récurrente.',
      inputSchema: {
        taskId: z.string(),
        title: z.string().min(1).optional(),
        project: z.string().optional(),
        due: isoDate.nullable().optional(),
        priority: priority.optional(),
        status: status.optional(),
        notes: z.string().optional(),
        appendNotes: z.string().optional().describe('Texte ajouté à la fin des notes existantes'),
        assignedTo: userRefs.optional().describe('Remplace la liste des personnes affectées'),
        favorite: z.boolean().optional(),
      },
    },
    safe(async ({ taskId, appendNotes, assignedTo, ...fields }) => {
      const before = await fetchTask(client, taskId);
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) patch[k] = v;
      if (typeof patch.project === 'string') patch.project = patch.project.trim().toUpperCase();
      if (appendNotes) patch.notes = [fields.notes ?? before.notes, appendNotes].filter(Boolean).join('\n');
      if (assignedTo) patch.assignedTo = await resolveUserIds(client, assignedTo);
      if (!Object.keys(patch).length) throw new Error('Aucune modification demandée');

      const { updated, nextOccurrence } = await putTask(client, before, patch);
      const users = await client.users();
      const warnings: string[] = [];
      if (patch.status === 'review' && !updated.reviewers?.length) {
        warnings.push('Tâche en révision sans réviseur : utiliser set_reviewers.');
      }
      return ok({
        updated: summarizeTask(updated, users),
        ...(nextOccurrence ? { nextOccurrence: summarizeTask(nextOccurrence, users) } : {}),
        ...(warnings.length ? { warnings } : {}),
      });
    })
  );

  server.registerTool(
    'archive_task',
    {
      title: 'Archiver / désarchiver',
      description: 'Archive (ou désarchive) une tâche.',
      inputSchema: { taskId: z.string(), archived: z.boolean().optional().describe('Défaut true') },
    },
    safe(async ({ taskId, archived = true }) => {
      const before = await fetchTask(client, taskId);
      const { updated } = await putTask(client, before, { archived, archivedAt: archived ? Date.now() : null });
      return ok({ updated: summarizeTask(updated, await client.users()) });
    })
  );

  server.registerTool(
    'delete_task',
    {
      title: 'Supprimer une tâche',
      description: 'Supprime une tâche (suppression logique côté serveur). Préférer archive_task pour une tâche terminée.',
      inputSchema: { taskId: z.string() },
      annotations: { destructiveHint: true },
    },
    safe(async ({ taskId }) => {
      const task = await fetchTask(client, taskId);
      await client.delete(`/api/tasks/${taskId}`);
      return ok(`Tâche supprimée : ${task.title} (${task.project})`);
    })
  );

  server.registerTool(
    'add_subtasks',
    {
      title: 'Ajouter des sous-tâches',
      description: 'Ajoute une ou plusieurs sous-tâches à une tâche.',
      inputSchema: { taskId: z.string(), titles: z.array(z.string().min(1)).min(1) },
    },
    safe(async ({ taskId, titles }) => {
      await fetchTask(client, taskId);
      const created: Subtask[] = [];
      for (const title of titles) created.push(await client.post<Subtask>(`/api/tasks/${taskId}/subtasks`, { title: title.trim() }));
      return ok({ created: created.map((s) => ({ id: s.id, title: s.title })) });
    })
  );

  server.registerTool(
    'update_subtask',
    {
      title: 'Modifier une sous-tâche',
      description: 'Coche/décoche, renomme ou supprime une sous-tâche (id visible via get_task).',
      inputSchema: {
        taskId: z.string(),
        subtaskId: z.string(),
        completed: z.boolean().optional(),
        title: z.string().min(1).optional(),
        delete: z.boolean().optional(),
      },
    },
    safe(async ({ taskId, subtaskId, completed, title, delete: del }) => {
      const path = `/api/tasks/${taskId}/subtasks/${subtaskId}`;
      if (del) {
        await client.delete(path);
        return ok('Sous-tâche supprimée');
      }
      const patch: Record<string, unknown> = {};
      if (completed !== undefined) patch.completed = completed;
      if (title !== undefined) patch.title = title.trim();
      if (!Object.keys(patch).length) throw new Error('Aucune modification demandée');
      const updated = await client.put<Subtask>(path, patch);
      return ok({ id: updated.id, title: updated.title, completed: updated.completed });
    })
  );

  server.registerTool(
    'add_comment',
    {
      title: 'Commenter',
      description: 'Ajoute un commentaire sur une tâche (fil de discussion visible dans To-DoX).',
      inputSchema: { taskId: z.string(), text: z.string().min(1) },
    },
    safe(async ({ taskId, text }) => {
      await fetchTask(client, taskId);
      const c = await client.post<Comment>(`/api/tasks/${taskId}/comments`, { text: text.trim() });
      return ok({ id: c.id, text: c.text });
    })
  );
}
