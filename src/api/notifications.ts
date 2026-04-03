import { apiFetch } from './client';
import type { AppNotification } from '../types';

function normalizeNotification(row: any): AppNotification {
  return {
    id:          row.id,
    type:        row.type,
    taskId:      row.taskId,
    taskTitle:   row.taskTitle,
    fromUserId:  row.fromUserId,
    toUserId:    row.toUserId,
    message:     row.message,
    createdAt:   row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
    readAt:      row.readAt    ? new Date(row.readAt).getTime()    : undefined,
    deletedBy:   row.deletedBy ?? [],
  };
}

/** Charge les notifications de l'utilisateur courant */
export async function apiGetNotifications(): Promise<AppNotification[]> {
  const rows = await apiFetch<any[]>('/api/notifications');
  return rows.map(normalizeNotification);
}

/** Crée une notification — le client fournit l'id pour idempotence */
export async function apiCreateNotification(notif: AppNotification): Promise<void> {
  await apiFetch('/api/notifications', {
    method: 'POST',
    body: JSON.stringify({
      id:          notif.id,
      type:        notif.type,
      taskId:      notif.taskId,
      taskTitle:   notif.taskTitle,
      fromUserId:  notif.fromUserId,
      toUserId:    notif.toUserId,
      message:     notif.message,
      createdAt:   new Date(notif.createdAt).toISOString(),
    }),
  });
}

/** Marque une notification comme lue */
export async function apiMarkNotificationRead(id: string): Promise<void> {
  await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
}

/** Supprime une notification pour l'utilisateur courant */
export async function apiDeleteNotificationForUser(id: string): Promise<void> {
  await apiFetch(`/api/notifications/${id}/delete-for-user`, { method: 'PATCH' });
}
