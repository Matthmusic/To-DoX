import { useEffect, useRef } from 'react';
import { STORAGE_KEY, FIXED_USERS } from '../constants';
import type { StoredData, Task } from '../types';
import useStore from '../store/useStore';
import { devError, devLog, devWarn } from '../utils';
import { mergeTasksByUpdatedAt, migrateTask } from '../utils/taskMigration';

type StoredDataRaw = Omit<StoredData, 'tasks'> & { tasks?: unknown[] };

/**
 * Hook pour gérer la persistance des données (localStorage + Electron)
 * Avec auto-reload et détection de conflits multi-utilisateurs
 */
export function useDataPersistence() {
    const {
        tasks,
        directories,
        projectHistory,
        projectColors,
        notificationSettings,
        themeSettings,
        // users retiré car on utilise FIXED_USERS maintenant
        currentUser,
        storagePath,
        isLoadingData,
        setTasks,
        setDirectories,
        setProjectHistory,
        setProjectColors,
        setNotificationSettings,
        setThemeSettings,
        setUsers, // Gardé pour initialisation avec FIXED_USERS
        setCurrentUser,
        setStoragePath,
        setIsLoadingData,
        setSaveError,
    } = useStore();

    // Stocker le hash du fichier pour détecter les modifications externes
    const lastFileHash = useRef<string | null>(null);

    // Chargement initial des données
    useEffect(() => {
        async function initStorage() {
            devLog('🚀 [DATA LOADING] Début du chargement des données...');

            // Initialiser les utilisateurs avec la liste fixe
            devLog('👥 [USERS] Initialisation avec la liste fixe:', FIXED_USERS.length, 'utilisateurs');
            setUsers(FIXED_USERS);

            // Récupérer l'utilisateur courant dès le début pour la migration des anciennes tâches
            const savedUserId = localStorage.getItem('current_user_id');
            const importingUser = (savedUserId && FIXED_USERS.some(u => u.id === savedUserId)) ? savedUserId : null;

            // Tâches chargées depuis le localStorage (utilisées comme base pour le merge avec Electron)
            let localTasks: Task[] = [];

            // Load from LocalStorage fallback first
            const raw = localStorage.getItem(STORAGE_KEY);
            devLog('📦 [LOCALSTORAGE] Clé de stockage:', STORAGE_KEY);
            devLog('📦 [LOCALSTORAGE] Données brutes trouvées:', raw ? `${raw.length} caractères` : 'AUCUNE');

            if (raw) {
                try {
                    devLog('🔄 [LOCALSTORAGE] Tentative de parsing JSON...');
                    const parsed = JSON.parse(raw) as StoredDataRaw;
                    devLog('✅ [LOCALSTORAGE] JSON parsé avec succès:', {
                        hasTasks: !!parsed.tasks,
                        tasksCount: parsed.tasks?.length || 0,
                        hasDirectories: !!parsed.directories,
                        hasProjectHistory: !!parsed.projectHistory,
                        hasProjectColors: !!parsed.projectColors,
                        hasUsers: !!parsed.users
                    });
                    devLog('⚠️ [LOCALSTORAGE] Note: Les users du localStorage sont ignorés, on utilise FIXED_USERS');

                    if (parsed.tasks) {
                        localTasks = parsed.tasks.map((t) => migrateTask(t, { fallbackUser: importingUser }));
                        devLog('✅ [LOCALSTORAGE] Tâches migrées:', localTasks.length);
                        setTasks(localTasks);
                    }
                    if (parsed.directories) {
                        devLog('✅ [LOCALSTORAGE] Directories chargés');
                        setDirectories(parsed.directories);
                    }
                    if (parsed.projectHistory) {
                        devLog('✅ [LOCALSTORAGE] Project history chargé:', parsed.projectHistory.length);
                        setProjectHistory(parsed.projectHistory);
                    }
                    if (parsed.projectColors) {
                        devLog('✅ [LOCALSTORAGE] Project colors chargés');
                        setProjectColors(parsed.projectColors);
                    }
                    if (parsed.notificationSettings) {
                        devLog('✅ [LOCALSTORAGE] Notification settings chargés');
                        setNotificationSettings(parsed.notificationSettings);
                    }
                    if (parsed.themeSettings) {
                        devLog('✅ [LOCALSTORAGE] Theme settings chargés');
                        setThemeSettings(parsed.themeSettings);
                    }
                    // Note: On ignore parsed.users car on utilise FIXED_USERS
                } catch (error) {
                    console.error('❌ [LOCALSTORAGE] Erreur lors du parsing JSON:', error);
                }
            }

            // Charger l'utilisateur courant depuis localStorage (déjà lu au début pour la migration)
            devLog('👤 [USER] Utilisateur sauvegardé:', savedUserId || 'AUCUN');
            if (importingUser) {
                setCurrentUser(importingUser);
            } else if (savedUserId) {
                // ID trouvé mais pas dans FIXED_USERS
                devLog('⚠️ [USER] Utilisateur sauvegardé invalide (ancien ID?), forcer reconnexion');
                localStorage.removeItem('current_user_id');
                setCurrentUser(null);
            }

            // Electron Load
            devLog('🖥️ [ELECTRON] Vérification environnement Electron...');
            devLog('🖥️ [ELECTRON] isElectron:', window.electronAPI?.isElectron || false);

            if (window.electronAPI?.isElectron) {
                devLog('✅ [ELECTRON] Environnement Electron détecté');
                try {
                    let savedPath = localStorage.getItem('storage_path');
                    devLog('📂 [ELECTRON] Storage path sauvegardé:', savedPath || 'AUCUN');

                    if (!savedPath) {
                        devLog('📂 [ELECTRON] Récupération du storage path depuis Electron...');
                        savedPath = await window.electronAPI.getStoragePath();
                        devLog('📂 [ELECTRON] Storage path reçu:', savedPath);
                        localStorage.setItem('storage_path', savedPath);
                    }
                    setStoragePath(savedPath);

                    const filePath = savedPath + '/data.json';
                    devLog('📄 [ELECTRON] Chemin du fichier:', filePath);
                    devLog('📄 [ELECTRON] Tentative de lecture du fichier...');
                    const result = await window.electronAPI.readData(filePath);
                    devLog('📄 [ELECTRON] Résultat de la lecture:', {
                        success: result?.success,
                        hasData: !!result?.data,
                        dataKeys: result?.data ? Object.keys(result.data) : []
                    });

                    if (result.success && result.data) {
                        devLog('✅ [ELECTRON] Fichier lu avec succès');
                        if (result.data.tasks) {
                            devLog('🔄 [ELECTRON] Migration + merge des tâches...');
                            const fileTasks: Task[] = result.data.tasks.map((t) => migrateTask(t, { fallbackUser: importingUser }));
                            // Merger avec les tâches du localStorage — ne rien perdre
                            const merged = mergeTasksByUpdatedAt(localTasks, fileTasks);
                            devLog('✅ [ELECTRON] Tâches mergées:', merged.length, '(localStorage:', localTasks.length, '+ fichier:', fileTasks.length, ')');
                            setTasks(merged);
                        }
                        if (result.data.directories) {
                            devLog('✅ [ELECTRON] Directories chargés');
                            setDirectories(result.data.directories);
                        }
                        if (result.data.projectHistory) {
                            devLog('✅ [ELECTRON] Project history chargé:', result.data.projectHistory.length);
                            setProjectHistory(result.data.projectHistory);
                        }
                        if (result.data.projectColors) {
                            devLog('✅ [ELECTRON] Project colors chargés');
                            setProjectColors(result.data.projectColors);
                        }
                        if (result.data.notificationSettings) {
                            devLog('✅ [ELECTRON] Notification settings chargés');
                            setNotificationSettings(result.data.notificationSettings);
                        }
                        if (result.data.themeSettings) {
                            devLog('✅ [ELECTRON] Theme settings chargés');
                            setThemeSettings(result.data.themeSettings);
                        }
                        // Note: On ignore result.data.users car on utilise FIXED_USERS
                        if (result.data.users) {
                            devLog('⚠️ [ELECTRON] Users trouvés dans le fichier mais ignorés (on utilise FIXED_USERS)');
                        }

                        // Stocker le hash initial du fichier
                        try {
                            const hashResult = await window.electronAPI.getFileHash(filePath);
                            if (hashResult.success) {
                                lastFileHash.current = hashResult.hash;
                            }
                        } catch (hashError) {
                            devWarn('⚠️ [HASH] Erreur lors du calcul du hash (non-critique):', hashError);
                            devError('Hash error (non-critical):', hashError);
                        }
                    } else if (!result.success) {
                        // Fichier n'existe pas ou erreur de lecture - créer un fichier vide
                        devLog('📝 [ELECTRON] Fichier inexistant ou erreur de lecture');
                        devLog('📝 [ELECTRON] Initialisation du fichier de données...');
                        const initialData = {
                            tasks: [],
                            directories: {},
                            projectHistory: [],
                            projectColors: {},
                            notificationSettings: notificationSettings
                            // Note: users n'est plus sauvegardé dans le fichier, on utilise FIXED_USERS
                        };
                        devLog('💾 [ELECTRON] Sauvegarde des données initiales...');
                        await window.electronAPI.saveData(filePath, initialData);
                        devLog('✅ [ELECTRON] Fichier créé avec succès');

                        // Stocker le hash du nouveau fichier
                        try {
                            const hashResult = await window.electronAPI.getFileHash(filePath);
                            if (hashResult.success) {
                                lastFileHash.current = hashResult.hash;
                            }
                        } catch (hashError) {
                            devWarn('⚠️ [HASH] Erreur lors du calcul du hash (non-critique):', hashError);
                            devError('Hash error (non-critical):', hashError);
                        }
                    }
                } catch (error) {
                    console.error('❌ [ELECTRON] Erreur lors du chargement initial:', error);
                    devError('Initial load error:', error);
                }
            } else {
                devLog('ℹ️ [ELECTRON] Pas d\'environnement Electron détecté, mode web uniquement');
            }

            // TOUJOURS terminer le chargement, même en cas d'erreur
            devLog('🏁 [DATA LOADING] Chargement terminé, setIsLoadingData(false)');
            setIsLoadingData(false);
        }
        devLog('🎬 [DATA LOADING] Lancement de initStorage()');
        initStorage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run on mount only - store setters are stable

    // Auto-reload toutes les 10 secondes (détection des changements des autres utilisateurs)
    useEffect(() => {
        if (!window.electronAPI?.isElectron || !storagePath || isLoadingData) return;

        const interval = setInterval(async () => {
            try {
                devLog('🔄 [AUTO-RELOAD] Vérification des changements...');
                const filePath = storagePath + '/data.json';

                // Vérifier si le fichier a changé
                const hashResult = await window.electronAPI?.getFileHash(filePath);
                devLog('🔍 [AUTO-RELOAD] Hash check:', {
                    success: hashResult?.success,
                    currentHash: hashResult?.hash?.substring(0, 8),
                    lastHash: lastFileHash.current?.substring(0, 8),
                    hasChanged: hashResult?.hash !== lastFileHash.current
                });

                if (!hashResult?.success) {
                    devWarn('⚠️ [AUTO-RELOAD] Échec de récupération du hash');
                    return;
                }

                // Si le hash est différent, le fichier a été modifié par quelqu'un d'autre
                if (hashResult.hash && hashResult.hash !== lastFileHash.current) {
                    devLog('📥 [AUTO-RELOAD] Fichier modifié détecté! Rechargement...');

                    // IMPORTANT: Mettre à jour le hash AVANT de recharger les données
                    // Cela évite que la sauvegarde automatique détecte un faux conflit
                    const oldHash = lastFileHash.current;
                    lastFileHash.current = hashResult.hash;
                    devLog('📝 [AUTO-RELOAD] Hash mis à jour AVANT rechargement:', oldHash?.substring(0, 20), '->', hashResult.hash.substring(0, 20));

                    const result = await window.electronAPI?.readData(filePath);
                    if (result && result.success && result.data) {
                        devLog('✅ [AUTO-RELOAD] Données rechargées:', {
                            tasksCount: result.data.tasks?.length || 0
                        });
                        if (result.data.tasks) {
                            // Migration + merge: ne jamais perdre de tâches
                            const fileTasks: Task[] = result.data.tasks.map((t) => migrateTask(t, { fallbackUser: currentUser }));
                            // Merger avec les tâches actuelles du store
                            const currentTasks = useStore.getState().tasks;
                            setTasks(mergeTasksByUpdatedAt(currentTasks, fileTasks));
                        }
                        if (result.data.directories) setDirectories(result.data.directories);
                        if (result.data.projectHistory) setProjectHistory(result.data.projectHistory);
                        if (result.data.projectColors) setProjectColors(result.data.projectColors);
                        if (result.data.notificationSettings) setNotificationSettings(result.data.notificationSettings);
                        if (result.data.themeSettings) setThemeSettings(result.data.themeSettings);
                        // Note: On ignore result.data.users car on utilise FIXED_USERS

                        devLog('✅ [AUTO-RELOAD] Rechargement terminé');
                    }
                } else {
                    devLog('✔️ [AUTO-RELOAD] Pas de changement détecté');
                }
            } catch (error) {
                console.error('❌ [AUTO-RELOAD] Erreur:', error);
                devError('Auto-reload error:', error);
            }
        }, 5000); // 5 secondes - Refresh rapide pour détecter les tâches assignées par d'autres users

        return () => clearInterval(interval);
    }, [storagePath, isLoadingData, currentUser, setTasks, setDirectories, setProjectHistory, setProjectColors, setNotificationSettings]); // setUsers retiré car on utilise FIXED_USERS

    // Sauvegarde automatique avec débounce pour éviter les sauvegardes multiples rapides
    useEffect(() => {
        if (isLoadingData) return;

        // localStorage mis à jour immédiatement (synchrone, pas cher)
        const payload = { tasks, directories, projectHistory, projectColors, notificationSettings, themeSettings };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

        // Sauvegarde fichier Electron débounce de 500ms
        const timer = setTimeout(async () => {
            if (window.electronAPI?.isElectron && storagePath) {
                try {
                    const filePath = storagePath + '/data.json';
                    devLog('💾 [SAVE] Début de la sauvegarde...');
                    const saveResult = await window.electronAPI?.saveData(filePath, payload);
                    if (saveResult && !saveResult.success) {
                        throw new Error(saveResult.error || 'Sauvegarde échouée');
                    }
                    devLog('✅ [SAVE] Sauvegarde terminée');
                    setSaveError(null);

                    const newHashResult = await window.electronAPI?.getFileHash(filePath);
                    if (newHashResult?.success) {
                        lastFileHash.current = newHashResult.hash;
                    }
                } catch (error) {
                    devError("Save file error", error);
                    setSaveError('Échec de la sauvegarde sur le lecteur réseau. Vos données sont sauvegardées localement.');
                }
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [tasks, directories, projectHistory, projectColors, notificationSettings, storagePath, isLoadingData, setSaveError]);

    // Sauvegarder l'utilisateur courant dans localStorage
    useEffect(() => {
        if (currentUser) {
            localStorage.setItem('current_user_id', currentUser);
        } else {
            localStorage.removeItem('current_user_id');
        }
    }, [currentUser]);
}

