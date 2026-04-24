import { useEffect } from 'react';
import { STORAGE_KEY } from '../../constants';
import type { TimeEntry } from '../../types';
import { devError, devLog } from '../../utils';
import { type PersistenceRefs, type StoreSnapshot } from './persistence.utils';

/** Sauvegarde debounced : localStorage + Electron data.json + comments.json + thème + utilisateur courant */
export function usePersistSave(refs: PersistenceRefs, store: StoreSnapshot) {
    const {
        tasks, directories, projectHistory, projectColors, notificationSettings,
        themeSettings, comments, templates, savedReports, appNotifications,
        timeEntries, outlookConfigs, currentUser, storagePath, isLoadingData, setSaveError,
    } = store;

    // ─── Sauvegarde localStorage (full payload pour fallback web) ─────────────
    useEffect(() => {
        if (isLoadingData) return;
        const fullPayload = { tasks, directories, projectHistory, projectColors, notificationSettings, comments, templates, savedReports, appNotifications, timeEntries, outlookConfigs };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fullPayload));
    }, [tasks, directories, projectHistory, projectColors, notificationSettings, comments, templates, savedReports, appNotifications, timeEntries, outlookConfigs, isLoadingData]);

    // ─── Sauvegarde Electron data.json (sans commentaires, debounce 100ms) ────
    useEffect(() => {
        if (isLoadingData) return;
        const timer = setTimeout(async () => {
            if (window.electronAPI?.isElectron && storagePath) {
                try {
                    const filePath = storagePath + '/data.json';
                    // Merger les timeEntries locaux avec le dernier état connu du fichier
                    // pour ne jamais écraser les entrées d'autres utilisateurs non encore rechargées
                    let safeTimeEntries: TimeEntry[] = timeEntries;
                    if (refs.lastKnownFileTimeEntries.current.length > 0) {
                        const byId = new Map<string, TimeEntry>();
                        for (const e of refs.lastKnownFileTimeEntries.current) byId.set(e.id, e);
                        for (const e of timeEntries) {
                            const existing = byId.get(e.id);
                            if (!existing || e.updatedAt >= existing.updatedAt) byId.set(e.id, e);
                        }
                        safeTimeEntries = Array.from(byId.values());
                    }
                    refs.lastKnownFileTimeEntries.current = safeTimeEntries;
                    const dataPayload = { tasks, directories, projectHistory, projectColors, notificationSettings, templates, savedReports, appNotifications, timeEntries: safeTimeEntries, outlookConfigs };
                    devLog('💾 [SAVE] data.json...');
                    const saveResult = await window.electronAPI.saveData(filePath, dataPayload);
                    if (saveResult && !saveResult.success) {
                        throw new Error(saveResult.error || 'Sauvegarde échouée');
                    }
                    setSaveError(null);
                    const newHash = await window.electronAPI.getFileHash(filePath);
                    if (newHash?.success) refs.lastFileHash.current = newHash.hash;
                } catch (error) {
                    devError('Save data.json error', error);
                    setSaveError('Échec de la sauvegarde sur le lecteur réseau. Vos données sont sauvegardées localement.');
                }
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [tasks, directories, projectHistory, projectColors, notificationSettings, templates, savedReports, appNotifications, timeEntries, outlookConfigs, storagePath, isLoadingData, setSaveError]);

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
                    if (newHash?.success) refs.lastCommentsHash.current = newHash.hash;
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
