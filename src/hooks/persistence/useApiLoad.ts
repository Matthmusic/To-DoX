import { useEffect, useRef } from 'react';
import { ApiError, clearToken, getToken } from '../../api/client';
import { apiGetMe, apiGetUsers } from '../../api/auth';
import { apiGetSetting, apiGetTasks, apiGetTimeEntries } from '../../api/tasks';
import useStore from '../../store/useStore';
import type { Directories, NotificationSettings, OutlookConfig, ThemeSettings } from '../../types';

/**
 * Chargement initial de toutes les données depuis l'API.
 * Lance le chargement quand un token + currentUser sont disponibles.
 * En l'absence de token valide, setIsLoadingData(false) pour afficher le LoginModal.
 */
export function useApiLoad() {
  const dataLoaded = useRef(false);

  useEffect(() => {
    async function init() {
      const {
        setIsLoadingData, setCurrentUser, setUsers,
        setTasks, setTimeEntries, setDirectories, setProjectHistory,
        setProjectColors, setNotificationSettings, setThemeSettings,
        setOutlookConfig,
      } = useStore.getState();

      const token = getToken();

      if (!token) {
        setIsLoadingData(false);
        return;
      }

      try {
        // Valider le token + récupérer le user courant
        const me = await apiGetMe();
        const allUsers = await apiGetUsers();

        setUsers(allUsers.map(u => ({ ...u })));
        setCurrentUser(me.id);

        // Charger toutes les données en parallèle
        const [tasks, timeEntries, projectHistory, projectColors, directories, notifSettings, outlookConfig] =
          await Promise.all([
            apiGetTasks(),
            apiGetTimeEntries(),
            apiGetSetting<string[]>('projectHistory'),
            apiGetSetting<Record<string, number>>('projectColors'),
            apiGetSetting<Directories>('directories'),
            apiGetSetting<NotificationSettings>('notificationSettings'),
            apiGetSetting<OutlookConfig>('outlookConfig'),
          ]);

        if (tasks)           setTasks(tasks);
        if (timeEntries)     setTimeEntries(timeEntries);
        if (projectHistory)  setProjectHistory(projectHistory);
        if (projectColors)   setProjectColors(projectColors);
        if (directories)     setDirectories(directories);
        if (notifSettings)   setNotificationSettings(notifSettings);
        if (outlookConfig)   setOutlookConfig(outlookConfig);

        // Thème — stocké localement par poste (pas en base)
        const rawTheme = localStorage.getItem('theme_settings');
        if (rawTheme) {
          try { setThemeSettings(JSON.parse(rawTheme) as ThemeSettings); } catch { /* ignore */ }
        }

        dataLoaded.current = true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          setCurrentUser(null);
        } else {
          // eslint-disable-next-line no-console
          console.error('[API] Erreur chargement initial:', err);
        }
      } finally {
        setIsLoadingData(false);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Rechargement après une connexion réussie.
   * Appelé manuellement depuis LoginModal via le store.
   */
  useEffect(() => {
    let prevUser: string | null = useStore.getState().currentUser;
    return useStore.subscribe((state) => {
      const currentUser = state.currentUser;
      if (currentUser && !prevUser && !dataLoaded.current) {
        prevUser = currentUser;
          const {
            setIsLoadingData, setUsers,
            setTasks, setTimeEntries, setDirectories, setProjectHistory,
            setProjectColors, setNotificationSettings, setOutlookConfig,
          } = useStore.getState();

          setIsLoadingData(true);

          Promise.all([
            apiGetUsers(),
            apiGetTasks(),
            apiGetTimeEntries(),
            apiGetSetting<string[]>('projectHistory'),
            apiGetSetting<Record<string, number>>('projectColors'),
            apiGetSetting<Directories>('directories'),
            apiGetSetting<NotificationSettings>('notificationSettings'),
            apiGetSetting<OutlookConfig>('outlookConfig'),
          ]).then(([users, tasks, timeEntries, projectHistory, projectColors, directories, notifSettings, outlookConfig]) => {
            setUsers(users.map(u => ({ ...u })));
            if (tasks)          setTasks(tasks);
            if (timeEntries)    setTimeEntries(timeEntries);
            if (projectHistory) setProjectHistory(projectHistory);
            if (projectColors)  setProjectColors(projectColors);
            if (directories)    setDirectories(directories);
            if (notifSettings)  setNotificationSettings(notifSettings);
            if (outlookConfig)  setOutlookConfig(outlookConfig);
            dataLoaded.current = true;
          }).catch(err => {
            // eslint-disable-next-line no-console
            console.error('[API] Erreur rechargement post-login:', err);
          }).finally(() => {
            setIsLoadingData(false);
          });
      } else {
        prevUser = currentUser;
      }
    });
  }, []);
}
