import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { TodoxClient } from '../api.js';
import { isLive } from '../helpers.js';
import type { Task } from '../types.js';

/** Réponse MCP texte (JSON lisible) */
export function ok(data: unknown): CallToolResult {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: 'text', text }] };
}

/** Enveloppe un handler pour transformer toute exception en erreur MCP lisible. */
export function safe<A>(fn: (args: A) => Promise<CallToolResult>) {
  return async (args: A): Promise<CallToolResult> => {
    try {
      return await fn(args);
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: `Erreur : ${(e as Error).message}` }] };
    }
  };
}

/** Toutes les tâches non supprimées (actives + archivées). */
export async function fetchTasks(client: TodoxClient): Promise<Task[]> {
  // archived=true : sans ce paramètre le backend ne renvoie pas les tâches archivées
  const tasks = await client.get<Task[]>('/api/tasks?archived=true');
  return tasks.filter(isLive);
}

export async function fetchTask(client: TodoxClient, id: string): Promise<Task> {
  const tasks = await fetchTasks(client);
  const task = tasks.find((t) => t.id === id);
  if (!task) throw new Error(`Tâche introuvable : ${id}. Utilise list_tasks pour retrouver son id.`);
  return task;
}
