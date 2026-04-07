import { useEffect, useRef } from 'react';
import { getApiUrl, getToken } from '../api/client';
import { normalizeTask } from '../api/tasks';
import useStore from '../store/useStore';
import type { Comment, Task } from '../types';

/**
 * Hook de temps réel via SSE (Server-Sent Events).
 * Se connecte à /api/events et met à jour le store local
 * quand d'autres utilisateurs ajoutent ou suppriment des commentaires.
 *
 * Uniquement actif en mode API (IS_API_MODE) avec un utilisateur connecté.
 */
export function useRealtimeEvents() {
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 3_000;
    let stopped = false;

    function connect() {
      const apiUrl = getApiUrl();
      const token = getToken();
      const currentUser = useStore.getState().currentUser;

      if (!apiUrl || !token || !currentUser) return;

      es = new EventSource(`${apiUrl}/api/events?token=${encodeURIComponent(token)}`);
      esRef.current = es;

      es.addEventListener('connected', (e: MessageEvent) => {
        retryDelay = 3_000; // reset backoff on successful connection
        const data = JSON.parse(e.data);
        if (Array.isArray(data.onlineUsers)) {
          useStore.getState().setOnlineUsers(new Set(data.onlineUsers));
        }
      });

      es.addEventListener('comment:added', (e: MessageEvent) => {
        handleCommentAdded(JSON.parse(e.data));
      });

      es.addEventListener('comment:deleted', (e: MessageEvent) => {
        handleCommentDeleted(JSON.parse(e.data));
      });

      es.addEventListener('user:online', (e: MessageEvent) => {
        const { userId } = JSON.parse(e.data);
        const prev = useStore.getState().onlineUsers;
        useStore.getState().setOnlineUsers(new Set([...prev, userId]));
      });

      es.addEventListener('user:offline', (e: MessageEvent) => {
        const { userId } = JSON.parse(e.data);
        const next = new Set(useStore.getState().onlineUsers);
        next.delete(userId);
        useStore.getState().setOnlineUsers(next);
      });

      es.addEventListener('notification:new', (e: MessageEvent) => {
        handleNotificationNew(JSON.parse(e.data));
      });

      es.addEventListener('task:created', (e: MessageEvent) => {
        handleTaskCreated(JSON.parse(e.data));
      });

      es.addEventListener('task:updated', (e: MessageEvent) => {
        handleTaskUpdated(JSON.parse(e.data));
      });

      es.addEventListener('task:deleted', (e: MessageEvent) => {
        handleTaskDeleted(JSON.parse(e.data));
      });

      es.onerror = () => {
        es?.close();
        esRef.current = null;
        if (!stopped) {
          retryTimeout = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 2, 30_000); // backoff exponentiel max 30s
            connect();
          }, retryDelay);
        }
      };
    }

    connect();

    return () => {
      stopped = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      es?.close();
      esRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Se reconnecter quand l'utilisateur se connecte/déconnecte
  useEffect(() => {
    return useStore.subscribe((state, prevState) => {
      if (state.currentUser !== prevState.currentUser) {
        esRef.current?.close();
        esRef.current = null;
        // Le premier useEffect s'occupera de la reconnexion via le store
      }
    });
  }, []);
}

/**
 * Traite un event comment:added reçu du serveur.
 * Ignore les commentaires déjà présents dans le store (ajout optimiste local).
 */
