import { create } from 'zustand';
import { todayISO, uid, devWarn } from '../utils';
import { FIXED_USERS, DEFAULT_NOTIFICATION_SOUND } from '../constants';
import { DEFAULT_THEME } from '../themes/presets';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../services/api';
import type { Task, TaskData, Subtask, User, Directories, NotificationSettings, ThemeSettings, Comment, TaskTemplate, SavedReport, AppNotification, TimeEntry, OutlookConfig, OutlookEvent } from '../types';

/**
 * Patch envoyé à `updateTask` : identique à `Partial<Task>`, sauf pour les champs de
 * workflow de révision qui acceptent explicitement `null` (en plus de leur type usuel)
 * pour permettre de les effacer côté serveur. `JSON.stringify` supprime les clés dont
 * la valeur est `undefined` (voir `apiPut`/`services/api.ts`), donc un patch contenant
 * `{ reviewValidatedBy: undefined }` n'envoie RIEN au serveur et ne peut donc jamais
 * vider ce champ — seul `null` explicite le peut (voir `reopenTask`, qui a besoin de
 * réinitialiser ces champs). `Task` lui-même garde ces champs typés sans `null` car la
 * réponse serveur (`formatTask` côté backend) les normalise toujours en `undefined`
 * quand ils sont absents — donc un `Task` en mémoire ne contient jamais `null` ici.
 */
type TaskPatch = Omit<Partial<Task>, 'reviewValidatedBy' | 'reviewValidatedAt' | 'reviewRejectedBy' | 'reviewRejectedAt' | 'rejectionComment'> & {
    reviewValidatedBy?: string | null;
    reviewValidatedAt?: number | null;
    reviewRejectedBy?: string | null;
    reviewRejectedAt?: number | null;
    rejectionComment?: string | null;
};

/**
 * Calcule la prochaine occurrence d'une tâche récurrente.
 * Retourne la nouvelle Task ou null si la récurrence est terminée / absente.
 */
