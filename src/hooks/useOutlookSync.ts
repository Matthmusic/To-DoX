import { useEffect, useRef, useState } from 'react';
import useStore from '../store/useStore';
import { parseIcs } from '../utils/icsParser';
import { generateIcs } from '../utils/icsGenerator';
import { devLog, devWarn } from '../utils';

const FETCH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const EXPORT_DEBOUNCE_MS = 2000;          // 2 secondes

/**
 * Hook qui orchestre la synchronisation Outlook ↔ To-DoX :
 *  - Lecture  : fetch l'URL ICS au montage + toutes les 15 min
 *  - Écriture : régénère todox-tasks.ics (user connecté, si exportEnabled)
 *               régénère todox-tasks-view.ics (user consulté, toujours en mode consultation)
 *
 * Expose `icsExportPath` pour affichage dans OutlookPanel,
 * et `icsViewPath` utilisé dans TimelineView quand isReadOnly.
 */
export function useOutlookSync() {
    const {
        tasks,
        storagePath,
        outlookConfig,
        currentUser,
        viewAsUser,
        setOutlookEvents,
        setOutlookConfig,
    } = useStore();

    const [icsExportPath, setIcsExportPath] = useState<string | null>(null);
    const [icsViewPath, setIcsViewPath] = useState<string | null>(null);
    const [icsServerUrl, setIcsServerUrl] = useState<string | null>(null);
    const exportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const viewExportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    // ─── Résoudre le chemin ICS au montage ────────────────────────────────────
    useEffect(() => {
        if (!window.electronAPI?.isElectron || !storagePath) return;
        window.electronAPI.outlook.getIcsPath(storagePath).then(res => {
            if (res.success && res.path) setIcsExportPath(res.path);
        });
    }, [storagePath]);

    // ─── Fetch ICS entrant (Outlook → To-DoX) ─────────────────────────────────
    async function fetchOutlookEvents() {
        if (!outlookConfig.enabled || !outlookConfig.icsUrl) return;

        devLog('📅 [OUTLOOK] Fetch ICS:', outlookConfig.icsUrl);

        try {
            let icsData: string | null = null;

            if (window.electronAPI?.isElectron) {
                const res = await window.electronAPI.outlook.fetchUrl(outlookConfig.icsUrl);
                if (res.success && res.data) {
                    icsData = res.data;
                } else {
                    devWarn('⚠️ [OUTLOOK] Fetch échoué:', res.error);
                    return; // Conserver les derniers events — ne pas vider
                }
            } else {
                // Web mode : fetch direct (CORS permissif sur certaines URLs ICS)
                const response = await fetch(outlookConfig.icsUrl);
                if (!response.ok) {
                    devWarn('⚠️ [OUTLOOK] Fetch HTTP error:', response.status);
                    return;
                }
                icsData = await response.text();
            }

            if (icsData && isMounted.current) {
                const events = parseIcs(icsData);
                setOutlookEvents(events);
                setOutlookConfig({ lastSync: Date.now() });
                devLog(`✅ [OUTLOOK] ${events.length} événements importés`);
            }
        } catch (err) {
            devWarn('⚠️ [OUTLOOK] Erreur fetch:', err);
            // Conserver les derniers events en mémoire si le fetch échoue
        }
    }

    // Fetch au montage + interval 15 min
    useEffect(() => {
        if (!outlookConfig.enabled || !outlookConfig.icsUrl) return;

        fetchOutlookEvents();
        const interval = setInterval(fetchOutlookEvents, FETCH_INTERVAL_MS);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [outlookConfig.enabled, outlookConfig.icsUrl]);

    // Vider les events si désactivé
    useEffect(() => {
        if (!outlookConfig.enabled) {
            setOutlookEvents([]);
        }
    }, [outlookConfig.enabled, setOutlookEvents]);

    // ─── Export ICS personnel (user connecté → todox-tasks.ics) ───────────────
    // Seulement si exportEnabled. Toujours basé sur currentUser (calendrier perso).
    useEffect(() => {
        if (!outlookConfig.exportEnabled || !storagePath) return;
        if (!window.electronAPI?.isElectron) return;

        if (exportTimer.current) clearTimeout(exportTimer.current);

        exportTimer.current = setTimeout(async () => {
            try {
                const pathRes = await window.electronAPI!.outlook.getIcsPath(storagePath);
                if (!pathRes.success || !pathRes.path) return;

                const icsContent = generateIcs(tasks, currentUser);
                const writeRes = await window.electronAPI!.outlook.writeIcs(pathRes.path, icsContent);

                if (writeRes.success) {
                    devLog('💾 [OUTLOOK] todox-tasks.ics exporté (user connecté):', pathRes.path);
                    if (isMounted.current) setIcsExportPath(pathRes.path);
                } else {
                    devWarn('⚠️ [OUTLOOK] Erreur écriture ICS:', writeRes.error);
                }
            } catch (err) {
                devWarn('⚠️ [OUTLOOK] Erreur export ICS:', err);
            }
        }, EXPORT_DEBOUNCE_MS);

        return () => {
            if (exportTimer.current) clearTimeout(exportTimer.current);
        };
    }, [tasks, currentUser, outlookConfig.exportEnabled, storagePath]);

    // ─── Export ICS consultation (user consulté → todox-tasks-view.ics) ────────
    // Actif dès qu'on bascule en mode consultation, sans condition exportEnabled.
    // Fichier séparé pour ne pas écraser le calendrier perso du user connecté.
    useEffect(() => {
        const isConsultation = !!viewAsUser && viewAsUser !== currentUser;

        if (!isConsultation || !storagePath || !window.electronAPI?.isElectron) {
            setIcsViewPath(null);
            return;
        }

        if (viewExportTimer.current) clearTimeout(viewExportTimer.current);

        viewExportTimer.current = setTimeout(async () => {
            try {
                const viewIcsPath = storagePath + '/todox-tasks-view.ics';
                const icsContent = generateIcs(tasks, viewAsUser);
                const writeRes = await window.electronAPI!.outlook.writeIcs(viewIcsPath, icsContent);

                if (writeRes.success) {
                    devLog('💾 [OUTLOOK] todox-tasks-view.ics exporté (vue consultation):', viewIcsPath);
                    if (isMounted.current) setIcsViewPath(viewIcsPath);
                } else {
                    devWarn('⚠️ [OUTLOOK] Erreur écriture ICS vue:', writeRes.error);
                }
            } catch (err) {
                devWarn('⚠️ [OUTLOOK] Erreur export ICS vue:', err);
            }
        }, EXPORT_DEBOUNCE_MS);

        return () => {
            if (viewExportTimer.current) clearTimeout(viewExportTimer.current);
        };
    }, [tasks, currentUser, viewAsUser, storagePath]);

    // ─── Serveur HTTP local pour abonnement live Outlook ──────────────────────
    useEffect(() => {
        if (!outlookConfig.exportEnabled || !icsExportPath) {
            // Arrêter le serveur si désactivé
            if (window.electronAPI?.isElectron) {
                window.electronAPI.outlook.stopHttpServer().catch(() => {});
            }
            setIcsServerUrl(null);
            return;
        }
        if (!window.electronAPI?.isElectron) return;

        window.electronAPI.outlook.startHttpServer(icsExportPath).then(res => {
            if (res.success && res.url && isMounted.current) {
                setIcsServerUrl(res.url);
                devLog('🌐 [OUTLOOK] Serveur HTTP ICS démarré:', res.url);
            } else if (!res.success) {
                devWarn('⚠️ [OUTLOOK] Impossible de démarrer le serveur HTTP:', res.error);
            }
        });

        return () => {
            window.electronAPI?.outlook.stopHttpServer().catch(() => {});
            if (isMounted.current) setIcsServerUrl(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [outlookConfig.exportEnabled, icsExportPath]);

    return { fetchOutlookEvents, icsExportPath, icsViewPath, icsServerUrl };
}