function handleCommentAdded(data: {
  comment: Comment;
  fromUser: { id: string; name: string; email: string };
}) {
  const { comment, fromUser } = data;
  const { currentUser, users, tasks, comments, addAppNotification } = useStore.getState();

  // Ignorer si c'est notre propre commentaire (déjà ajouté optimistement)
  if (comment.userId === currentUser) return;

  // Ignorer si le commentaire est déjà dans le store
  const existing = comments[comment.taskId]?.find(c => c.id === comment.id);
  if (existing) return;

  // Ajouter au store
  useStore.setState(state => ({
    comments: {
      ...state.comments,
      [comment.taskId]: [...(state.comments[comment.taskId] || []), comment],
    },
  }));

  // Générer les notifications pour l'utilisateur courant
  if (!currentUser) return;
  const task = tasks.find(t => t.id === comment.taskId);
  const taskTitle = task?.title || 'une tâche';
  const fromUserName = fromUser.name || fromUser.id;

  const isMentioned = users.find(u => u.id === currentUser) &&
    comment.text.includes(`@${users.find(u => u.id === currentUser)?.name}`);

  if (isMentioned) {
    addAppNotification({
      type: 'comment_mention',
      taskId: comment.taskId,
      taskTitle,
      fromUserId: fromUser.id,
      toUserId: currentUser,
      message: `${fromUserName} vous a mentionné dans "${taskTitle}" : ${comment.text.slice(0, 80)}${comment.text.length > 80 ? '…' : ''}`,
    });
    return;
  }

  // Notifier si on est assigné ou réviseur
  const isInvolved = task && (
    task.assignedTo?.includes(currentUser) ||
    task.reviewers?.includes(currentUser)
  );
  if (isInvolved) {
    addAppNotification({
      type: 'comment_added',
      taskId: comment.taskId,
      taskTitle,
      fromUserId: fromUser.id,
      toUserId: currentUser,
      message: `${fromUserName} a commenté "${taskTitle}" : ${comment.text.slice(0, 80)}${comment.text.length > 80 ? '…' : ''}`,
    });
  }
}

/** Traite un event notification:new reçu du serveur. */
function handleNotificationNew(data: { notification: Record<string, unknown>; toUserId: string }) {
  const { notification, toUserId } = data;
  const { currentUser, appNotifications } = useStore.getState();

  // N'intéresse que l'utilisateur destinataire
  if (toUserId !== currentUser) return;

  // Éviter les doublons (idempotence)
  if (appNotifications.some(n => n.id === notification.id)) return;

  useStore.getState().addAppNotification({
    type: notification.type as any,
    taskId: notification.taskId as string,
    taskTitle: notification.taskTitle as string,
    fromUserId: notification.fromUserId as string,
    toUserId: notification.toUserId as string,
    message: notification.message as string,
  });

  // Notification native Electron si disponible
  window.electronAPI?.sendNotification?.(
    notification.taskTitle as string,
    notification.message as string,
  );
}

/** Traite un event task:created reçu du serveur. */
function handleTaskCreated(data: { task: Task; updatedBy: string }) {
  const { updatedBy, task } = data;
  const { currentUser, tasks } = useStore.getState();
  if (updatedBy === currentUser) return;

  const normalized = normalizeTask(task);
  const exists = tasks.some(t => t.id === normalized.id);
  if (exists) return;

  useStore.setState(state => ({ tasks: [...state.tasks, normalized] }));
}

/** Traite un event task:updated reçu du serveur. */
function handleTaskUpdated(data: { task: Task; updatedBy: string }) {
  const { updatedBy, task } = data;
  const { currentUser } = useStore.getState();
  if (updatedBy === currentUser) return;

  const normalized = normalizeTask(task);
  useStore.setState(state => ({
    tasks: state.tasks.map(t => t.id === normalized.id ? normalized : t),
  }));
}

/** Traite un event task:deleted reçu du serveur. */
function handleTaskDeleted(data: { taskId: string; deletedBy: string }) {
  const { taskId, deletedBy } = data;
  const { currentUser } = useStore.getState();
  if (deletedBy === currentUser) return;

  useStore.setState(state => ({
    tasks: state.tasks.filter(t => t.id !== taskId),
  }));
}

/**
 * Traite un event comment:deleted reçu du serveur.
 */
function handleCommentDeleted(data: { commentId: string; taskId: string; deletedAt: number }) {
  const { commentId, taskId, deletedAt } = data;
  const { currentUser } = useStore.getState();

  // Ignorer si c'est notre propre suppression (déjà appliqué optimistement)
  const comment = useStore.getState().comments[taskId]?.find(c => c.id === commentId);
  if (!comment || comment.userId === currentUser) return;
  if (comment.deletedAt !== null) return; // déjà marqué supprimé

  useStore.setState(state => ({
    comments: {
      ...state.comments,
      [taskId]: (state.comments[taskId] || []).map(c =>
        c.id === commentId ? { ...c, deletedAt } : c
      ),
    },
  }));
}
