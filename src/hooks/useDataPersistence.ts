import { useEffect, useRef } from 'react';
import { STORAGE_KEY, FIXED_USERS } from '../constants';
import type { Comment, PendingMention, StoredData, Task } from '../types';
import useStore from '../store/useStore';
import { devError, devLog, devWarn } from '../utils';
import { mergeTasksByUpdatedAt, migrateTask } from '../utils/taskMigration';

type StoredDataRaw = Omit<StoredData, 'tasks'> & { tasks?: unknown[] };

/**
 * Merge deux états de commentaires (fichier vs local) avec soft-delete.
 * Règles :
 *  - Un commentaire local absent du fichier est conservé (pas encore sauvegardé)
 *  - Une suppression locale (deletedAt ≠ null) gagne sur la version non-supprimée du fichier
 *  - Le fichier a priorité dans tous les autres cas
 */
function mergeComments(
    local: Record<string, Comment[]>,
    fromFile: Record<string, Comment[]>
): Record<string, Comment[]> {
    const merged: Record<string, Comment[]> = { ...fromFile };
    for (const taskId of Object.keys(local)) {
        const file = fromFile[taskId] || [];
        const loc = local[taskId] || [];
        const byId = new Map<string, Comment>();
        for (const c of file) byId.set(c.id, c);
        for (const c of loc) {
            const existing = byId.get(c.id);
            if (!existing) {
                byId.set(c.id, c); // commentaire local pas encore dans le fichier
            } else if (c.deletedAt !== null && existing.deletedAt === null) {
                byId.set(c.id, c); // suppression locale gagne
            }
        }
        merged[taskId] = Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt);
    }
    return merged;
}

/**
 * Hook pour gérer la persistance des données (localStorage + Electron)
 * Avec auto-reload et détection de conflits multi-utilisateurs.
 *
 * Fichiers Electron :
 *   data.json     — tâches, répertoires, historique, paramètres, pendingMentions
 *   comments.json — commentaires uniquement (hash indépendant pour sync rapide)
 */
