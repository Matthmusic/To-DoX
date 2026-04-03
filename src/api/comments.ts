import { apiFetch } from './client';
import type { Comment } from '../types';

function normalizeComment(row: any): Comment {
  return {
    id:        row.id,
    taskId:    row.taskId,
    userId:    row.userId,
    text:      row.text,
    createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
    deletedAt: row.deletedAt ? new Date(row.deletedAt).getTime() : null,
  };
}

/** Charge tous les commentaires non supprimés (chargement initial) */
export async function apiGetAllComments(): Promise<Record<string, Comment[]>> {
  const rows = await apiFetch<any[]>('/api/comments');
  const result: Record<string, Comment[]> = {};
  for (const row of rows) {
    const comment = normalizeComment(row);
    if (!result[comment.taskId]) result[comment.taskId] = [];
    result[comment.taskId].push(comment);
  }
  return result;
}

/** Ajoute un commentaire — le client fournit l'id pour idempotence */
export async function apiAddComment(taskId: string, comment: Comment): Promise<Comment> {
  const row = await apiFetch<any>(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      id: comment.id,
      text: comment.text,
      createdAt: new Date(comment.createdAt).toISOString(),
    }),
  });
  return normalizeComment(row);
}

/** Supprime (soft-delete) un commentaire */
export async function apiDeleteComment(taskId: string, commentId: string): Promise<void> {
  await apiFetch(`/api/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' });
}
