import { useEffect, useRef } from 'react';
import { apiCreateTask, apiUpdateTask, apiPutSetting } from '../../api/tasks';
import type { Task } from '../../types';
import type { StoreSnapshot } from './persistence.utils';

/**
 * Synchronisation optimiste vers l'API.
 *
 * Stratégie :
 * - Tasks    : diff par (id + updatedAt). Nouvelles IDs → POST. updatedAt plus récent → PUT.
 * - Settings : debounce 1 s sur projectHistory / projectColors / directories / notificationSettings.
 * - Thème    : localStorage uniquement (par poste).
 * - TimeEntries : non synchronisées ici pour le moment (complexité du merge multi-user).
 *
 * Pas de suppression effective côté API : les tâches sont soft-deletées (deletedAt),
 * donc elles passent naturellement dans le flux PUT.
 */
export function useApiSave(store: StoreSnapshot) {
  const {
    tasks, projectHistory, projectColors, directories,
    notificationSettings, themeSettings, currentUser, isLoadingData,
  } = store;

  // ── Snapshot de référence des tâches connues côté API ──────────────────────
  const knownTasks = useRef<Map<string, number>>(new Map()); // id → updatedAt

  // ── Sync des tâches ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoadingData || !currentUser) return;

    const pending: Task[] = [];

    for (const task of tasks) {
      const knownUpdatedAt = knownTasks.current.get(task.id);
      if (knownUpdatedAt === undefined) {
        // Nouvelle tâche créée côté client → POST
        pending.push(task);
      } else if (task.updatedAt > knownUpdatedAt) {
        // Tâche modifiée → PUT
        pending.push(task);
      }
    }

    if (pending.length === 0) return;

    for (const task of pending) {
      const isNew = !knownTasks.current.has(task.id);
      knownTasks.current.set(task.id, task.updatedAt);

      if (isNew) {
        apiCreateTask(task).catch(err =>
          console.warn('[API] Erreur création tâche:', task.id, err)
        );
      } else {
        apiUpdateTask(task.id, task).catch(err =>
          console.warn('[API] Erreur mise à jour tâche:', task.id, err)
        );
      }
    }
  }, [tasks, isLoadingData, currentUser]);

  // ── Sync des settings (debounce 1 s) ─────────────────────────────────────
  useEffect(() => {
    if (isLoadingData || !currentUser) return;
    const t = setTimeout(() => {
      apiPutSetting('projectHistory', projectHistory).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [projectHistory, isLoadingData, currentUser]);

  useEffect(() => {
    if (isLoadingData || !currentUser) return;
    const t = setTimeout(() => {
      apiPutSetting('projectColors', projectColors).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [projectColors, isLoadingData, currentUser]);

  useEffect(() => {
    if (isLoadingData || !currentUser) return;
    const t = setTimeout(() => {
      apiPutSetting('directories', directories).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [directories, isLoadingData, currentUser]);

  useEffect(() => {
    if (isLoadingData || !currentUser) return;
    const t = setTimeout(() => {
      apiPutSetting('notificationSettings', notificationSettings).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [notificationSettings, isLoadingData, currentUser]);

  // ── Thème : localStorage uniquement (par poste, comme en mode local) ─────
  useEffect(() => {
    if (isLoadingData) return;
    localStorage.setItem('theme_settings', JSON.stringify(themeSettings));
  }, [themeSettings, isLoadingData]);

  // ── Utilisateur courant ───────────────────────────────────────────────────
  useEffect(() => {
    if (currentUser) localStorage.setItem('current_user_id', currentUser);
    else localStorage.removeItem('current_user_id');
  }, [currentUser]);
}
