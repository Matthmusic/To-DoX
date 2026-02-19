/**
 * 🔔 HOOK NOTIFICATIONS DESKTOP
 * Système de notifications natives Electron pour alertes de tâches
 * - Tâches arrivant à échéance dans 24h
 * - Tâches "à relancer" (>3 jours sans mouvement en "doing")
 */

import { useEffect, useRef, useCallback } from 'react';
import useStore from '../store/useStore';
import { businessDayDelta } from '../utils';
import { playSoundFile } from '../utils/sound';

// Constantes
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function useNotifications() {
  const { tasks, notificationSettings, currentUser, pendingMentions, clearPendingMentions } = useStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedTasksRef = useRef<Set<string>>(new Set()); // Éviter les doublons notifs tâches
  const shownMentionIds = useRef(new Set<string>()); // Éviter les doublons @mention

  // Vérifier si on est en heures calmes
  const isQuietHours = useCallback((): boolean => {
    if (!notificationSettings.quietHoursEnabled) return false;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const { quietHoursStart, quietHoursEnd } = notificationSettings;

    // Gestion du cas où les heures calmes passent minuit
    if (quietHoursStart > quietHoursEnd) {
      return currentTime >= quietHoursStart || currentTime < quietHoursEnd;
    }
    return currentTime >= quietHoursStart && currentTime < quietHoursEnd;
  }, [notificationSettings]);

  // Envoyer une notification native
  const sendNotification = useCallback(async (title: string, body: string, taskId: string) => {
    // Vérifier si déjà notifié
    if (notifiedTasksRef.current.has(taskId)) return;

    // Vérifier heures calmes
    if (isQuietHours()) {
      console.log('🔕 Notification bloquée (heures calmes):', title);
      return;
    }

    // Vérifier si Electron disponible
    if (!window.electronAPI) {
      console.warn('⚠️ Notifications non disponibles (mode web)');
      return;
    }

    try {
      // Demander permission si nécessaire
      const hasPermission = await window.electronAPI.requestNotificationPermission();
      if (!hasPermission) {
        console.warn('⚠️ Permission de notification refusée');
        return;
      }

      // Envoyer la notification
      await window.electronAPI.sendNotification(title, body, taskId);
      notifiedTasksRef.current.add(taskId);

      // 🔊 Jouer le son sélectionné si activé
      if (notificationSettings.sound && notificationSettings.soundFile) {
        try {
          await playSoundFile(notificationSettings.soundFile);
        } catch (audioError) {
          console.warn('⚠️ Impossible de jouer le son:', audioError);
        }
      }

      console.log('✅ Notification envoyée:', title);
    } catch (error) {
      console.error('❌ Erreur notification:', error);
    }
  }, [isQuietHours, notificationSettings.sound, notificationSettings.soundFile]);

  // Vérifier les tâches nécessitant une notification
  const checkTasksForNotifications = useCallback(() => {
    if (!notificationSettings.enabled) return;

    const now = Date.now();
    const activeTasks = tasks.filter(t => !t.archived && !t.deletedAt && t.status !== 'done');

    // 🎯 Filtrer uniquement les tâches assignées à l'utilisateur actuel
    const myTasks = currentUser
      ? activeTasks.filter(t => t.assignedTo.includes(currentUser))
      : activeTasks; // Si pas d'utilisateur connecté, afficher toutes les tâches

    // Groupes de notifications
    const tasksTomorrow: string[] = [];
    const tasksToday: string[] = [];
    const tasksOverdue: string[] = [];
    const tasksStale: string[] = [];

    // 1. Tâches arrivant à échéance dans 24h
    if (notificationSettings.deadlineNotifications) {
      myTasks.forEach(task => {
        if (!task.due) return;

        const daysRemaining = businessDayDelta(task.due);

        // Échéance dans 24h (1 jour ouvré)
        if (daysRemaining === 1) {
          tasksTomorrow.push(`• ${task.title} (${task.project})`);
        }

        // Échéance aujourd'hui
        if (daysRemaining === 0) {
          tasksToday.push(`• ${task.title} (${task.project})`);
        }

        // En retard
        if (daysRemaining < 0) {
          tasksOverdue.push(`• ${task.title} (${task.project}) - J${daysRemaining}`);
        }
      });
    }

    // 2. Tâches "à relancer" (>3 jours sans mouvement en "doing")
    if (notificationSettings.staleTaskNotifications) {
      myTasks
        .filter(task => task.status === 'doing')
        .forEach(task => {
          const timeSinceUpdate = now - task.updatedAt;

          if (timeSinceUpdate > THREE_DAYS_MS) {
            const daysStale = Math.floor(timeSinceUpdate / (24 * 60 * 60 * 1000));
            tasksStale.push(`• ${task.title} (${task.project}) - ${daysStale}j`);
          }
        });
    }

    // Envoyer les notifications groupées
    if (tasksTomorrow.length > 0) {
      const title = tasksTomorrow.length === 1
        ? '⏰ 1 tâche arrive à échéance demain'
        : `⏰ ${tasksTomorrow.length} tâches arrivent à échéance demain`;
      const body = tasksTomorrow.slice(0, 5).join('\n') +
        (tasksTomorrow.length > 5 ? `\n... et ${tasksTomorrow.length - 5} autres` : '');
      sendNotification(title, body, 'deadline-tomorrow');
    }

    if (tasksToday.length > 0) {
      const title = tasksToday.length === 1
        ? '🚨 1 tâche à traiter AUJOURD\'HUI'
        : `🚨 ${tasksToday.length} tâches à traiter AUJOURD'HUI`;
      const body = tasksToday.slice(0, 5).join('\n') +
        (tasksToday.length > 5 ? `\n... et ${tasksToday.length - 5} autres` : '');
      sendNotification(title, body, 'deadline-today');
    }

    if (tasksOverdue.length > 0) {
      const title = tasksOverdue.length === 1
        ? '❌ 1 tâche en retard'
        : `❌ ${tasksOverdue.length} tâches en retard`;
      const body = tasksOverdue.slice(0, 5).join('\n') +
        (tasksOverdue.length > 5 ? `\n... et ${tasksOverdue.length - 5} autres` : '');
      sendNotification(title, body, 'overdue');
    }

    if (tasksStale.length > 0) {
      const title = tasksStale.length === 1
        ? '⚠️ 1 tâche à relancer'
        : `⚠️ ${tasksStale.length} tâches à relancer`;
      const body = tasksStale.slice(0, 5).join('\n') +
        (tasksStale.length > 5 ? `\n... et ${tasksStale.length - 5} autres` : '');
      sendNotification(title, body, 'stale-tasks');
    }
  }, [tasks, notificationSettings, sendNotification, currentUser]);

  // Réinitialiser les tâches notifiées toutes les 24h
  useEffect(() => {
    const resetInterval = setInterval(() => {
      notifiedTasksRef.current.clear();
      console.log('🔄 Cache des notifications réinitialisé');
    }, 24 * 60 * 60 * 1000); // 24h

    return () => clearInterval(resetInterval);
  }, []);

  // Configurer l'intervalle de vérification
  useEffect(() => {
    // ⛔ Ne pas démarrer les notifications si aucun utilisateur n'est connecté
    if (!currentUser) {
      console.log('⏸️ Notifications en pause (aucun utilisateur connecté)');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (!notificationSettings.enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Vérification immédiate au montage
    checkTasksForNotifications();

    // Puis vérifications périodiques
    const intervalMs = notificationSettings.checkInterval * 60 * 1000; // Convertir minutes en ms
    intervalRef.current = setInterval(checkTasksForNotifications, intervalMs);

    console.log(`🔔 Notifications activées pour l'utilisateur (vérification toutes les ${notificationSettings.checkInterval} min)`);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [notificationSettings.enabled, notificationSettings.checkInterval, checkTasksForNotifications, currentUser]);

  // Notifications @mention — réagit en temps réel, respecte les quiet hours et le son
  useEffect(() => {
    if (!currentUser || currentUser === 'unassigned') return;
    const mentions = pendingMentions[currentUser];
    if (!mentions || mentions.length === 0) return;

    const newMentions = mentions.filter(m => !shownMentionIds.current.has(m.commentId));
    if (newMentions.length === 0) return;

    const grouped = newMentions.reduce<Record<string, string[]>>((acc, m) => {
      if (!acc[m.fromUserName]) acc[m.fromUserName] = [];
      acc[m.fromUserName].push(m.taskTitle);
      return acc;
    }, {});

    Object.entries(grouped).forEach(([from, taskTitles]) => {
      const uniqueTitles = [...new Set(taskTitles)];
      const body = uniqueTitles.length === 1
        ? `Dans "${uniqueTitles[0]}"`
        : `Dans ${uniqueTitles.length} tâches`;
      sendNotification(`${from} vous a mentionné(e)`, body, `mention-${currentUser}-${Date.now()}`);
    });

    newMentions.forEach(m => shownMentionIds.current.add(m.commentId));
    clearPendingMentions(currentUser);
  }, [currentUser, pendingMentions, sendNotification, clearPendingMentions]);

  return {
    isEnabled: notificationSettings.enabled,
    checkNow: checkTasksForNotifications,
  };
}
