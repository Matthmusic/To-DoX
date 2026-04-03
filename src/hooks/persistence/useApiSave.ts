import { useEffect, useRef } from 'react';
import {
  apiCreateTask, apiUpdateTask, apiPutSetting,
  apiCreateTimeEntry, apiUpdateTimeEntry, apiDeleteTimeEntry,
  apiCreateTemplate, apiDeleteTemplate,
  apiCreateSavedReport, apiDeleteSavedReport,
} from '../../api/tasks';
import { apiAddComment, apiDeleteComment } from '../../api/comments';
import { apiCreateNotification, apiMarkNotificationRead, apiDeleteNotificationForUser } from '../../api/notifications';
import type { Task, TimeEntry, Comment, AppNotification } from '../../types';
import type { StoreSnapshot } from './persistence.utils';
import useStore from '../../store/useStore';

/**
 * Synchronisation optimiste vers l'API.
 *
 * Stratégie :
 * - Tasks    : diff par (id + updatedAt). Nouvelles IDs → POST. updatedAt plus récent → PUT.
 * - TimeEntries : diff par (id + updatedAt). Nouvelles → POST. Modifiées → PUT. Disparues → DELETE.
 * - Comments : diff par id + deletedAt. Nouveaux → POST. deletedAt changé → DELETE (soft).
 * - Templates : diff par id. Nouveaux → POST. Disparus → DELETE.
 * - SavedReports : diff par id. Nouveaux → POST. Disparus → DELETE.
 * - AppNotifications : diff par id. Nouvelles → POST. readAt changé → PATCH read. deletedBy changé → PATCH delete-for-user.
 * - Settings : debounce 1 s sur projectHistory / projectColors / directories / notificationSettings / outlookConfig.
 * - Thème    : localStorage uniquement (par poste).
 *
 * FIX DOUBLONS : Au premier chargement (isLoadingData: true→false), les refs sont initialisés
 * depuis l'état courant du store SANS déclencher de sauvegarde. Seules les modifications
 * postérieures au chargement génèrent des appels API.
 */