function buildRecurringTask(completedTask: Task, now: number): Task | null {
    if (!completedTask.recurrence) return null;
    const { type, endsAt } = completedTask.recurrence;
    if (endsAt && now >= endsAt) return null;

    const baseDate = completedTask.due ? new Date(completedTask.due) : new Date();
    const nextDate = new Date(baseDate);
    if (type === 'daily') nextDate.setDate(nextDate.getDate() + 1);
    else if (type === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
    else if (type === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
    const nextISO = nextDate.toISOString().split('T')[0];

    return {
        ...completedTask,
        id: uid(),
        status: 'todo',
        completedAt: null,
        due: nextISO,
        createdAt: now,
        updatedAt: now,
        archived: false,
        archivedAt: null,
        deletedAt: null,
        order: 0,
        subtasks: completedTask.subtasks.map(st => ({ ...st, completed: false, completedAt: null })),
    };
}

export interface StoreState {
    // State
    tasks: Task[];
    directories: Directories;
    projectHistory: string[];
    projectColors: Record<string, number>;
    users: User[];
    currentUser: string | null; // ID de l'utilisateur actuellement connecté
    viewAsUser: string | null;  // Vue en tant que (filtre visuel, sans changer la session)

    // Session backend (JWT) — voir src/services/api.ts
    authToken: string | null;
    authStatus: 'idle' | 'checking' | 'authenticated' | 'error';
    authError: string | null;
    collapsedProjects: Record<string, boolean>;
    storagePath: string | null;
    isLoadingData: boolean;
    saveError: string | null;
    notificationSettings: NotificationSettings;
    themeSettings: ThemeSettings;

    // Simple Setters
    setTasks: (tasks: Task[]) => void;
    setDirectories: (directories: Directories) => void;
    setProjectHistory: (history: string[]) => void;
    setProjectColors: (colors: Record<string, number>) => void;
    setProjectColor: (projectName: string, colorIndex: number) => Promise<void>;
    // Projects via API (todox-backend) — voir src/services/api.ts
    fetchProjects: () => Promise<void>;
    setProjectDirectory: (projectName: string, directory: string) => Promise<void>;
    removeProjectDirectory: (projectName: string) => Promise<void>;
    setProjectOrder: (projectName: string, order: number) => Promise<void>;
    setUsers: (users: User[]) => void;
    fetchUsers: () => Promise<void>;
    createUser: (data: { email: string; name: string; password: string; role?: 'admin' | 'member' }) => Promise<void>;
    setCurrentUser: (userId: string | null) => void;
    setViewAsUser: (userId: string | null) => void;
    setAuthToken: (token: string | null) => void;
    setAuthStatus: (status: 'idle' | 'checking' | 'authenticated' | 'error') => void;
    setAuthError: (msg: string | null) => void;
    setStoragePath: (path: string | null) => void;
    setIsLoadingData: (loading: boolean) => void;
    setSaveError: (error: string | null) => void;
    setNotificationSettings: (settings: NotificationSettings) => void;
    updateNotificationSettings: (patch: Partial<NotificationSettings>) => void;
    setThemeSettings: (settings: ThemeSettings) => void;
    updateThemeSettings: (patch: Partial<ThemeSettings>) => void;

    // Task Actions — via API (todox-backend), voir src/services/api.ts
    addTask: (data: TaskData) => Promise<void>;
    updateTask: (id: string, patch: TaskPatch) => Promise<void>;
    removeTask: (id: string) => Promise<void>;
    convertSubtaskBack: (taskId: string) => Promise<'ok' | 'parent_deleted' | 'parent_not_found' | 'error'>;
    setTaskParent: (childId: string, parentId: string | null) => Promise<void>;
    moveTask: (id: string, status: string) => Promise<void>;
    archiveTask: (id: string) => Promise<void>;
    unarchiveTask: (id: string) => Promise<void>;
    moveProject: (projectName: string, fromStatus: Task['status'], toStatus: Task['status']) => void;

    // Subtasks — via API (todox-backend)
    addSubtask: (taskId: string, title: string) => Promise<void>;
    toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;
    deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
    updateSubtaskTitle: (taskId: string, subtaskId: string, title: string) => Promise<void>;
    // assignSubtask/unassignSubtask/setSubtaskDates : initialement laissées 100% locales dans
    // ce chantier car PUT /api/tasks/:taskId/subtasks/:subId n'acceptait/ne renvoyait que
    // `completed`/`title` — gap comblé côté backend (todox-backend commit 6c02616, redéployé)
    // qui accepte désormais `assignedTo`/`startDate`/`endDate` en écriture et les renvoie en
    // lecture ; converties ci-dessous en conséquence.
    assignSubtask: (taskId: string, subtaskId: string, userId: string) => Promise<void>;
    unassignSubtask: (taskId: string, subtaskId: string, userId: string) => Promise<void>;
    setSubtaskDates: (taskId: string, subtaskId: string, patch: { startDate?: string | null; endDate?: string | null }) => Promise<void>;
    reorderSubtasks: (taskId: string, start: number, end: number) => Promise<void>;

    // Comments
    comments: Record<string, Comment[]>;
    setComments: (comments: Record<string, Comment[]>) => void;
    fetchComments: () => Promise<void>;
    addComment: (taskId: string, text: string) => Promise<void>;
    deleteComment: (taskId: string, commentId: string) => Promise<void>;

    // Task reorder
    reorderTask: (draggedId: string, targetId: string, position: 'before' | 'after') => void;

    // Projects
    addToProjectHistory: (projectName: string) => void;
    toggleProjectCollapse: (status: string, project: string) => void;
    isProjectCollapsed: (status: string, project: string) => boolean;
    archiveProject: (projectName: string) => void;
    unarchiveProject: (projectName: string) => void;
    deleteArchivedProject: (projectName: string) => void;
    renameProject: (oldName: string, newName: string) => void;

    // Templates
    templates: TaskTemplate[];
    setTemplates: (templates: TaskTemplate[]) => void;
    addTemplate: (template: Omit<TaskTemplate, 'id'>) => void;
    deleteTemplate: (id: string) => void;
    applyTemplateToTask: (taskId: string, templateId: string) => void;

    // Saved Reports (CRs)
    savedReports: SavedReport[];
    setSavedReports: (reports: SavedReport[]) => void;
    saveReport: (report: Omit<SavedReport, 'id'>) => void;
    deleteReport: (id: string) => void;

    // In-app notifications (workflow de révision)
    appNotifications: AppNotification[];
    setAppNotifications: (notifs: AppNotification[]) => void;
    addAppNotification: (notif: Omit<AppNotification, 'id' | 'createdAt'>) => void;
    markNotificationRead: (notifId: string) => void;
    markAllNotificationsRead: (userId: string) => void;
    markNotificationsByTypeRead: (types: import('../types').AppNotifType[], userId: string) => void;
    deleteNotificationForUser: (notifId: string, userId: string) => void;

    // Review workflow — via API (todox-backend). Les notifications AppNotification de revue
    // (review_requested/review_validated/review_rejected) sont créées côté serveur par
    // PUT /api/tasks/:id (voir `createReviewNotifications` dans
    // todox-backend/src/routes/tasks.ts) : ces 4 actions ne doivent PAS aussi les créer
    // localement via addAppNotification, sous peine de double notification.
    setReviewers: (taskId: string, reviewers: string[]) => Promise<void>;
    validateTask: (taskId: string) => Promise<void>;
    requestCorrections: (taskId: string, comment: string) => Promise<void>;
    reopenTask: (taskId: string) => Promise<void>;

    // Ephemeral UI state — dialog d'assignation réviseur (action locale uniquement, non persisté)
    pendingReviewDialogTaskId: string | null;
    setPendingReviewDialogTaskId: (taskId: string | null) => void;

    // Feuilles de pointage
    timeEntries: TimeEntry[];
    setTimeEntries: (entries: TimeEntry[]) => void;
    upsertTimeEntry: (project: string, date: string, hours: number, userId: string, note?: string) => void;
    deleteTimeEntry: (project: string, date: string, userId: string) => void;

    // Intégration Outlook / ICS
    outlookConfig: OutlookConfig;              // config du user courant (dérivée de outlookConfigs)
    outlookConfigs: Record<string, OutlookConfig>; // persisté : une config par userId
    outlookEvents: OutlookEvent[];             // transient (non persisté)
    setOutlookConfig: (patch: Partial<OutlookConfig>) => void;
    setOutlookConfigs: (configs: Record<string, OutlookConfig>) => void;
    setOutlookEvents: (events: OutlookEvent[]) => void;

    // UI transient — mise en surbrillance d'une tâche (depuis notif) + commentaire (depuis sidebar messages)
    highlightedTaskId: string | null;
    setHighlightedTaskId: (id: string | null) => void;
    highlightedCommentId: string | null;
    setHighlightedCommentId: (id: string | null) => void;
}

const useStore = create<StoreState>((set, get) => ({
    // State
    tasks: [],
    directories: {},
    projectHistory: [],
    projectColors: {},
    users: FIXED_USERS,
    currentUser: null,
    viewAsUser: null,
    authToken: null,
    authStatus: 'idle',
    authError: null,
    collapsedProjects: {},
    storagePath: null,
    isLoadingData: true,
    saveError: null,
    comments: {},
    templates: [],
    savedReports: [],
    appNotifications: [],
    pendingReviewDialogTaskId: null,
    timeEntries: [],
    outlookConfig: {
        enabled: false,
        icsUrl: '',
        exportEnabled: false,
        lastSync: null,
    },
    outlookConfigs: {},
    outlookEvents: [],
    highlightedTaskId: null,
    highlightedCommentId: null,

    notificationSettings: {
        enabled: true,
        deadlineNotifications: true,
        staleTaskNotifications: true,
        checkInterval: 30, // 30 minutes par défaut
        quietHoursEnabled: false,
        quietHoursStart: "22:00",
        quietHoursEnd: "08:00",
        sound: true,
        soundFile: DEFAULT_NOTIFICATION_SOUND, // Son par défaut: "Classique"
        ganttNotifications: true,
    },
    themeSettings: {
        mode: 'dark',
        activeThemeId: DEFAULT_THEME.id,
        customThemes: [],
        customAccentColor: undefined,
    },

    // Simple Setters
    setTasks: (tasks) => set({ tasks }),
    setDirectories: (directories) => set({ directories }),
    setProjectHistory: (projectHistory) => set({ projectHistory }),
    setProjectColors: (projectColors) => set({ projectColors }),
    setProjectColor: async (projectName, colorIndex) => {
        const token = get().authToken;
        await apiPut(`/api/projects/${encodeURIComponent(projectName)}/color`, { color: colorIndex }, token ?? undefined);
        set((state) => ({ projectColors: { ...state.projectColors, [projectName]: colorIndex } }));
    },
    fetchProjects: async () => {
        const token = get().authToken;
        const projects = await apiGet<Array<{ name: string; color: number | null; directory: string | null; sortOrder: number }>>('/api/projects', token ?? undefined);
        const sorted = [...projects].sort((a, b) => a.sortOrder - b.sortOrder);
        const projectHistory = sorted.map(p => p.name);
        const projectColors: Record<string, number> = {};
        const directories: Record<string, string> = {};
        for (const p of sorted) {
            if (p.color !== null) projectColors[p.name] = p.color;
            if (p.directory !== null) directories[p.name] = p.directory;
        }
        set({ projectHistory, projectColors, directories });
    },
    setProjectDirectory: async (projectName, directory) => {
        const token = get().authToken;
        await apiPut(`/api/projects/${encodeURIComponent(projectName)}/directory`, { directory }, token ?? undefined);
        set((state) => ({ directories: { ...state.directories, [projectName]: directory } }));
    },
    // Pas de bouton "effacer le dossier" par projet dans l'UI actuelle (ProjectDirs.tsx
    // fait un enregistrement global de la map complète, voir commentaire dans ce fichier) —
    // action exposée pour un futur usage ponctuel, conforme à la route backend DELETE.
    removeProjectDirectory: async (projectName) => {
        const token = get().authToken;
        await apiDelete(`/api/projects/${encodeURIComponent(projectName)}/directory`, token ?? undefined);
        set((state) => {
            const directories = { ...state.directories };
            delete directories[projectName];
            return { directories };
        });
    },
    // Pas de drag-and-drop de réordonnancement des projets dans l'UI actuelle (seul le
    // drag des tâches et le drag d'un projet entre colonnes/statuts existent aujourd'hui,
    // voir useDragAndDrop.ts) — action exposée pour un futur usage, conforme à la route
    // backend PUT .../order. `projectHistory` sert de représentation locale de l'ordre :
    // repositionner le projet à l'index `order` une fois le serveur confirmé.
    setProjectOrder: async (projectName, order) => {
        const token = get().authToken;
        await apiPut(`/api/projects/${encodeURIComponent(projectName)}/order`, { order }, token ?? undefined);
        set((state) => {
            const withoutProject = state.projectHistory.filter(p => p !== projectName);
            const projectHistory = [...withoutProject];
            projectHistory.splice(order, 0, projectName);
            return { projectHistory };
        });
    },
    setUsers: (users) => set({ users }),
    fetchUsers: async () => {
        const token = get().authToken;
        const users = await apiGet<User[]>('/api/users', token ?? undefined);
        get().setUsers(users);
    },
    createUser: async (data) => {
        const token = get().authToken;
        const created = await apiPost<User>('/api/users', data, token ?? undefined);
        set((state) => ({ users: [...state.users, created] }));
    },
    setCurrentUser: (userId) => set((state) => {
        const DEFAULT_OUTLOOK: OutlookConfig = { enabled: false, icsUrl: '', exportEnabled: false, lastSync: null };
        const outlookConfig = userId ? (state.outlookConfigs[userId] ?? DEFAULT_OUTLOOK) : DEFAULT_OUTLOOK;
        return { currentUser: userId, outlookConfig };
    }),
    setViewAsUser: (userId) => set({ viewAsUser: userId }),
    setAuthToken: (token) => set({ authToken: token, authStatus: token ? 'authenticated' : 'idle' }),
    setAuthStatus: (status) => set({ authStatus: status }),
    setAuthError: (msg) => set({ authError: msg }),
    setStoragePath: (path) => set({ storagePath: path }),
    setIsLoadingData: (loading) => set({ isLoadingData: loading }),
    setSaveError: (error) => set({ saveError: error }),
    setNotificationSettings: (settings) => set({ notificationSettings: settings }),
    updateNotificationSettings: (patch) => {
        set((state) => ({
            notificationSettings: { ...state.notificationSettings, ...patch }
        }));
    },
    setThemeSettings: (settings) => set({ themeSettings: settings }),
    updateThemeSettings: (patch) => {
        set((state) => ({
            themeSettings: { ...state.themeSettings, ...patch }
        }));
    },

    // Task Actions — via API (todox-backend/src/routes/tasks.ts)
    addTask: async (data) => {
        const currentUser = get().currentUser;

        if (!currentUser || currentUser === "unassigned") {
            devWarn("Tentative de création de tâche sans utilisateur connecté");
            return;
        }

        const token = get().authToken;
        const projectName = (data.project?.trim() || "DIVERS").toUpperCase();
        const status = data.status || "todo";

        const payload = {
            title: (data.title?.trim() || "Sans titre").toUpperCase(),
            project: projectName,
            due: data.due || todayISO(),
            priority: data.priority || "med",
            status,
            assignedTo: data.assignedTo || [currentUser],
            notes: data.notes || "",
            favorite: false,
        };

        const created = await apiPost<Task>('/api/tasks', payload, token ?? undefined);

        // `ganttDays` (planning Timeline) et `convertedFromSubtask` (traçabilité de
        // "convertir en tâche") n'ont aucune colonne équivalente côté backend — la réponse
        // serveur ne les contient jamais. On les recrée localement pour ne pas perdre ces
        // deux fonctionnalités (voir aussi le merge `{ ...t, ...updated }` de `updateTask`,
        // même raison).
        const newTask: Task = {
            ...created,
            ganttDays: [],
            ...(data.convertedFromSubtask ? { convertedFromSubtask: data.convertedFromSubtask } : {}),
        };

        set((state) => ({ tasks: [newTask, ...state.tasks] }));

        get().addToProjectHistory(projectName);

        if (data.folderPath) {
            set((state) => ({ directories: { ...state.directories, [projectName]: data.folderPath! } }));
        }
    },

    updateTask: async (id, patch) => {
        if (patch.project) {
            get().addToProjectHistory(patch.project);
        }

        // Patch effectivement envoyé au serveur : on part du patch demandé et on n'y ajoute
        // QUE ce que le serveur ne sait pas déduire lui-même (titre en majuscules — le
        // backend n'uppercase que `project`, pas `title` ; horodatage de passage en revue —
        // le backend ne le déduit jamais automatiquement). À l'inverse, `completedAt` n'est
        // PAS calculé ici : PUT /api/tasks/:id le déduit déjà lui-même du changement de
        // `status` (voir todox-backend/src/routes/tasks.ts) — le serveur est la source de
        // vérité pour les horodatages (contrainte globale du plan). Le dupliquer ici casserait
        // la sémantique PATCH (le corps envoyé ne contiendrait plus uniquement les champs
        // modifiés) — c'est d'ailleurs ce que vérifie le test "PATCH semantics".
        const outgoingPatch: TaskPatch = { ...patch };
        if (patch.title) {
            outgoingPatch.title = (patch.title.trim() || patch.title).toUpperCase();
        }
        if (patch.status === 'review') {
            outgoingPatch.movedToReviewBy = get().currentUser ?? undefined;
            outgoingPatch.movedToReviewAt = Date.now();
        }

        // Workflow review : si la tâche passe en "review" avec des réviseurs déjà définis
        // (ex : renvoi en revue après corrections, sans que la liste des réviseurs change) →
        // notifier localement. Ce cas précis n'est PAS couvert par les AppNotifications
        // générées côté serveur dans PUT /api/tasks/:id, qui ne se déclenchent que lorsque
        // le champ `reviewers` change dans la requête (voir `createReviewNotifications` côté
        // backend) — ici `reviewers` n'est pas dans `outgoingPatch`, donc aucun risque de
        // double notification avec le serveur.
        if (patch.status === 'review') {
            const existingTask = get().tasks.find(t => t.id === id);
            if (existingTask && existingTask.reviewers?.length) {
                const { currentUser, users } = get();
                const fromUser = users.find(u => u.id === currentUser);
                const fromUserName = fromUser?.name || currentUser || '';
                existingTask.reviewers.forEach(reviewerId => {
                    get().addAppNotification({
                        type: 'review_requested',
                        taskId: id,
                        taskTitle: existingTask.title,
                        fromUserId: currentUser || '',
                        toUserId: reviewerId,
                        message: `${fromUserName} t'a assigné comme réviseur sur ${existingTask.title}`,
                    });
                });
            }
        }

        const token = get().authToken;
        const updated = await apiPut<Task>(`/api/tasks/${id}`, outgoingPatch, token ?? undefined);

        // Merge (pas remplacement complet) : `updated` (réponse serveur) ne contient jamais
        // `ganttDays`/`convertedFromSubtask` (aucune colonne backend) — un remplacement
        // complet les effacerait silencieusement à chaque updateTask, même pour un simple
        // changement de statut. Le merge préserve ces deux champs locaux tout en laissant le
        // serveur faire autorité sur tout le reste (id, timestamps, champs de revue, etc.).
        set((state) => ({
            tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updated } : t))
        }));

        // Récurrence : si la tâche passe en "done", créer la prochaine occurrence si applicable
        if (patch.status === "done") {
            const completedTask = get().tasks.find(t => t.id === id);
            if (completedTask) {
                const nextTask = buildRecurringTask(completedTask, Date.now());
                if (nextTask) set(state => ({ tasks: [nextTask, ...state.tasks] }));
            }
        }
    },

    removeTask: async (id) => {
        const token = get().authToken;
        await apiDelete(`/api/tasks/${id}`, token ?? undefined);
        // DELETE renvoie 204 (pas de corps) : le serveur fait bien le soft-delete
        // (`deletedAt`), mais sans nous renvoyer son horodatage exact — on approxime
        // localement avec l'heure client, comme le reste du soft-delete optimiste ici.
        const now = Date.now();
        set((state) => ({
            tasks: state.tasks.map((t) => t.id === id ? { ...t, deletedAt: now, updatedAt: now } : t)
        }));
    },

    convertSubtaskBack: async (taskId) => {
        const task = get().tasks.find(t => t.id === taskId);
        if (!task?.convertedFromSubtask) return 'parent_not_found';
        const { parentTaskId } = task.convertedFromSubtask;
        const parentTask = get().tasks.find(t => t.id === parentTaskId);
        // Parent introuvable ou définitivement supprimé → impossible, on ne touche pas à la tâche
        if (!parentTask || parentTask.deletedAt) return 'parent_not_found';
        // Parent archivé → reconversion possible (sous-tâche rattachée à la tâche archivée)
        // addSubtask/removeTask font désormais un vrai appel réseau (depuis cette tâche) : si
        // addSubtask réussit mais removeTask échoue ensuite, la sous-tâche serait dupliquée sur
        // le parent ET la tâche d'origine resterait présente — état partiellement converti.
        // On l'attrape explicitement pour prévenir l'appelant plutôt que de laisser l'erreur
        // se perdre silencieusement (les deux appels étaient des mutations locales synchrones
        // avant cette tâche, qui ne pouvaient jamais échouer).
        try {
            await get().addSubtask(parentTaskId, task.title);
            await get().removeTask(taskId);
        } catch {
            return 'error';
        }
        return parentTask.archived ? 'parent_deleted' : 'ok';
    },

    setTaskParent: (childId, parentId) => {
        return get().updateTask(childId, { parentTaskId: parentId });
    },

    moveTask: (id, status) => {
        if (status === 'review') {
            const task = get().tasks.find(t => t.id === id);
            if (task && !(task.reviewers?.length)) {
                set({ pendingReviewDialogTaskId: id });
            }
        }
        return get().updateTask(id, { status: status as Task['status'] });
    },

    setPendingReviewDialogTaskId: (taskId) => set({ pendingReviewDialogTaskId: taskId }),

    archiveTask: (id) => get().updateTask(id, { archived: true, archivedAt: Date.now() }),
    unarchiveTask: (id) => get().updateTask(id, { archived: false, archivedAt: null }),

    moveProject: (projectName, fromStatus, toStatus) => {
        const now = Date.now();
        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.project === projectName && t.status === fromStatus) {
                    return {
                        ...t,
                        status: toStatus,
                        completedAt: toStatus === "done" ? now : null,
                        updatedAt: now,
                    };
                }
                return t;
            })
        }));
    },

    // Subtasks — via API (todox-backend/src/routes/subtasks.ts, monté sous
    // /api/tasks/:taskId/subtasks)
    addSubtask: async (taskId, title) => {
        if (!title.trim()) return;
        const token = get().authToken;
        const created = await apiPost<Subtask>(`/api/tasks/${taskId}/subtasks`, { title: title.trim() }, token ?? undefined);
        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id === taskId) {
                    return { ...t, subtasks: [...(t.subtasks || []), created] };
                }
                return t;
            })
        }));
    },

    toggleSubtask: async (taskId, subtaskId) => {
        const token = get().authToken;
        // Trouver l'état actuel pour déterminer la nouvelle valeur
        const task = get().tasks.find(t => t.id === taskId);
        const sub = task?.subtasks?.find(s => s.id === subtaskId);
        const newCompleted = sub ? !sub.completed : true;

        // `completedBy` est désormais déduit côté serveur de l'appelant (req.userId) et
        // renvoyé dans la réponse — plus besoin de le calculer/fusionner côté client (voir
        // todox-backend/src/routes/subtasks.ts, commit 6c02616).
        const updated = await apiPut<Subtask>(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { completed: newCompleted }, token ?? undefined);

        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id === taskId) {
                    const sts = (t.subtasks || []).map(st => st.id === subtaskId ? { ...st, ...updated } : st);
                    return { ...t, subtasks: sts };
                }
                return t;
            })
        }));
    },

    deleteSubtask: async (taskId, subtaskId) => {
        const token = get().authToken;
        await apiDelete(`/api/tasks/${taskId}/subtasks/${subtaskId}`, token ?? undefined);
        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id === taskId) {
                    return { ...t, subtasks: (t.subtasks || []).filter(st => st.id !== subtaskId) };
                }
                return t;
            })
        }));
    },

    updateSubtaskTitle: async (taskId, subtaskId, title) => {
        const token = get().authToken;
        const updated = await apiPut<Subtask>(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { title }, token ?? undefined);
        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id === taskId) {
                    const sts = (t.subtasks || []).map(st => st.id === subtaskId ? { ...st, ...updated } : st);
                    return { ...t, subtasks: sts };
                }
                return t;
            })
        }));
    },

    assignSubtask: async (taskId, subtaskId, userId) => {
        const task = get().tasks.find(t => t.id === taskId);
        const sub = task?.subtasks?.find(s => s.id === subtaskId);
        const current = sub?.assignedTo || [];
        if (current.includes(userId)) return;

        const token = get().authToken;
        const newAssignedTo = [...current, userId];
        const updated = await apiPut<Subtask>(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { assignedTo: newAssignedTo }, token ?? undefined);

        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id !== taskId) return t;
                const sts = (t.subtasks || []).map(st => st.id === subtaskId ? { ...st, ...updated } : st);
                return { ...t, subtasks: sts };
            })
        }));
    },

    unassignSubtask: async (taskId, subtaskId, userId) => {
        const task = get().tasks.find(t => t.id === taskId);
        const sub = task?.subtasks?.find(s => s.id === subtaskId);
        const newAssignedTo = (sub?.assignedTo || []).filter(id => id !== userId);

        const token = get().authToken;
        const updated = await apiPut<Subtask>(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { assignedTo: newAssignedTo }, token ?? undefined);

        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id !== taskId) return t;
                const sts = (t.subtasks || []).map(st => st.id === subtaskId ? { ...st, ...updated } : st);
                return { ...t, subtasks: sts };
            })
        }));
    },

    setSubtaskDates: async (taskId, subtaskId, patch) => {
        // PATCH semantics : on envoie uniquement les champs fournis par l'appelant (`patch`
        // tel quel), jamais startDate/endDate par défaut si non fournis.
        const token = get().authToken;
        const updated = await apiPut<Subtask>(`/api/tasks/${taskId}/subtasks/${subtaskId}`, patch, token ?? undefined);

        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id !== taskId) return t;
                const sts = (t.subtasks || []).map(st =>
                    st.id === subtaskId ? { ...st, ...updated } : st
                );
                return { ...t, subtasks: sts };
            })
        }));
    },

    reorderSubtasks: async (taskId, start, end) => {
        // Réordonnancement local optimiste — logique de splice inchangée par rapport à la
        // version 100% locale d'avant cette tâche.
        let newOrderIds: string[] | null = null;
        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id === taskId) {
                    const sts = [...(t.subtasks || [])];
                    const [rem] = sts.splice(start, 1);
                    sts.splice(end, 0, rem);
                    newOrderIds = sts.map(s => s.id);
                    return { ...t, subtasks: sts };
                }
                return t;
            })
        }));

        if (newOrderIds) {
            const token = get().authToken;
            await apiPatch(`/api/tasks/${taskId}/subtasks/reorder`, { order: newOrderIds }, token ?? undefined);
        }
    },

    // Comments
    setComments: (comments) => set({ comments }),

    // Bulk, org-scoped (GET /api/comments renvoie un tableau plat de tous les commentaires
    // de l'organisation) -- regroupé ici en Record<taskId, Comment[]> car TaskCard lit
    // `comments[task.id]` directement pour son badge de compte sur chaque carte visible.
    fetchComments: async () => {
        const token = get().authToken;
        const flat = await apiGet<Comment[]>('/api/comments', token ?? undefined);
        const grouped: Record<string, Comment[]> = {};
        for (const c of flat) {
            (grouped[c.taskId] ??= []).push(c);
        }
        set({ comments: grouped });
    },

    addComment: async (taskId, text) => {
        const { currentUser, users, tasks, authToken } = get();
        if (!currentUser || !text.trim()) return;

        const created = await apiPost<Comment>(`/api/tasks/${taskId}/comments`, { text: text.trim() }, authToken ?? undefined);

        set(state => ({
            comments: {
                ...state.comments,
                [taskId]: [...(state.comments[taskId] || []), created],
            }
        }));

        // Détecter les @mentions et notifier les utilisateurs concernés
        // (100% côté client : aucune route serveur ne couvre cette logique -- voir
        // todox-backend/src/routes/comments.ts, POST /tasks/:taskId/comments ne crée
        // aucune AppNotification, donc pas de risque de double notification ici).
        const task = tasks.find(t => t.id === taskId);
        const fromUser = users.find(u => u.id === currentUser);
        const taskTitle = task?.title || 'une tâche';
        const fromUserName = fromUser?.name || currentUser;

        const mentionedUsers = users.filter(u =>
            u.id !== currentUser && text.includes(`@${u.name}`)
        );
        const mentionedIds = new Set(mentionedUsers.map(u => u.id));

        if (mentionedUsers.length > 0) {
            // AppNotification cloche
            mentionedUsers.forEach(u => {
                get().addAppNotification({
                    type: 'comment_mention',
                    taskId,
                    taskTitle,
                    fromUserId: currentUser,
                    toUserId: u.id,
                    message: `${fromUserName} vous a mentionné dans "${taskTitle}" : ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`,
                });
            });
        }

        // Notifier assignés et réviseurs (hors commentateur et déjà mentionnés)
        if (task) {
            const involved = [...new Set([
                ...(task.assignedTo || []),
                ...(task.reviewers || []),
            ])].filter(id => id !== currentUser && !mentionedIds.has(id));
            involved.forEach(toUserId => {
                get().addAppNotification({
                    type: 'comment_added',
                    taskId,
                    taskTitle,
                    fromUserId: currentUser,
                    toUserId,
                    message: `${fromUserName} a commenté "${taskTitle}" : ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`,
                });
            });
        }
    },

    deleteComment: async (taskId, commentId) => {
        const token = get().authToken;
        await apiDelete(`/api/comments/${commentId}`, token ?? undefined);
        const now = Date.now();
        set(state => ({
            comments: {
                ...state.comments,
                [taskId]: (state.comments[taskId] || []).map(c =>
                    c.id === commentId ? { ...c, deletedAt: now } : c
                ),
            }
        }));
    },

    // Projects
    addToProjectHistory: (projectName) => {
        if (!projectName || projectName === "DIVERS") return;
        set((state) => {
            if (state.projectHistory.includes(projectName)) {
                const filtered = state.projectHistory.filter((p) => p !== projectName);
                return { projectHistory: [projectName, ...filtered] };
            }
            return { projectHistory: [projectName, ...state.projectHistory] };
        });
    },

    toggleProjectCollapse: (status, project) => {
        const key = `${status}_${project}`;
        set((state) => ({ collapsedProjects: { ...state.collapsedProjects, [key]: !state.collapsedProjects[key] } }));
    },

    // Helpers
    isProjectCollapsed: (status, project) => {
        const key = `${status}_${project}`;
        return get().collapsedProjects[key] || false;
    },

    archiveProject: (projectName) => {
        const now = Date.now();
        set(state => ({
            tasks: state.tasks.map(t => t.project === projectName ? { ...t, archived: true, archivedAt: now } : t)
        }));
    },

    unarchiveProject: (projectName) => {
        set(state => ({
            tasks: state.tasks.map(t => t.project === projectName && t.archived ? { ...t, archived: false, archivedAt: null } : t)
        }));
    },

    deleteArchivedProject: (projectName) => {
        const now = Date.now();
        set(state => ({
            tasks: state.tasks.map(t =>
                (t.project === projectName && t.archived)
                    ? { ...t, deletedAt: now, updatedAt: now }
                    : t
            )
        }));
    },

    renameProject: (oldName, newName) => {
        if (!newName.trim() || newName === oldName) return;
        const trimmed = newName.trim().toUpperCase();
        set(state => {
            // tasks
            const tasks = state.tasks.map(t =>
                t.project === oldName ? { ...t, project: trimmed } : t
            );
            // timeEntries
            const timeEntries = state.timeEntries.map(e =>
                e.project === oldName ? { ...e, project: trimmed } : e
            );
            // directories
            const directories = { ...state.directories };
            if (oldName in directories) {
                directories[trimmed] = directories[oldName];
                delete directories[oldName];
            }
            // projectColors
            const projectColors = { ...state.projectColors };
            if (oldName in projectColors) {
                projectColors[trimmed] = projectColors[oldName];
                delete projectColors[oldName];
            }
            // projectHistory
            const projectHistory = state.projectHistory.map(p => p === oldName ? trimmed : p);
            // collapsedProjects
            const collapsedProjects: Record<string, boolean> = {};
            for (const [key, val] of Object.entries(state.collapsedProjects)) {
                const renamed = key.replace(`_${oldName}`, `_${trimmed}`);
                collapsedProjects[renamed] = val;
            }
            return { tasks, timeEntries, directories, projectColors, projectHistory, collapsedProjects };
        });
    },

    // Task reorder
    reorderTask: (draggedId, targetId, position) => {
        const { tasks } = get();
        const dragged = tasks.find(t => t.id === draggedId);
        const target = tasks.find(t => t.id === targetId);
        if (!dragged || !target || dragged.project !== target.project || dragged.status !== target.status) return;

        // Groupe trié par ordre actuel
        const group = tasks
            .filter(t => t.project === dragged.project && t.status === dragged.status && !t.archived && !t.deletedAt)
            .sort((a, b) => {
                const favDiff = (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
                if (favDiff !== 0) return favDiff;
                return (a.order ?? 0) - (b.order ?? 0);
            });

        const withoutDragged = group.filter(t => t.id !== draggedId);
        const targetIdx = withoutDragged.findIndex(t => t.id === targetId);
        const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
        withoutDragged.splice(insertIdx, 0, dragged);

        const now = Date.now();
        const orderMap = new Map<string, number>();
        withoutDragged.forEach((t, i) => orderMap.set(t.id, i * 1000));

        set(state => ({
            tasks: state.tasks.map(t => orderMap.has(t.id) ? { ...t, order: orderMap.get(t.id)!, updatedAt: now } : t)
        }));
    },

    // Templates
    setTemplates: (templates) => set({ templates }),
    addTemplate: (template) => {
        const newTemplate: TaskTemplate = { ...template, id: uid() };
        set(state => ({ templates: [...state.templates, newTemplate] }));
    },
    deleteTemplate: (id) => {
        set(state => ({ templates: state.templates.filter(t => t.id !== id) }));
    },
    applyTemplateToTask: (taskId, templateId) => {
        const tpl = get().templates.find(t => t.id === templateId);
        if (!tpl) return;
        tpl.subtaskTitles.forEach(title => get().addSubtask(taskId, title));
    },

    // Saved Reports
    setSavedReports: (savedReports) => set({ savedReports }),
    saveReport: (report) => {
        const newReport: SavedReport = { ...report, id: uid() };
        set(state => ({ savedReports: [newReport, ...state.savedReports] }));
    },
    deleteReport: (id) => {
        set(state => ({ savedReports: state.savedReports.filter(r => r.id !== id) }));
    },

    // ── In-app notifications ────────────────────────────────────────────────
    setAppNotifications: (appNotifications) => set({ appNotifications }),

    addAppNotification: (notif) => {
        const full: AppNotification = { ...notif, id: uid(), createdAt: Date.now() };
        set(state => ({ appNotifications: [full, ...state.appNotifications] }));
    },

    markNotificationRead: (notifId) => {
        set(state => ({
            appNotifications: state.appNotifications.map(n =>
                n.id === notifId ? { ...n, readAt: Date.now() } : n
            )
        }));
    },

    markAllNotificationsRead: (userId) => {
        set(state => ({
            appNotifications: state.appNotifications.map(n =>
                n.toUserId === userId && !n.readAt ? { ...n, readAt: Date.now() } : n
            )
        }));
    },

    markNotificationsByTypeRead: (types, userId) => {
        const typeSet = new Set(types);
        set(state => ({
            appNotifications: state.appNotifications.map(n =>
                n.toUserId === userId && !n.readAt && typeSet.has(n.type)
                    ? { ...n, readAt: Date.now() }
                    : n
            )
        }));
    },

    deleteNotificationForUser: (notifId, userId) => {
        set(state => ({
            appNotifications: state.appNotifications.map(n =>
                n.id === notifId
                    ? { ...n, deletedBy: [...(n.deletedBy ?? []), userId] }
                    : n
            )
        }));
    },

    // ── Review workflow ─────────────────────────────────────────────────────
    // Les 4 actions ci-dessous appelaient auparavant `addAppNotification` localement pour
    // chaque événement de revue. PUT /api/tasks/:id crée désormais ces mêmes
    // AppNotifications côté serveur, dans la même transaction que la mise à jour de la
    // tâche (voir `createReviewNotifications` dans todox-backend/src/routes/tasks.ts) — ces
    // appels locaux ont donc été retirés ici pour ne pas doubler la notification. C'est la
    // SEULE chose retirée de chacune de ces 4 actions ; le reste (mise à jour de la tâche via
    // `updateTask`, ajout du commentaire de `requestCorrections`) est inchangé.
    setReviewers: async (taskId, reviewers) => {
        const { currentUser, tasks } = get();
        const task = tasks.find(t => t.id === taskId);
        if (!task || !currentUser) return;

        // Auto-assigner les réviseurs non encore affectés (même logique qu'avant, calculée
        // côté client puis envoyée en un seul PUT avec `reviewers`).
        const newAssignees = reviewers.filter(r => !task.assignedTo.includes(r) && r !== 'unassigned');
        const baseAssigned = task.assignedTo.filter(id => id !== 'unassigned');
        const updatedAssignedTo = newAssignees.length > 0
            ? [...baseAssigned, ...newAssignees]
            : task.assignedTo;

        await get().updateTask(taskId, { reviewers, assignedTo: updatedAssignedTo });
    },

    validateTask: async (taskId) => {
        const { currentUser, tasks } = get();
        const task = tasks.find(t => t.id === taskId);
        if (!task || !currentUser) return;

        // Utilise updateTask pour déclencher la logique de récurrence automatiquement
        await get().updateTask(taskId, {
            status: 'done',
            reviewValidatedBy: currentUser,
            reviewValidatedAt: Date.now(),
        });
    },

    requestCorrections: async (taskId, comment) => {
        const { currentUser, tasks } = get();
        const task = tasks.find(t => t.id === taskId);
        if (!task || !currentUser) return;

        await get().updateTask(taskId, {
            status: 'doing',
            reviewRejectedBy: currentUser,
            reviewRejectedAt: Date.now(),
            rejectionComment: comment,
        });

        // Ajouter comme commentaire visible dans le fil
        await get().addComment(taskId, `↩️ Corrections demandées : ${comment}`);
    },

    reopenTask: (taskId) => {
        // `null` explicite (pas `undefined`) : voir le commentaire du type `TaskPatch` plus
        // haut dans ce fichier — un patch `undefined` ne serait jamais envoyé au serveur
        // (JSON.stringify supprime les clés `undefined`) et ces champs ne seraient donc
        // jamais réinitialisés côté backend.
        return get().updateTask(taskId, {
            status: 'doing',
            reviewValidatedBy: null,
            reviewValidatedAt: null,
            reviewRejectedBy: null,
            reviewRejectedAt: null,
            rejectionComment: null,
        });
    },

    // ── Feuilles de pointage ─────────────────────────────────────────────────
    setTimeEntries: (timeEntries) => set({ timeEntries }),

    upsertTimeEntry: (project, date, hours, userId, note) => {
        const now = Date.now();
        set(state => {
            const idx = state.timeEntries.findIndex(
                e => e.project === project && e.date === date && e.userId === userId
            );
            if (hours <= 0) {
                // Supprimer si heures = 0
                return { timeEntries: state.timeEntries.filter((_, i) => i !== idx) };
            }
            if (idx >= 0) {
                // Mettre à jour
                const updated = [...state.timeEntries];
                updated[idx] = { ...updated[idx], hours, note, updatedAt: now };
                return { timeEntries: updated };
            }
            // Créer
            const newEntry: TimeEntry = {
                id: uid(),
                project,
                date,
                hours,
                userId,
                note,
                createdAt: now,
                updatedAt: now,
            };
            return { timeEntries: [...state.timeEntries, newEntry] };
        });
    },

    deleteTimeEntry: (project, date, userId) => {
        set(state => ({
            timeEntries: state.timeEntries.filter(
                e => !(e.project === project && e.date === date && e.userId === userId)
            )
        }));
    },

    // ── Outlook / ICS ───────────────────────────────────────────────────────
    setOutlookConfig: (patch) => {
        set(state => {
            const merged = { ...state.outlookConfig, ...patch };
            const key = state.currentUser ?? '__global__';
            return {
                outlookConfig: merged,
                outlookConfigs: { ...state.outlookConfigs, [key]: merged },
            };
        });
    },
    setOutlookConfigs: (configs) => set({ outlookConfigs: configs }),
    setOutlookEvents: (events) => set({ outlookEvents: events }),
    setHighlightedTaskId: (id) => set({ highlightedTaskId: id }),
    setHighlightedCommentId: (id) => set({ highlightedCommentId: id }),
}));

export default useStore;
