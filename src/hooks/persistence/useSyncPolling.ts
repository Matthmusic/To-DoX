import { useEffect } from 'react';
import type { AppNotification, Comment, SavedReport, Task, TimeEntry } from '../../types';
import useStore from '../../store/useStore';
import { devLog } from '../../utils';
import { migrateTask } from '../../utils/taskMigration';
import { mergeTasksByUpdatedAt } from '../../utils/taskMigration';
import { mergeComments, migrateTemplate, type PersistenceRefs, type StoreSnapshot } from './persistence.utils';

/** Auto-reload : poll data.json + comments.json toutes les 2 s, merge si hash différent */
export function useSyncPolling(refs: PersistenceRefs, store: StoreSnapshot) {
    const { storagePath, isLoadingData, currentUser } = store;

    useEffect(() => {
        if (!window.electronAPI?.isElectron || !storagePath || isLoadingData) return;

        const interval = setInterval(async () => {
            try {
                const filePath = storagePath + '/data.json';
                const commentsFilePath = storagePath + '/comments.json';

                // Setters lus depuis getState() : stables, pas besoin de deps
                const {
                    setTasks, setDirectories, setProjectHistory, setProjectColors,
                    setNotificationSettings, setComments, setTemplates, setSavedReports,
                    setAppNotifications, setTimeEntries,
                } = useStore.getState();

                // --- data.json ---
                const hashResult = await window.electronAPI?.getFileHash(filePath);
                if (hashResult?.success && hashResult.hash && hashResult.hash !== refs.lastFileHash.current) {
                    devLog('📥 [AUTO-RELOAD] data.json modifié, rechargement...');
                    refs.lastFileHash.current = hashResult.hash;

                    const result = await window.electronAPI?.readData(filePath);
                    if (result?.success && result.data) {
                        if (result.data.tasks) {
                            const fileTasks: Task[] = result.data.tasks.map(
                                (t) => migrateTask(t, { fallbackUser: currentUser })
                            );
                            setTasks(mergeTasksByUpdatedAt(useStore.getState().tasks, fileTasks));
                        }
                        if (result.data.directories) setDirectories(result.data.directories);
                        if (result.data.projectHistory) setProjectHistory(result.data.projectHistory);
                        if (result.data.projectColors) setProjectColors(result.data.projectColors);
                        if (result.data.notificationSettings) setNotificationSettings(result.data.notificationSettings);
                        // Compat backward : merge les comments si un ancien client les a écrits dans data.json
                        if (result.data.comments) {
                            setComments(mergeComments(
                                useStore.getState().comments,
                                result.data.comments as Record<string, Comment[]>
                            ));
                        }
                        // Fusion timeEntries (union par id, plus récent gagne)
                        if (result.data.timeEntries) {
                            const localEntries = useStore.getState().timeEntries;
                            const fileEntries = result.data.timeEntries as TimeEntry[];
                            const byId = new Map<string, TimeEntry>();
                            for (const e of fileEntries) byId.set(e.id, e);
                            for (const e of localEntries) {
                                const existing = byId.get(e.id);
                                if (!existing || e.updatedAt > existing.updatedAt) byId.set(e.id, e);
                            }
                            const merged = Array.from(byId.values());
                            setTimeEntries(merged);
                            refs.lastKnownFileTimeEntries.current = merged;
                        }
                        // appNotifications : union par id (fichier prioritaire pour readAt)
                        if (result.data.appNotifications) {
                            const localNotifs = useStore.getState().appNotifications;
                            const fileNotifs = result.data.appNotifications as AppNotification[];
                            const byId = new Map(fileNotifs.map(n => [n.id, n]));
                            for (const n of localNotifs) if (!byId.has(n.id)) byId.set(n.id, n);
                            setAppNotifications(Array.from(byId.values()));
                        }
                        // templates et savedReports : fichier prioritaire (source de vérité partagée)
                        if (result.data.templates) setTemplates((result.data.templates as unknown[]).map(migrateTemplate));
                        if (result.data.savedReports) setSavedReports(result.data.savedReports as SavedReport[]);
                        devLog('✅ [AUTO-RELOAD] data.json rechargé');
                    }
                }

                // --- comments.json ---
                const commentsHashResult = await window.electronAPI?.getFileHash(commentsFilePath);
                if (
                    commentsHashResult?.success &&
                    commentsHashResult.hash &&
                    commentsHashResult.hash !== refs.lastCommentsHash.current
                ) {
                    devLog('💬 [AUTO-RELOAD] comments.json modifié, rechargement...');
                    refs.lastCommentsHash.current = commentsHashResult.hash;

                    const commentsResult = await window.electronAPI?.readData(commentsFilePath);
                    if (commentsResult?.success && commentsResult.data.comments) {
                        const { setComments: sc } = useStore.getState();
                        sc(mergeComments(
                            useStore.getState().comments,
                            commentsResult.data.comments as Record<string, Comment[]>
                        ));
                        devLog('✅ [AUTO-RELOAD] Comments rechargés');
                    }
                }

            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('❌ [AUTO-RELOAD] Erreur:', error);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [storagePath, isLoadingData, currentUser]);
}