export function useApiSave(store: StoreSnapshot) {
  const {
    tasks, timeEntries, comments, templates, savedReports, appNotifications,
    projectHistory, projectColors, directories, notificationSettings, outlookConfig,
    themeSettings, currentUser, isLoadingData,
  } = store;

  // ── Refs de diff ───────────────────────────────────────────────────────────
  const knownTasks         = useRef<Map<string, number>>(new Map());           // id → updatedAt
  const knownTimeEntries   = useRef<Map<string, number>>(new Map());           // id → updatedAt
  const knownTimeEntryIds  = useRef<Set<string>>(new Set());                   // pour détecter suppressions
  const knownComments      = useRef<Map<string, number | null>>(new Map());    // id → deletedAt
  const knownTemplateIds   = useRef<Set<string>>(new Set());
  const knownReportIds     = useRef<Set<string>>(new Set());
  const knownNotifs        = useRef<Map<string, { readAt?: number; deletedBy: string[] }>>(new Map());

  // Détection de la transition isLoadingData: true → false
  const prevIsLoadingRef = useRef<boolean>(true);
  const initialized      = useRef<boolean>(false);

  // ── Reset quand l'utilisateur change (logout / changement de compte) ──────
  useEffect(() => {
    initialized.current = false;
    prevIsLoadingRef.current = true;
    knownTasks.current.clear();
    knownTimeEntries.current.clear();
    knownTimeEntryIds.current.clear();
    knownComments.current.clear();
    knownTemplateIds.current.clear();
    knownReportIds.current.clear();
    knownNotifs.current.clear();
  }, [currentUser]);

  // ── Initialisation des snapshots après le premier chargement ─────────────
  // Déclenché quand isLoadingData passe de true à false.
  // Alimente les refs depuis les données déjà en store, SANS appel API.
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoadingData;

    if (!wasLoading || isLoadingData || !currentUser) return;

    // Lire l'état courant du store (toutes les données viennent d'être chargées)
    const state = useStore.getState();

    knownTasks.current.clear();
    for (const task of state.tasks) {
      knownTasks.current.set(task.id, task.updatedAt);
    }

    knownTimeEntries.current.clear();
    knownTimeEntryIds.current.clear();
    for (const entry of state.timeEntries) {
      knownTimeEntries.current.set(entry.id, entry.updatedAt);
      knownTimeEntryIds.current.add(entry.id);
    }

    knownComments.current.clear();
    for (const comment of Object.values(state.comments ?? {}).flat()) {
      knownComments.current.set(comment.id, comment.deletedAt);
    }

    knownTemplateIds.current.clear();
    for (const tpl of state.templates ?? []) {
      knownTemplateIds.current.add(tpl.id);
    }

    knownReportIds.current.clear();
    for (const report of state.savedReports ?? []) {
      knownReportIds.current.add(report.id);
    }

    knownNotifs.current.clear();
    for (const notif of state.appNotifications ?? []) {
      knownNotifs.current.set(notif.id, { readAt: notif.readAt, deletedBy: notif.deletedBy ?? [] });
    }

    initialized.current = true;
  }, [isLoadingData, currentUser]);

  // ── Sync des tâches ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoadingData || !currentUser || !initialized.current) return;

    const pending: Task[] = [];

    for (const task of tasks) {
      const knownUpdatedAt = knownTasks.current.get(task.id);
      if (knownUpdatedAt === undefined) {
        pending.push(task);
      } else if (task.updatedAt > knownUpdatedAt) {
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

  // ── Sync des time entries ─────────────────────────────────────────────────
  useEffect(() => {
    if (isLoadingData || !currentUser || !initialized.current) return;

    const currentIds = new Set(timeEntries.map(e => e.id));

    // Suppressions : IDs connus qui ont disparu du tableau
    for (const id of knownTimeEntryIds.current) {
      if (!currentIds.has(id)) {
        knownTimeEntries.current.delete(id);
        knownTimeEntryIds.current.delete(id);
        apiDeleteTimeEntry(id).catch(err =>
          console.warn('[API] Erreur suppression time entry:', id, err)
        );
      }
    }

    const pending: TimeEntry[] = [];
    for (const entry of timeEntries) {
      const knownUpdatedAt = knownTimeEntries.current.get(entry.id);
      if (knownUpdatedAt === undefined) {
        pending.push(entry);
      } else if (entry.updatedAt > knownUpdatedAt) {
        pending.push(entry);
      }
    }

    for (const entry of pending) {
      const isNew = !knownTimeEntries.current.has(entry.id);
      knownTimeEntries.current.set(entry.id, entry.updatedAt);
      knownTimeEntryIds.current.add(entry.id);

      if (isNew) {
        apiCreateTimeEntry(entry).catch(err =>
          console.warn('[API] Erreur création time entry:', entry.id, err)
        );
      } else {
        apiUpdateTimeEntry(entry.id, entry).catch(err =>
          console.warn('[API] Erreur mise à jour time entry:', entry.id, err)
        );
      }
    }
  }, [timeEntries, isLoadingData, currentUser]);

  // ── Sync des commentaires ─────────────────────────────────────────────────
  useEffect(() => {
    if (isLoadingData || !currentUser || !initialized.current) return;

    const allComments = Object.values(comments ?? {}).flat() as Comment[];

    for (const comment of allComments) {
      const knownDeletedAt = knownComments.current.get(comment.id);

      if (knownDeletedAt === undefined) {
        // Nouveau commentaire → POST
        knownComments.current.set(comment.id, comment.deletedAt);
        apiAddComment(comment.taskId, comment).catch(err =>
          console.warn('[API] Erreur ajout commentaire:', comment.id, err)
        );
      } else if (comment.deletedAt !== null && knownDeletedAt === null) {
        // Commentaire supprimé (soft-delete) → DELETE
        knownComments.current.set(comment.id, comment.deletedAt);
        apiDeleteComment(comment.taskId, comment.id).catch(err =>
          console.warn('[API] Erreur suppression commentaire:', comment.id, err)
        );
      }
    }
  }, [comments, isLoadingData, currentUser]);

  // ── Sync des templates ────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoadingData || !currentUser || !initialized.current) return;

    const currentIds = new Set((templates ?? []).map(t => t.id));

    // Suppressions
    for (const id of knownTemplateIds.current) {
      if (!currentIds.has(id)) {
        knownTemplateIds.current.delete(id);
        apiDeleteTemplate(id).catch(err =>
          console.warn('[API] Erreur suppression template:', id, err)
        );
      }
    }

    // Ajouts
    for (const tpl of templates ?? []) {
      if (!knownTemplateIds.current.has(tpl.id)) {
        knownTemplateIds.current.add(tpl.id);
        apiCreateTemplate(tpl).catch(err =>
          console.warn('[API] Erreur création template:', tpl.id, err)
        );
      }
    }
  }, [templates, isLoadingData, currentUser]);

  // ── Sync des rapports sauvegardés ─────────────────────────────────────────
  useEffect(() => {
    if (isLoadingData || !currentUser || !initialized.current) return;

    const currentIds = new Set((savedReports ?? []).map(r => r.id));

    // Suppressions
    for (const id of knownReportIds.current) {
      if (!currentIds.has(id)) {
        knownReportIds.current.delete(id);
        apiDeleteSavedReport(id).catch(err =>
          console.warn('[API] Erreur suppression rapport:', id, err)
        );
      }
    }

    // Ajouts
    for (const report of savedReports ?? []) {
      if (!knownReportIds.current.has(report.id)) {
        knownReportIds.current.add(report.id);
        apiCreateSavedReport(report).catch(err =>
          console.warn('[API] Erreur création rapport:', report.id, err)
        );
      }
    }
  }, [savedReports, isLoadingData, currentUser]);

  // ── Sync des notifications ────────────────────────────────────────────────
  useEffect(() => {
    if (isLoadingData || !currentUser || !initialized.current) return;

    for (const notif of appNotifications ?? [] as AppNotification[]) {
      const known = knownNotifs.current.get(notif.id);

      if (!known) {
        // Nouvelle notification → POST
        knownNotifs.current.set(notif.id, { readAt: notif.readAt, deletedBy: notif.deletedBy ?? [] });
        apiCreateNotification(notif).catch(err =>
          console.warn('[API] Erreur création notification:', notif.id, err)
        );
        continue;
      }

      // readAt passé de undefined/null à une valeur → PATCH read
      if (notif.readAt && !known.readAt) {
        knownNotifs.current.set(notif.id, { ...known, readAt: notif.readAt });
        apiMarkNotificationRead(notif.id).catch(err =>
          console.warn('[API] Erreur mark read notification:', notif.id, err)
        );
      }

      // deletedBy : nouveaux userIds → PATCH delete-for-user (une fois par userId ajouté)
      const newDeletedBy = notif.deletedBy ?? [];
      const addedUsers = newDeletedBy.filter(u => !known.deletedBy.includes(u));
      if (addedUsers.length > 0) {
        knownNotifs.current.set(notif.id, { ...known, deletedBy: newDeletedBy });
        // La route PATCH utilise req.userId côté backend, on appelle pour chaque userId ajouté
        apiDeleteNotificationForUser(notif.id).catch(err =>
          console.warn('[API] Erreur delete-for-user notification:', notif.id, err)
        );
      }
    }
  }, [appNotifications, isLoadingData, currentUser]);

  // ── Sync des settings (debounce 1 s) ─────────────────────────────────────
  useEffect(() => {
    if (isLoadingData || !currentUser || !initialized.current) return;
    const t = setTimeout(() => {
      apiPutSetting('projectHistory', projectHistory).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [projectHistory, isLoadingData, currentUser]);

  useEffect(() => {
    if (isLoadingData || !currentUser || !initialized.current) return;
    const t = setTimeout(() => {
      apiPutSetting('projectColors', projectColors).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [projectColors, isLoadingData, currentUser]);

  useEffect(() => {
    if (isLoadingData || !currentUser || !initialized.current) return;
    const t = setTimeout(() => {
      apiPutSetting('directories', directories).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [directories, isLoadingData, currentUser]);

  useEffect(() => {
    if (isLoadingData || !currentUser || !initialized.current) return;
    const t = setTimeout(() => {
      apiPutSetting('notificationSettings', notificationSettings).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [notificationSettings, isLoadingData, currentUser]);

  useEffect(() => {
    if (isLoadingData || !currentUser || !initialized.current) return;
    const t = setTimeout(() => {
      apiPutSetting('outlookConfig', outlookConfig).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [outlookConfig, isLoadingData, currentUser]);

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
