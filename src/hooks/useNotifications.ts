/**
 * 🔔 HOOK NOTIFICATIONS DESKTOP
 * Système de notifications natives Electron pour alertes de tâches
 * - Tâches arrivant à échéance dans 24h
 * - Tâches "à relancer" (>3 jours sans mouvement en "doing")
 */

import { useEffect, useRef, useCallback } from 'react';
import useStore from '../store/useStore';
import { businessDayDelta, devLog, devWarn, devError } from '../utils';
import { playSoundFile } from '../utils/sound';

// Constantes
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function useNotifications() {
  const { tasks, notificationSettings, currentUser } = useStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedTasksRef = useRef<Set<string>>(new Set()); // Éviter les doublons notifs tâches


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
      devLog('🔕 Notification bloquée (heures calmes):', title);
      return;
    }

    // Vérifier si Electron disponible
    if (!window.electronAPI) {
      devWarn('⚠️ Notifications non disponibles (mode web)');
      return;
    }

    try {
      // Demander permission si nécessaire
      const hasPermission = await window.electronAPI.requestNotificationPermission();
      if (!hasPermission) {
        devWarn('⚠️ Permission de notification refusée');
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
          devWarn('⚠️ Impossible de jouer le son:', audioError);
        }
      }

      devLog('✅ Notification envoyée:', title);
    } catch (error) {
      devError('❌ Erreur notification:', error);
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

    // 3. Journées Gantt planifiées pour l'utilisateur courant aujourd'hui
    if ((notificationSettings.ganttNotifications ?? true) && currentUser) {
      const todayISO = new Date().toISOString().slice(0, 10);
      const ganttToday: string[] = [];

      activeTasks.forEach(task => {
        const hasToday = (task.ganttDays ?? []).some(
          d => d.date === todayISO && (d.userIds ?? []).includes(currentUser)
        );
        if (hasToday) ganttToday.push(`• ${task.title} (${task.project})`);
      });

      if (ganttToday.length > 0) {
        const title = ganttToday.length === 1
          ? '📅 1 tâche planifiée pour vous aujourd\'hui'
          : `📅 ${ganttToday.length} tâches planifiées pour vous aujourd'hui`;
        const body = ganttToday.slice(0, 5).join('\n') +
          (ganttToday.length > 5 ? `\n... et ${ganttToday.length - 5} autres` : '');
        sendNotification(title, body, `gantt-today-${todayISO}`);
      }
    }
  }, [tasks, notificationSettings, sendNotification, currentUser]);

  // Réinitialiser les tâches notifiées toutes les 24h
  useEffect(() => {
    const resetInterval = setInterval(() => {
      notifiedTasksRef.current.clear();
      devLog('🔄 Cache des notifications réinitialisé');
    }, 24 * 60 * 60 * 1000); // 24h

    return () => clearInterval(resetInterval);
  }, []);

  // Configurer l'intervalle de vérification
  useEffect(() => {
    // ⛔ Ne pas démarrer les notifications si aucun utilisateur n'est connecté
    if (!currentUser) {
      devLog('⏸️ Notifications en pause (aucun utilisateur connecté)');
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

    devLog(`🔔 Notifications activées pour l'utilisateur (vérification toutes les ${notificationSettings.checkInterval} min)`);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [notificationSettings.enabled, notificationSettings.checkInterval, checkTasksForNotifications, currentUser]);

  return {
    isEnabled: notificationSettings.enabled,
    checkNow: checkTasksForNotifications,
  };
}
