import { create } from 'zustand';
import { todayISO, uid, devWarn } from '../utils';
import { normalizeUsers } from '../utils/users';
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
    usersUpdatedAt: number;
    currentUser: string | null; // ID de l'utilisateur actuellement connecté (UUID réel du backend)
    // Id LOCAL (FIXED_USERS) utilisé pour choisir le profil au login -- c'est la clé sous
    // laquelle saveToken/getToken/clearToken (src/services/api.ts) indexent le token JWT
    // remembered, PAS currentUser (voir LoginModal.tsx). Sans ce champ, currentUser étant
    // désormais l'UUID backend, aucun appelant hors LoginModal ne peut retrouver quel token
    // local purger au logout/à l'expiration de session.
    localAuthUserId: string | null;
    viewAsUser: string | null;  // Vue en tant que (filtre visuel, sans changer la session)

    // Session backend (JWT) — voir src/services/api.ts
    authToken: string | null;
    authStatus: 'idle' | 'checking' | 'authenticated' | 'error';
    authError: string | null;
    collapsedProjects: Record<string, boolean>;
    isLoadingData: boolean;
    saveError: string | null;
    notificationSettings: NotificationSettings;
    themeSettings: ThemeSettings;
    // Préférence d'affichage locale (pas de sync serveur ni data.json, comme themeSettings) :
    // quel côté de l'écran héberge le Centre d'activité (RightSidebar). Persistée séparément
    // en localStorage plutôt que via le pipeline de sync tâches/backend, qui ne concerne pas
    // ce genre de réglage purement local à ce poste.
    notificationPanelSide: 'left' | 'right';

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
    // setUsers garde sa signature "riche" (annuaire local) : le backend n'expose encore
    // que fetch/create pour les utilisateurs (pas de PUT/DELETE), voir plus bas.
    setUsers: (users: User[], updatedAt?: number) => void;
    fetchUsers: () => Promise<void>;
    createUser: (data: { email: string; name: string; password: string; role?: 'admin' | 'member' }) => Promise<User>;
    setCurrentUser: (userId: string | null) => void;
    setLocalAuthUserId: (id: string | null) => void;
    setViewAsUser: (userId: string | null) => void;
    setAuthToken: (token: string | null) => void;
    setAuthStatus: (status: 'idle' | 'checking' | 'authenticated' | 'error') => void;
    setAuthError: (msg: string | null) => void;
    setIsLoadingData: (loading: boolean) => void;
    setSaveError: (error: string | null) => void;
    setNotificationSettings: (settings: NotificationSettings) => void;
    setThemeSettings: (settings: ThemeSettings) => void;
    updateThemeSettings: (patch: Partial<ThemeSettings>) => void;
    setNotificationPanelSide: (side: 'left' | 'right') => void;

    // Task Actions — via API (todox-backend), voir src/services/api.ts
    fetchTasks: () => Promise<void>;
    addTask: (data: TaskData) => Promise<void>;
    updateTask: (id: string, patch: TaskPatch) => Promise<void>;
    removeTask: (id: string) => Promise<void>;
    convertSubtaskBack: (taskId: string) => Promise<'ok' | 'parent_deleted' | 'parent_not_found' | 'error'>;
    setTaskParent: (childId: string, parentId: string | null) => Promise<void>;
    moveTask: (id: string, status: string) => Promise<void>;
    archiveTask: (id: string) => Promise<void>;
    unarchiveTask: (id: string) => Promise<void>;
    moveProject: (projectName: string, fromStatus: Task['status'], toStatus: Task['status']) => Promise<void>;

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
    reorderTask: (draggedId: string, targetId: string, position: 'before' | 'after') => Promise<void>;

    // Projects
    addToProjectHistory: (projectName: string) => void;
    toggleProjectCollapse: (status: string, project: string) => void;
    isProjectCollapsed: (status: string, project: string) => boolean;
    archiveProject: (projectName: string) => Promise<void>;
    unarchiveProject: (projectName: string) => Promise<void>;
    deleteArchivedProject: (projectName: string) => Promise<void>;
    // renameProject reste 100% locale (non convertie, voir commentaire dans l'implémentation
    // plus bas) — le contrôle est désactivé côté UI plutôt que la fonction convertie.
    renameProject: (oldName: string, newName: string) => void;

    // Templates
    templates: TaskTemplate[];
    setTemplates: (templates: TaskTemplate[]) => void;
    fetchTemplates: () => Promise<void>;
    addTemplate: (template: Omit<TaskTemplate, 'id'>) => Promise<void>;
    deleteTemplate: (id: string) => Promise<void>;
    applyTemplateToTask: (taskId: string, templateId: string) => void;

    // Saved Reports (CRs)
    savedReports: SavedReport[];
    setSavedReports: (reports: SavedReport[]) => void;
    fetchSavedReports: () => Promise<void>;
    saveReport: (report: Omit<SavedReport, 'id'>) => Promise<void>;
    deleteReport: (id: string) => Promise<void>;

    // In-app notifications (workflow de révision)
    appNotifications: AppNotification[];
    setAppNotifications: (notifs: AppNotification[]) => void;
    addAppNotification: (notif: Omit<AppNotification, 'id' | 'createdAt'>) => void;
    fetchAppNotifications: () => Promise<void>;
    markNotificationRead: (notifId: string) => Promise<void>;
    markAllNotificationsRead: (userId: string) => Promise<void>;
    markNotificationsByTypeRead: (types: import('../types').AppNotifType[], userId: string) => Promise<void>;
    deleteNotificationForUser: (notifId: string, userId: string) => Promise<void>;
    fetchNotificationSettings: () => Promise<void>;
    updateNotificationSettings: (patch: Partial<NotificationSettings>) => Promise<void>;

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
    fetchTimeEntries: (from?: string, to?: string) => Promise<void>;
    upsertTimeEntry: (project: string, date: string, hours: number, userId: string, note?: string) => Promise<void>;
    deleteTimeEntry: (project: string, date: string, userId: string) => Promise<void>;

    // Intégration Outlook / ICS
    outlookConfig: OutlookConfig;              // config du user courant (dérivée de outlookConfigs)
    outlookConfigs: Record<string, OutlookConfig>; // persisté : une config par userId
    outlookEvents: OutlookEvent[];             // transient (non persisté)
    fetchOutlookConfig: () => Promise<void>;
    setOutlookConfig: (patch: Partial<OutlookConfig>) => Promise<void>;
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
    usersUpdatedAt: 0,
    currentUser: null,
    localAuthUserId: null,
    viewAsUser: null,
    authToken: null,
    authStatus: 'idle',
    authError: null,
    collapsedProjects: {},
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
    // Lu directement en localStorage (pas via un useEffect comme le thème) : c'est une
    // simple chaîne, pas de mutation DOM associée à appliquer au montage, donc rien à
    // gagner à différer la lecture -- évite aussi un flash "côté droit" avant bascule.
    notificationPanelSide: (typeof localStorage !== 'undefined' && localStorage.getItem('notification_panel_side') === 'left') ? 'left' : 'right',

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

        // Bandage frontend-only (voir commentaire du fix dans le rapport final) : la table
        // `Project` côté backend n'est peuplée QUE par les routes couleur/dossier/ordre —
        // POST /api/tasks ne crée jamais de ligne `Project`. Un projet tout juste créé en
        // tapant un nouveau nom lors de l'ajout d'une tâche (addToProjectHistory, purement
        // local) n'a donc aucune ligne serveur et serait effacé de l'historique par le
        // `set` ci-dessus dans les ~10s (poll de useApiSync). On complète donc la liste
        // serveur avec les projets distincts trouvés localement (tâches non supprimées) qui
        // n'y figurent pas encore — sans couleur ni dossier, comme un projet fraîchement créé.
        // "DIVERS" est le projet de repli d'addTask quand aucun nom n'est saisi (jamais un
        // vrai nom tapé par l'utilisateur) — addToProjectHistory l'exclut déjà pour cette
        // même raison, on l'exclut ici aussi pour rester cohérent.
        const serverNames = new Set(projectHistory);
        const localOnlyProjects = [...new Set(
            get().tasks.filter(t => !t.deletedAt && t.project && t.project !== 'DIVERS').map(t => t.project)
        )].filter(p => !serverNames.has(p));

        set({ projectHistory: [...projectHistory, ...localOnlyProjects], projectColors, directories });
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
    // setUsers reste la version "riche" (normalisation + horodatage anti-collision +
    // garde viewAsUser) : le backend n'expose encore que fetch/create pour les
    // utilisateurs (pas de PUT/DELETE — voir task-3-report.md), donc l'édition/suppression
    // locale de UsersPanel.tsx continue de s'appuyer sur cette persistance locale en
    // parallèle de l'API. fetchUsers/createUser passent par elle pour rester cohérents
    // avec cette même normalisation et ce même suivi d'horodatage.
    setUsers: (value, updatedAt) => set(state => {
        const users = normalizeUsers(value);
        return { users, usersUpdatedAt: updatedAt ?? Math.max(Date.now(), state.usersUpdatedAt + 1),
            viewAsUser: users.some(user => user.id === state.viewAsUser) ? state.viewAsUser : null };
    }),
    fetchUsers: async () => {
        const token = get().authToken;
        const users = await apiGet<User[]>('/api/users', token ?? undefined);
        get().setUsers(users);
    },
    createUser: async (data) => {
        const token = get().authToken;
        // Pas de canal d'erreur global : l'appelant (UsersPanel) affiche lui-même l'erreur.
        const created = await apiPost<User>('/api/users', data, token ?? undefined, { suppressGlobalErrorHandling: true });
        get().setUsers([...get().users, created]);
        return created;
    },
    setCurrentUser: (userId) => set((state) => {
        const DEFAULT_OUTLOOK: OutlookConfig = { enabled: false, icsUrl: '', exportEnabled: false, lastSync: null };
        const outlookConfig = userId ? (state.outlookConfigs[userId] ?? DEFAULT_OUTLOOK) : DEFAULT_OUTLOOK;
        return { currentUser: userId, outlookConfig };
    }),
    setLocalAuthUserId: (id) => set({ localAuthUserId: id }),
    setViewAsUser: (userId) => set({ viewAsUser: userId }),
    setAuthToken: (token) => set({ authToken: token, authStatus: token ? 'authenticated' : 'idle' }),
    setAuthStatus: (status) => set({ authStatus: status }),
    setAuthError: (msg) => set({ authError: msg }),
    setIsLoadingData: (loading) => set({ isLoadingData: loading }),
    setSaveError: (error) => set({ saveError: error }),
    setNotificationSettings: (settings) => set({ notificationSettings: settings }),
    fetchNotificationSettings: async () => {
        const token = get().authToken;
        const settings = await apiGet<NotificationSettings>('/api/notification-settings', token ?? undefined);
        set({ notificationSettings: settings });
    },
    updateNotificationSettings: async (patch) => {
        const token = get().authToken;
        const updated = await apiPut<NotificationSettings>('/api/notification-settings', patch, token ?? undefined);
        set({ notificationSettings: updated });
    },
    setThemeSettings: (settings) => set({ themeSettings: settings }),
    updateThemeSettings: (patch) => {
        set((state) => ({
            themeSettings: { ...state.themeSettings, ...patch }
        }));
    },
    setNotificationPanelSide: (side) => {
        localStorage.setItem('notification_panel_side', side);
        set({ notificationPanelSide: side });
    },

    // Task Actions — via API (todox-backend/src/routes/tasks.ts)
    fetchTasks: async () => {
        const token = get().authToken;
        // `archived=true` : GET /api/tasks filtre `archived: false` par défaut côté serveur
        // (todox-backend/src/routes/tasks.ts) -- sans ce paramètre, les tâches archivées ne
        // sont JAMAIS renvoyées, et disparaissent donc silencieusement de l'état local au
        // prochain poll (voir useApiSync.ts, toutes les ~10s). Avec `archived=true`, le
        // serveur applique au contraire AUCUN filtre sur ce champ (`archived: undefined`) et
        // renvoie tout, actif ET archivé -- ce que l'app attend depuis toujours côté client
        // (useFilters.ts filtre `!t.archived` lui-même pour l'affichage). Trouvé en direct
        // pendant le smoke test manuel de la Tâche 12 : archiver un projet fonctionnait, mais
        // le désarchiver redevenait impossible dès que le poll suivant avait tourné.
        const tasks = await apiGet<Task[]>('/api/tasks?archived=true', token ?? undefined);

        // Merge (pas remplacement complet) : le backend n'a aucune colonne pour
        // `ganttDays`/`convertedFromSubtask` (voir le commentaire de `addTask`/`updateTask`
        // plus haut dans ce fichier, même raison) — la réponse de GET /api/tasks ne les
        // contient donc jamais. Ce hook est appelé toutes les 10s et à chaque focus fenêtre
        // (voir useApiSync.ts) : un `set({ tasks })` brut effacerait silencieusement ces deux
        // champs sur TOUTES les tâches à chaque poll. On reporte donc la valeur locale
        // existante (par id) sur chaque tâche de la réponse serveur, exactement comme le fait
        // déjà `updateTask`.
        const localById = new Map(get().tasks.map(t => [t.id, t]));
        const merged = tasks.map(t => {
            const local = localById.get(t.id);
            return {
                ...t,
                ganttDays: t.ganttDays ?? local?.ganttDays ?? [],
                ...(local?.convertedFromSubtask ? { convertedFromSubtask: local.convertedFromSubtask } : {}),
            };
        });

        set({ tasks: merged });
    },
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

        // Récurrence : si la tâche passe en "done", créer la prochaine occurrence si applicable.
        // Le serveur fait autorité sur `id` pour toute création (contrainte globale du plan,
        // voir addTask plus haut) — on ne pousse donc plus une tâche avec un id généré
        // côté client (uid()) directement en state : avant ce fix, ce push local-only était
        // effacé silencieusement par le poll 10s de fetchTasks dès que ce dernier a été
        // branché (régression C3 de la review finale de branche), puisque cette tâche
        // n'existait tout simplement pas côté serveur.
        if (patch.status === "done") {
            const completedTask = get().tasks.find(t => t.id === id);
            if (completedTask) {
                const nextTask = buildRecurringTask(completedTask, Date.now());
                if (nextTask) {
                    const recurToken = get().authToken;
                    const recurPayload = {
                        title: nextTask.title,
                        project: nextTask.project,
                        status: 'todo' as const,
                        priority: nextTask.priority,
                        due: nextTask.due,
                        notes: nextTask.notes,
                        assignedTo: nextTask.assignedTo,
                        favorite: nextTask.favorite,
                        order: nextTask.order,
                        parentTaskId: nextTask.parentTaskId ?? null,
                        recurrence: nextTask.recurrence,
                    };
                    const createdNext = await apiPost<Task>('/api/tasks', recurPayload, recurToken ?? undefined);

                    // Les sous-tâches n'ont pas d'équivalent dans le payload de création (POST
                    // /api/tasks ne les accepte pas, voir todox-backend/src/routes/tasks.ts) —
                    // on les recrée donc une par une via la vraie route subtasks plutôt que de
                    // les garder en mémoire seule : sinon elles seraient elles-mêmes effacées
                    // par le prochain poll, exactement le bug que ce fix corrige. Une sous-tâche
                    // fraîchement créée est déjà `completed: false` par défaut côté serveur, ce
                    // qui correspond exactement à la remise à zéro voulue ici.
                    const recreatedSubtasks = await Promise.all(
                        completedTask.subtasks.map(st =>
                            apiPost<Subtask>(`/api/tasks/${createdNext.id}/subtasks`, { title: st.title }, recurToken ?? undefined)
                        )
                    );

                    // Même raison que addTask/updateTask ci-dessus : `ganttDays` et
                    // `convertedFromSubtask` n'ont aucune colonne backend.
                    const finalNextTask: Task = {
                        ...createdNext,
                        ganttDays: [],
                        subtasks: recreatedSubtasks,
                        ...(nextTask.convertedFromSubtask ? { convertedFromSubtask: nextTask.convertedFromSubtask } : {}),
                    };

                    set(state => ({ tasks: [finalNextTask, ...state.tasks] }));
                }
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

    // Convertie en appel réseau (via updateTask, qui gère déjà correctement la dérivation
    // serveur de `completedAt` et le merge ganttDays/convertedFromSubtask) : cette action
    // était auparavant 100% locale et synchrone — le poll 10s de useApiSync (fetchTasks,
    // voir Fix 1 plus haut) l'annulait donc silencieusement peu après (régression C3 de la
    // review finale de branche).
    moveProject: async (projectName, fromStatus, toStatus) => {
        const matching = get().tasks.filter(t => t.project === projectName && t.status === fromStatus);
        await Promise.all(matching.map(t => get().updateTask(t.id, { status: toStatus })));
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

    // Convertie en appel réseau via updateTask (voir commentaire de moveProject ci-dessus,
    // même raison — régression C3). Le backend n'auto-dérive PAS `archivedAt` d'un
    // changement d'`archived` (contrairement à `completedAt` pour `status`) : il faut donc
    // envoyer les deux champs explicitement (voir todox-backend/src/routes/tasks.ts,
    // `if (u.archived !== undefined) ...` / `if (u.archivedAt !== undefined) ...`).
    archiveProject: async (projectName) => {
        const matching = get().tasks.filter(t => t.project === projectName);
        await Promise.all(matching.map(t => get().updateTask(t.id, { archived: true, archivedAt: Date.now() })));
    },

    unarchiveProject: async (projectName) => {
        const matching = get().tasks.filter(t => t.project === projectName && t.archived);
        await Promise.all(matching.map(t => get().updateTask(t.id, { archived: false, archivedAt: null })));
    },

    // Convertie via removeTask (déjà un vrai appel réseau — DELETE /api/tasks/:id fait ce
    // même soft-delete côté serveur) plutôt que de dupliquer un PUT { deletedAt } ici (voir
    // commentaire de moveProject ci-dessus, même raison — régression C3).
    deleteArchivedProject: async (projectName) => {
        const matching = get().tasks.filter(t => t.project === projectName && t.archived);
        await Promise.all(matching.map(t => get().removeTask(t.id)));
    },

    // NON convertie en appel réseau (contrairement à moveProject/archiveProject/
    // unarchiveProject/deleteArchivedProject/reorderTask ci-dessus) : cette action touche 4
    // slices d'état différentes (tasks, timeEntries, directories, projectColors) et il
    // n'existe aucune route backend bulk pour la plupart d'entre elles -- une conversion
    // partielle/fragile ici risquerait une régression pire que celle qu'elle corrige. Le
    // contrôle de renommage est donc désactivé côté UI (voir ProjectsListPanel.tsx et
    // CircularProgressBadge.tsx) plutôt que silencieusement annulé par le poll.
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
    reorderTask: async (draggedId, targetId, position) => {
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

        const orderMap = new Map<string, number>();
        withoutDragged.forEach((t, i) => orderMap.set(t.id, i * 1000));

        // Convertie en appel réseau (via updateTask, qui persiste local + serveur) : cette
        // action était 100% locale et synchrone — le poll 10s de useApiSync l'annulait donc
        // silencieusement peu après (régression C3). On ne PUT que les tâches dont l'ordre a
        // réellement changé : la plupart du groupe ne bouge pas lors d'un drag&drop, inutile
        // d'appeler le serveur pour chaque tâche du groupe à chaque réordonnancement.
        const changed = withoutDragged.filter(t => (t.order ?? 0) !== orderMap.get(t.id));
        await Promise.all(changed.map(t => get().updateTask(t.id, { order: orderMap.get(t.id)! })));
    },

    // Templates
    setTemplates: (templates) => set({ templates }),
    fetchTemplates: async () => {
        const token = get().authToken;
        const templates = await apiGet<TaskTemplate[]>('/api/templates', token ?? undefined);
        set({ templates });
    },
    addTemplate: async (template) => {
        const token = get().authToken;
        const created = await apiPost<TaskTemplate>('/api/templates', template, token ?? undefined);
        set(state => ({ templates: [...state.templates, created] }));
    },
    deleteTemplate: async (id) => {
        const token = get().authToken;
        await apiDelete(`/api/templates/${id}`, token ?? undefined);
        set(state => ({ templates: state.templates.filter(t => t.id !== id) }));
    },
    applyTemplateToTask: (taskId, templateId) => {
        const tpl = get().templates.find(t => t.id === templateId);
        if (!tpl) return;
        tpl.subtaskTitles.forEach(title => get().addSubtask(taskId, title));
    },

    // Saved Reports
    setSavedReports: (savedReports) => set({ savedReports }),
    fetchSavedReports: async () => {
        const token = get().authToken;
        const reports = await apiGet<SavedReport[]>('/api/saved-reports', token ?? undefined);
        set({ savedReports: reports });
    },
    saveReport: async (report) => {
        const token = get().authToken;
        const created = await apiPost<SavedReport>('/api/saved-reports', report, token ?? undefined);
        set(state => ({ savedReports: [...state.savedReports, created] }));
    },
    deleteReport: async (id) => {
        const token = get().authToken;
        await apiDelete(`/api/saved-reports/${id}`, token ?? undefined);
        set(state => ({ savedReports: state.savedReports.filter(r => r.id !== id) }));
    },

    // ── In-app notifications ────────────────────────────────────────────────
    setAppNotifications: (appNotifications) => set({ appNotifications }),

    addAppNotification: (notif) => {
        const full: AppNotification = { ...notif, id: uid(), createdAt: Date.now() };
        set(state => ({ appNotifications: [full, ...state.appNotifications] }));
    },

    fetchAppNotifications: async () => {
        const token = get().authToken;
        const notifs = await apiGet<AppNotification[]>('/api/notifications', token ?? undefined);
        set({ appNotifications: notifs });
    },

    markNotificationRead: async (notifId) => {
        const token = get().authToken;
        await apiPatch(`/api/notifications/${notifId}/read`, {}, token ?? undefined);
        set(state => ({ appNotifications: state.appNotifications.map(n => n.id === notifId ? { ...n, readAt: Date.now() } : n) }));
    },

    markAllNotificationsRead: async (userId) => {
        const token = get().authToken;
        await apiPatch('/api/notifications/read-all', {}, token ?? undefined);
        set(state => ({ appNotifications: state.appNotifications.map(n => n.toUserId === userId ? { ...n, readAt: n.readAt ?? Date.now() } : n) }));
    },

    markNotificationsByTypeRead: async (types, userId) => {
        const token = get().authToken;
        const typeSet = new Set(types);
        const toMark = get().appNotifications.filter(n => n.toUserId === userId && !n.readAt && typeSet.has(n.type));
        await Promise.all(toMark.map(n => apiPatch(`/api/notifications/${n.id}/read`, {}, token ?? undefined)));
        set(state => ({
            appNotifications: state.appNotifications.map(n =>
                n.toUserId === userId && !n.readAt && typeSet.has(n.type)
                    ? { ...n, readAt: Date.now() }
                    : n
            )
        }));
    },

    deleteNotificationForUser: async (notifId, _userId) => {
        const token = get().authToken;
        await apiDelete(`/api/notifications/${notifId}`, token ?? undefined);
        set(state => ({ appNotifications: state.appNotifications.filter(n => n.id !== notifId) }));
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

    fetchTimeEntries: async (from?: string, to?: string) => {
        const token = get().authToken;
        const qs = from && to ? `?from=${from}&to=${to}` : '';
        const entries = await apiGet<TimeEntry[]>(`/api/time-entries${qs}`, token ?? undefined);
        set({ timeEntries: entries });
    },

    upsertTimeEntry: async (project, date, hours, userId, note) => {
        const token = get().authToken;
        const existing = get().timeEntries.find(e => e.project === project && e.date === date && e.userId === userId);

        if (hours <= 0) {
            if (existing) {
                await apiDelete(`/api/time-entries/${existing.id}`, token ?? undefined);
                set(state => ({ timeEntries: state.timeEntries.filter(e => e.id !== existing.id) }));
            }
            return;
        }

        if (existing) {
            const updated = await apiPut<TimeEntry>(`/api/time-entries/${existing.id}`, { hours, note }, token ?? undefined);
            set(state => ({ timeEntries: state.timeEntries.map(e => e.id === existing.id ? updated : e) }));
        } else {
            const created = await apiPost<TimeEntry>('/api/time-entries', { project, date, hours, note }, token ?? undefined);
            set(state => ({ timeEntries: [...state.timeEntries, created] }));
        }
    },

    deleteTimeEntry: async (project, date, userId) => {
        const token = get().authToken;
        const existing = get().timeEntries.find(e => e.project === project && e.date === date && e.userId === userId);
        if (!existing) return;
        await apiDelete(`/api/time-entries/${existing.id}`, token ?? undefined);
        set(state => ({ timeEntries: state.timeEntries.filter(e => e.id !== existing.id) }));
    },

    // ── Outlook / ICS ───────────────────────────────────────────────────────
    fetchOutlookConfig: async () => {
        const token = get().authToken;
        const config = await apiGet<OutlookConfig>('/api/outlook-config', token ?? undefined);
        const currentUser = get().currentUser;
        set(state => ({
            outlookConfig: config,
            outlookConfigs: currentUser ? { ...state.outlookConfigs, [currentUser]: config } : state.outlookConfigs,
        }));
    },
    setOutlookConfig: async (patch) => {
        const token = get().authToken;
        const updated = await apiPut<OutlookConfig>('/api/outlook-config', patch, token ?? undefined);
        const currentUser = get().currentUser;
        set(state => ({
            outlookConfig: updated,
            outlookConfigs: currentUser ? { ...state.outlookConfigs, [currentUser]: updated } : state.outlookConfigs,
        }));
    },
    setOutlookConfigs: (configs) => set({ outlookConfigs: configs }),
    setOutlookEvents: (events) => set({ outlookEvents: events }),
    setHighlightedTaskId: (id) => set({ highlightedTaskId: id }),
    setHighlightedCommentId: (id) => set({ highlightedCommentId: id }),
}));

export default useStore;