export function useDataPersistence() {
    const {
        tasks,
        directories,
        projectHistory,
        projectColors,
        notificationSettings,
        themeSettings,
        comments,
        pendingMentions,
        currentUser,
        storagePath,
        isLoadingData,
        setTasks,
        setDirectories,
        setProjectHistory,
        setProjectColors,
        setNotificationSettings,
        setThemeSettings,
        setComments,
        setPendingMentions,
        setUsers,
        setCurrentUser,
        setStoragePath,
        setIsLoadingData,
        setSaveError,
    } = useStore();

    const lastFileHash = useRef<string | null>(null);
    const lastCommentsHash = useRef<string | null>(null);

    // ─── Chargement initial ────────────────────────────────────────────────────
    useEffect(() => {
        async function initStorage() {
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
                    if (parsed.pendingMentions) setPendingMentions(parsed.pendingMentions);
                } catch (error) {
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
            } else {
                // Migration one-time depuis l'ancien payload
                if (raw) {
                    try {
                        const oldParsed = JSON.parse(raw) as StoredDataRaw;
                        if (oldParsed.themeSettings) {
                            setThemeSettings(oldParsed.themeSettings as Parameters<typeof setThemeSettings>[0]);
                            localStorage.setItem('theme_settings', JSON.stringify(oldParsed.themeSettings));
                            devLog('✅ [THEME] Thème migré depuis ancien payload');
                        }
                    } catch { /* silencieux */ }
                }
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
                        if (result.data.pendingMentions) setPendingMentions(result.data.pendingMentions);
                        // Note: themeSettings ignoré (clé dédiée 'theme_settings')

                        // Hash initial de data.json
                        const hashResult = await window.electronAPI.getFileHash(filePath);
                        if (hashResult.success) lastFileHash.current = hashResult.hash;

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
                            if (chash.success) lastCommentsHash.current = chash.hash;
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
                        if (hashResult.success) lastFileHash.current = hashResult.hash;
                        const commentsHash = await window.electronAPI.getFileHash(commentsFilePath);
                        if (commentsHash.success) lastCommentsHash.current = commentsHash.hash;
                    }
                } catch (error) {
                    console.error('❌ [ELECTRON] Erreur chargement initial:', error);
                    devError('Initial load error:', error);
                }
            }

            devLog('🏁 [DATA LOADING] Chargement terminé, setIsLoadingData(false)');
            setIsLoadingData(false);
        }

        devLog('🎬 [DATA LOADING] Lancement de initStorage()');
        initStorage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run on mount only - store setters are stable

    // ─── Auto-reload (poll data.json + comments.json toutes les 2 s) ──────────
    useEffect(() => {
        if (!window.electronAPI?.isElectron || !storagePath || isLoadingData) return;

        const interval = setInterval(async () => {
            try {
                const filePath = storagePath + '/data.json';
                const commentsFilePath = storagePath + '/comments.json';

                // --- data.json ---
                const hashResult = await window.electronAPI?.getFileHash(filePath);
                if (hashResult?.success && hashResult.hash && hashResult.hash !== lastFileHash.current) {
                    devLog('📥 [AUTO-RELOAD] data.json modifié, rechargement...');
                    lastFileHash.current = hashResult.hash;

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
                        if (result.data.pendingMentions) {
                            const localMentions = useStore.getState().pendingMentions;
                            const fileMentions = result.data.pendingMentions as Record<string, PendingMention[]>;
                            const mergedM: Record<string, PendingMention[]> = { ...fileMentions };
                            for (const userId of Object.keys(localMentions)) {
                                const fromFile = fileMentions[userId] || [];
                                const fromLocal = localMentions[userId] || [];
                                const byId = new Map<string, PendingMention>();
                                for (const m of fromFile) byId.set(m.commentId, m);
                                for (const m of fromLocal) if (!byId.has(m.commentId)) byId.set(m.commentId, m);
                                mergedM[userId] = Array.from(byId.values());
                            }
                            setPendingMentions(mergedM);
                        }
                        devLog('✅ [AUTO-RELOAD] data.json rechargé');
                    }
                }

                // --- comments.json ---
                const commentsHashResult = await window.electronAPI?.getFileHash(commentsFilePath);
                if (
                    commentsHashResult?.success &&
                    commentsHashResult.hash &&
                    commentsHashResult.hash !== lastCommentsHash.current
                ) {
                    devLog('💬 [AUTO-RELOAD] comments.json modifié, rechargement...');
                    lastCommentsHash.current = commentsHashResult.hash;

                    const commentsResult = await window.electronAPI?.readData(commentsFilePath);
                    if (commentsResult?.success && commentsResult.data.comments) {
                        setComments(mergeComments(
                            useStore.getState().comments,
                            commentsResult.data.comments as Record<string, Comment[]>
                        ));
                        devLog('✅ [AUTO-RELOAD] Comments rechargés');
                    }
                }

            } catch (error) {
                console.error('❌ [AUTO-RELOAD] Erreur:', error);
                devError('Auto-reload error:', error);
            }
        }, 2000);

        return () => clearInterval(interval);
        // setUsers retiré car on utilise FIXED_USERS
    }, [storagePath, isLoadingData, currentUser, setTasks, setDirectories, setProjectHistory, setProjectColors, setNotificationSettings]);

    // ─── Sauvegarde localStorage (full payload pour fallback web) ─────────────
    useEffect(() => {
        if (isLoadingData) return;
        const fullPayload = { tasks, directories, projectHistory, projectColors, notificationSettings, pendingMentions, comments };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fullPayload));
    }, [tasks, directories, projectHistory, projectColors, notificationSettings, pendingMentions, comments, isLoadingData]);

    // ─── Sauvegarde Electron data.json (sans commentaires, debounce 100ms) ────
    useEffect(() => {
        if (isLoadingData) return;
        const timer = setTimeout(async () => {
            if (window.electronAPI?.isElectron && storagePath) {
                try {
                    const filePath = storagePath + '/data.json';
                    const dataPayload = { tasks, directories, projectHistory, projectColors, notificationSettings, pendingMentions };
                    devLog('💾 [SAVE] data.json...');
                    const saveResult = await window.electronAPI.saveData(filePath, dataPayload);
                    if (saveResult && !saveResult.success) {
                        throw new Error(saveResult.error || 'Sauvegarde échouée');
                    }
                    setSaveError(null);
                    const newHash = await window.electronAPI.getFileHash(filePath);
                    if (newHash?.success) lastFileHash.current = newHash.hash;
                } catch (error) {
                    devError('Save data.json error', error);
                    setSaveError('Échec de la sauvegarde sur le lecteur réseau. Vos données sont sauvegardées localement.');
                }
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [tasks, directories, projectHistory, projectColors, notificationSettings, pendingMentions, storagePath, isLoadingData, setSaveError]);

    // ─── Sauvegarde Electron comments.json (fichier dédié, debounce 100ms) ───
    useEffect(() => {
        if (isLoadingData) return;
        const timer = setTimeout(async () => {
            if (window.electronAPI?.isElectron && storagePath) {
                try {
                    const commentsFilePath = storagePath + '/comments.json';
                    const saveResult = await window.electronAPI.saveData(commentsFilePath, { comments });
                    if (saveResult && !saveResult.success) {
                        throw new Error(saveResult.error || 'Sauvegarde commentaires échouée');
                    }
                    const newHash = await window.electronAPI.getFileHash(commentsFilePath);
                    if (newHash?.success) lastCommentsHash.current = newHash.hash;
                    devLog('💾 [SAVE] comments.json sauvegardé');
                } catch (error) {
                    devError('Save comments.json error', error);
                }
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [comments, storagePath, isLoadingData]);

    // ─── Thème local (par poste, hors fichier partagé) ───────────────────────
    useEffect(() => {
        if (isLoadingData) return;
        localStorage.setItem('theme_settings', JSON.stringify(themeSettings));
    }, [themeSettings, isLoadingData]);

    // ─── Utilisateur courant ──────────────────────────────────────────────────
    useEffect(() => {
        if (currentUser) {
            localStorage.setItem('current_user_id', currentUser);
        } else {
            localStorage.removeItem('current_user_id');
        }
    }, [currentUser]);
}
