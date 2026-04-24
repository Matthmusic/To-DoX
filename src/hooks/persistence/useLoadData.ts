import { useEffect } from 'react';
import { STORAGE_KEY, FIXED_USERS } from '../../constants';
import type { AppNotification, OutlookConfig, StoredData, Task, SavedReport, TimeEntry } from '../../types';

const DEFAULT_OUTLOOK_CONFIG: OutlookConfig = { enabled: false, icsUrl: '', exportEnabled: false, lastSync: null };
import useStore from '../../store/useStore';
import { devLog, devWarn } from '../../utils';
import { migrateTask } from '../../utils/taskMigration';
import { mergeTasksByUpdatedAt } from '../../utils/taskMigration';
import { migrateTemplate, type PersistenceRefs } from './persistence.utils';

type StoredDataRaw = Omit<StoredData, 'tasks'> & { tasks?: unknown[] };

/** Chargement initial des données : localStorage → migration → Electron data.json */
export function useLoadData(refs: PersistenceRefs) {
    useEffect(() => {
        async function initStorage() {
            const {
                notificationSettings,
                setTasks,
                setDirectories,
                setProjectHistory,
                setProjectColors,
                setNotificationSettings,
                setThemeSettings,
                setComments,
                setTemplates,
                setSavedReports,
                setAppNotifications,
                setTimeEntries,
                setOutlookConfig,
                setOutlookConfigs,
                setUsers,
                setCurrentUser,
                setStoragePath,
                setIsLoadingData,
            } = useStore.getState();

            devLog('🚀 [DATA LOADING] Début du chargement des données...');

            setUsers(FIXED_USERS);

            const savedUserId = localStorage.getItem('current_user_id');
            const importingUser = (savedUserId && FIXED_USERS.some(u => u.id === savedUserId))
                ? savedUserId
                : null;

            let localTasks: Task[] = [];

            // 1. LocalStorage (fallback web + base pour merge Electron)
            const raw = localStorage.getItem(STORAGE_KEY);
            devLog('📦 [LOCALSTORAGE] Données brutes:', raw ? `${raw.length} car.` : 'AUCUNE');

            if (raw) {
                try {
                    const parsed = JSON.parse(raw) as StoredDataRaw;
                    if (parsed.tasks) {
                        localTasks = parsed.tasks.map((t) => migrateTask(t, { fallbackUser: importingUser }));
                        devLog('✅ [LOCALSTORAGE] Tâches migrées:', localTasks.length);
                        setTasks(localTasks);
                    }
                    if (parsed.directories) setDirectories(parsed.directories);
                    if (parsed.projectHistory) setProjectHistory(parsed.projectHistory);
                    if (parsed.projectColors) setProjectColors(parsed.projectColors);
                    if (parsed.notificationSettings) setNotificationSettings(parsed.notificationSettings);
                    if (parsed.comments) setComments(parsed.comments);
                    if (parsed.templates) setTemplates((parsed.templates as unknown[]).map(migrateTemplate));
                    if (parsed.savedReports) setSavedReports(parsed.savedReports as SavedReport[]);
                    if (parsed.appNotifications) setAppNotifications(parsed.appNotifications as AppNotification[]);
                    if (parsed.timeEntries) setTimeEntries(parsed.timeEntries as TimeEntry[]);
                    // Chargement outlook par user (avec migration depuis l'ancien champ global)
                    {
                        const configs = (parsed.outlookConfigs ?? {}) as Record<string, OutlookConfig>;
                        // Migration one-time : si outlookConfig global existait, l'attribuer au user courant
                        if (parsed.outlookConfig && importingUser && !configs[importingUser]) {
                            configs[importingUser] = parsed.outlookConfig as OutlookConfig;
                        }
                        setOutlookConfigs(configs);
                        if (importingUser) setOutlookConfig(configs[importingUser] ?? DEFAULT_OUTLOOK_CONFIG);
                    }
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error('❌ [LOCALSTORAGE] Erreur parsing JSON:', error);
                }
            }

            // 2. Thème depuis clé dédiée (par poste, hors fichier partagé)
            const rawTheme = localStorage.getItem('theme_settings');
            if (rawTheme) {
                try {
                    setThemeSettings(JSON.parse(rawTheme));
                    devLog('✅ [THEME] Thème chargé depuis clé dédiée');
                } catch {
                    devWarn('⚠️ [THEME] Erreur parsing theme_settings');
                }
            } else if (raw) {
                // Migration one-time depuis l'ancien payload
                try {
                    const oldParsed = JSON.parse(raw) as StoredDataRaw;
                    if (oldParsed.themeSettings) {
                        setThemeSettings(oldParsed.themeSettings as Parameters<typeof setThemeSettings>[0]);
                        localStorage.setItem('theme_settings', JSON.stringify(oldParsed.themeSettings));
                        devLog('✅ [THEME] Thème migré depuis ancien payload');
                    }
                } catch { /* silencieux */ }
            }

            // 3. Utilisateur courant
            devLog('👤 [USER] Utilisateur sauvegardé:', savedUserId || 'AUCUN');
            if (importingUser) {
                setCurrentUser(importingUser);
            } else if (savedUserId) {
                devLog('⚠️ [USER] ID invalide (ancien?), forcer reconnexion');
                localStorage.removeItem('current_user_id');
                setCurrentUser(null);
            }

            // 4. Electron — lecture data.json + comments.json
            if (window.electronAPI?.isElectron) {
                devLog('✅ [ELECTRON] Environnement Electron détecté');
                try {
                    let savedPath = localStorage.getItem('storage_path');
                    if (!savedPath) {
                        savedPath = await window.electronAPI.getStoragePath();
                        localStorage.setItem('storage_path', savedPath);
                    }
                    setStoragePath(savedPath);

                    const filePath = savedPath + '/data.json';
                    const commentsFilePath = savedPath + '/comments.json';
                    devLog('📄 [ELECTRON] Lecture data.json:', filePath);
                    const result = await window.electronAPI.readData(filePath);

                    if (result.success && result.data) {
                        devLog('✅ [ELECTRON] data.json lu avec succès');

                        if (result.data.tasks) {
                            const fileTasks: Task[] = result.data.tasks.map(
                                (t) => migrateTask(t, { fallbackUser: importingUser })
                            );
                            const merged = mergeTasksByUpdatedAt(localTasks, fileTasks);
                            devLog('✅ [ELECTRON] Tâches mergées:', merged.length);
                            setTasks(merged);
                        }
                        if (result.data.directories) setDirectories(result.data.directories);
                        if (result.data.projectHistory) setProjectHistory(result.data.projectHistory);
                        if (result.data.projectColors) setProjectColors(result.data.projectColors);
                        if (result.data.notificationSettings) setNotificationSettings(result.data.notificationSettings);
                        if (result.data.templates) setTemplates((result.data.templates as unknown[]).map(migrateTemplate));
                        if (result.data.savedReports) setSavedReports(result.data.savedReports as SavedReport[]);
                        if (result.data.appNotifications) setAppNotifications(result.data.appNotifications as AppNotification[]);
                        if (result.data.timeEntries) {
                            setTimeEntries(result.data.timeEntries as TimeEntry[]);
                            refs.lastKnownFileTimeEntries.current = result.data.timeEntries as TimeEntry[];
                        }
                        // Chargement outlook par user (data.json est la source de vérité)
                        {
                            const configs = (result.data.outlookConfigs ?? {}) as Record<string, OutlookConfig>;
                            // Migration one-time : si outlookConfig global existait, l'attribuer au user courant
                            if (result.data.outlookConfig && importingUser && !configs[importingUser]) {
                                configs[importingUser] = result.data.outlookConfig as OutlookConfig;
                            }
                            setOutlookConfigs(configs);
                            if (importingUser) setOutlookConfig(configs[importingUser] ?? DEFAULT_OUTLOOK_CONFIG);
                        }
                        // Note: themeSettings ignoré (clé dédiée 'theme_settings')

                        // Hash initial de data.json
                        const hashResult = await window.electronAPI.getFileHash(filePath);
                        if (hashResult.success) refs.lastFileHash.current = hashResult.hash;

                        // Chargement des commentaires depuis comments.json (fichier dédié)
                        try {
                            const commentsResult = await window.electronAPI.readData(commentsFilePath);
                            if (commentsResult.success && commentsResult.data.comments) {
                                devLog('✅ [ELECTRON] Comments chargés depuis comments.json');
                                setComments(commentsResult.data.comments);
                            } else if (result.data.comments) {
                                // Migration one-time : data.json → comments.json
                                devLog('🔄 [MIGRATION] Comments migrés data.json → comments.json');
                                setComments(result.data.comments);
                                await window.electronAPI.saveData(commentsFilePath, { comments: result.data.comments });
                            }
                            const chash = await window.electronAPI.getFileHash(commentsFilePath);
                            if (chash.success) refs.lastCommentsHash.current = chash.hash;
                        } catch {
                            devWarn('⚠️ [COMMENTS] Erreur comments.json, fallback data.json');
                            if (result.data.comments) setComments(result.data.comments);
                        }

                    } else {
                        // Fichiers inexistants → initialisation
                        devLog('📝 [ELECTRON] Fichier inexistant, initialisation...');
                        const initialData = {
                            tasks: [],
                            directories: {},
                            projectHistory: [],
                            projectColors: {},
                            notificationSettings,
                        };
                        await window.electronAPI.saveData(filePath, initialData);
                        await window.electronAPI.saveData(commentsFilePath, { comments: {} });

                        const hashResult = await window.electronAPI.getFileHash(filePath);
                        if (hashResult.success) refs.lastFileHash.current = hashResult.hash;
                        const commentsHash = await window.electronAPI.getFileHash(commentsFilePath);
                        if (commentsHash.success) refs.lastCommentsHash.current = commentsHash.hash;
                    }
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error('❌ [ELECTRON] Erreur chargement initial:', error);
                }
            }

            devLog('🏁 [DATA LOADING] Chargement terminé, setIsLoadingData(false)');
            setIsLoadingData(false);
        }

        devLog('🎬 [DATA LOADING] Lancement de initStorage()');
        initStorage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run on mount only - store setters are stable
}
