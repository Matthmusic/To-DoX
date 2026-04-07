import { create } from 'zustand';
import { todayISO, uid, devWarn } from '../utils';
import { FIXED_USERS, DEFAULT_NOTIFICATION_SOUND } from '../constants';
import { DEFAULT_THEME } from '../themes/presets';
import { IS_API_MODE } from '../api/client';
import { apiSetReviewers, apiValidateTask, apiRequestCorrections } from '../api/tasks';
import type { Task, TaskData, User, Directories, NotificationSettings, ThemeSettings, Comment, TaskTemplate, SavedReport, AppNotification, TimeEntry, OutlookConfig, OutlookEvent } from '../types';

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
    setProjectColor: (projectName: string, colorIndex: number) => void;
    setUsers: (users: User[]) => void;
    setCurrentUser: (userId: string | null) => void;
    setViewAsUser: (userId: string | null) => void;
    setStoragePath: (path: string | null) => void;
    setIsLoadingData: (loading: boolean) => void;
    setSaveError: (error: string | null) => void;
    setNotificationSettings: (settings: NotificationSettings) => void;
    updateNotificationSettings: (patch: Partial<NotificationSettings>) => void;
    setThemeSettings: (settings: ThemeSettings) => void;
    updateThemeSettings: (patch: Partial<ThemeSettings>) => void;

    // Task Actions
    addTask: (data: TaskData) => void;
    updateTask: (id: string, patch: Partial<Task>) => void;
    removeTask: (id: string) => void;
    convertSubtaskBack: (taskId: string) => 'ok' | 'parent_deleted' | 'parent_not_found';
    setTaskParent: (childId: string, parentId: string | null) => void;
    moveTask: (id: string, status: string) => void;
    archiveTask: (id: string) => void;
    unarchiveTask: (id: string) => void;
    moveProject: (projectName: string, fromStatus: Task['status'], toStatus: Task['status']) => void;

    // Subtasks
    addSubtask: (taskId: string, title: string) => void;
    toggleSubtask: (taskId: string, subtaskId: string) => void;
    deleteSubtask: (taskId: string, subtaskId: string) => void;
    updateSubtaskTitle: (taskId: string, subtaskId: string, title: string) => void;
    assignSubtask: (taskId: string, subtaskId: string, userId: string) => void;
    unassignSubtask: (taskId: string, subtaskId: string, userId: string) => void;
    setSubtaskDates: (taskId: string, subtaskId: string, patch: { startDate?: string | null; endDate?: string | null }) => void;
    reorderSubtasks: (taskId: string, start: number, end: number) => void;

    // Comments
    comments: Record<string, Comment[]>;
    setComments: (comments: Record<string, Comment[]>) => void;
    addComment: (taskId: string, text: string) => void;
    deleteComment: (taskId: string, commentId: string) => void;

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
    deleteNotificationForUser: (notifId: string, userId: string) => void;

    // Review workflow
    setReviewers: (taskId: string, reviewers: string[]) => void;
    validateTask: (taskId: string) => void;
    requestCorrections: (taskId: string, comment: string) => void;
    reopenTask: (taskId: string) => void;

    // Ephemeral UI state — dialog d'assignation réviseur (action locale uniquement, non persisté)
    pendingReviewDialogTaskId: string | null;
    setPendingReviewDialogTaskId: (taskId: string | null) => void;

    // Feuilles de pointage
    timeEntries: TimeEntry[];
    setTimeEntries: (entries: TimeEntry[]) => void;
    upsertTimeEntry: (project: string, date: string, hours: number, userId: string, note?: string) => void;
    deleteTimeEntry: (project: string, date: string, userId: string) => void;

    // Intégration Outlook / ICS
    outlookConfig: OutlookConfig;
    outlookEvents: OutlookEvent[];         // transient (non persisté)
    setOutlookConfig: (patch: Partial<OutlookConfig>) => void;
    setOutlookEvents: (events: OutlookEvent[]) => void;

    // UI transient — mise en surbrillance d'une tâche (depuis notif)
    highlightedTaskId: string | null;
    setHighlightedTaskId: (id: string | null) => void;

    // Présence — utilisateurs actuellement connectés (SSE, transient)
    onlineUsers: Set<string>;
    setOnlineUsers: (users: Set<string>) => void;
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
    outlookEvents: [],
    highlightedTaskId: null,
    onlineUsers: new Set<string>(),

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
    setProjectColor: (projectName, colorIndex) => {
        set((state) => ({ projectColors: { ...state.projectColors, [projectName]: colorIndex } }));
    },
    setUsers: (users) => set({ users }),
    setCurrentUser: (userId) => set({ currentUser: userId }),
    setViewAsUser: (userId) => set({ viewAsUser: userId }),
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

    // Task Actions
    addTask: (data) => {
        const currentUser = get().currentUser;

        if (!currentUser || currentUser === "unassigned") {
            devWarn("Tentative de création de tâche sans utilisateur connecté");
            return;
        }

        const projectName = (data.project?.trim() || "DIVERS").toUpperCase();
        const now = Date.now();
        const status = data.status || "todo";

        const newTask: Task = {
            id: uid(),
            title: (data.title?.trim() || "Sans titre").toUpperCase(),
            project: projectName,
            due: data.due || todayISO(),
            priority: data.priority || "med",
            status,
            createdBy: data.createdBy || currentUser,
            assignedTo: data.assignedTo || [currentUser],
            createdAt: now,
            updatedAt: now,
            completedAt: status === "done" ? now : null,
            notes: data.notes || "",
            archived: false,
            archivedAt: null,
            subtasks: [],
            favorite: false,
            deletedAt: null,
            ganttDays: [],
            order: 0,
            ...(data.convertedFromSubtask ? { convertedFromSubtask: data.convertedFromSubtask } : {}),
        };

        set((state) => ({ tasks: [newTask, ...state.tasks] }));

        get().addToProjectHistory(projectName);

        if (data.folderPath) {
            set((state) => ({ directories: { ...state.directories, [projectName]: data.folderPath! } }));
        }
    },

    updateTask: (id, patch) => {
        if (patch.project) {
            get().addToProjectHistory(patch.project);
        }

        const updatedPatch = { ...patch };
        if (patch.title) {
            updatedPatch.title = (patch.title.trim() || patch.title).toUpperCase();
        }
        if (patch.status === "done") {
            updatedPatch.completedAt = Date.now();
        } else if (patch.status) {
            updatedPatch.completedAt = null;
        }
        if (patch.status === 'review') {
            updatedPatch.movedToReviewBy = get().currentUser ?? undefined;
            updatedPatch.movedToReviewAt = Date.now();
        }

        // Workflow review : si la tâche passe en "review" avec des réviseurs déjà définis → notifier
        // En mode API : géré par le backend (PUT /api/tasks/:id détecte le changement de statut)
        if (!IS_API_MODE && patch.status === 'review') {
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

        const now = Date.now();
        set((state) => ({
            tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updatedPatch, updatedAt: now } : t))
        }));

        // Récurrence : si la tâche passe en "done", créer la prochaine occurrence si applicable
        // En mode API : géré par le backend (PUT /api/tasks/:id + POST /api/tasks/:id/validate)
        if (!IS_API_MODE && patch.status === "done") {
            const completedTask = get().tasks.find(t => t.id === id);
            if (completedTask) {
                const nextTask = buildRecurringTask(completedTask, now);
                if (nextTask) set(state => ({ tasks: [nextTask, ...state.tasks] }));
            }
        }
    },

    removeTask: (id) => {
        const now = Date.now();
        set((state) => ({
            tasks: state.tasks.map((t) => t.id === id ? { ...t, deletedAt: now, updatedAt: now } : t)
        }));
    },

    convertSubtaskBack: (taskId) => {
        const task = get().tasks.find(t => t.id === taskId);
        if (!task?.convertedFromSubtask) return 'parent_not_found';
        const { parentTaskId } = task.convertedFromSubtask;
        const parentTask = get().tasks.find(t => t.id === parentTaskId);
        // Parent introuvable ou définitivement supprimé → impossible, on ne touche pas à la tâche
        if (!parentTask || parentTask.deletedAt) return 'parent_not_found';
        // Parent archivé → reconversion possible (sous-tâche rattachée à la tâche archivée)
        get().addSubtask(parentTaskId, task.title);
        get().removeTask(taskId);
        return parentTask.archived ? 'parent_deleted' : 'ok';
    },

    setTaskParent: (childId, parentId) => {
        set(state => ({
            tasks: state.tasks.map(t =>
                t.id === childId
                    ? { ...t, parentTaskId: parentId ?? undefined, updatedAt: Date.now() }
                    : t
            ),
        }));
    },

    moveTask: (id, status) => {
        if (status === 'review') {
            const task = get().tasks.find(t => t.id === id);
            if (task && !(task.reviewers?.length)) {
                set({ pendingReviewDialogTaskId: id });
            }
        }
        get().updateTask(id, { status: status as Task['status'] });
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

    // Subtasks
    addSubtask: (taskId, title) => {
        if (!title.trim()) return;
        const now = Date.now();
        const newSubtask = {
            id: uid(),
            title: title.trim(),
            completed: false,
            createdAt: now,
            completedAt: null,
            completedBy: null,
        };
        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id === taskId) {
                    return {
                        ...t,
                        subtasks: [...(t.subtasks || []), newSubtask],
                        updatedAt: now
                    };
                }
                return t;
            })
        }));
    },

    toggleSubtask: (taskId, subtaskId) => {
        // Trouver l'état actuel pour déterminer la nouvelle valeur
        const task = get().tasks.find(t => t.id === taskId);
        const sub = task?.subtasks?.find(s => s.id === subtaskId);
        const newCompleted = sub ? !sub.completed : true;
        const completedBy = newCompleted ? (get().currentUser || null) : null;

        // Optimiste
        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id === taskId) {
                    const sts = (t.subtasks || []).map(st => st.id === subtaskId ? { ...st, completed: newCompleted, completedAt: newCompleted ? Date.now() : null, completedBy } : st);
                    return { ...t, subtasks: sts, updatedAt: Date.now() };
                }
                return t;
            })
        }));

    },

    deleteSubtask: (taskId, subtaskId) => {
        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id === taskId) {
                    return { ...t, subtasks: (t.subtasks || []).filter(st => st.id !== subtaskId), updatedAt: Date.now() };
                }
                return t;
            })
        }));
    },

    updateSubtaskTitle: (taskId, subtaskId, title) => {
        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id === taskId) {
                    const sts = (t.subtasks || []).map(st => st.id === subtaskId ? { ...st, title } : st);
                    return { ...t, subtasks: sts, updatedAt: Date.now() };
                }
                return t;
            })
        }));
    },

    assignSubtask: (taskId, subtaskId, userId) => {
        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id !== taskId) return t;
                const sts = (t.subtasks || []).map(st => {
                    if (st.id !== subtaskId) return st;
                    const current = st.assignedTo || [];
                    return current.includes(userId) ? st : { ...st, assignedTo: [...current, userId] };
                });
                return { ...t, subtasks: sts, updatedAt: Date.now() };
            })
        }));
    },

    unassignSubtask: (taskId, subtaskId, userId) => {
        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id !== taskId) return t;
                const sts = (t.subtasks || []).map(st => {
                    if (st.id !== subtaskId) return st;
                    return { ...st, assignedTo: (st.assignedTo || []).filter(id => id !== userId) };
                });
                return { ...t, subtasks: sts, updatedAt: Date.now() };
            })
        }));
    },

    setSubtaskDates: (taskId, subtaskId, patch) => {
        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id !== taskId) return t;
                const sts = (t.subtasks || []).map(st =>
                    st.id === subtaskId ? { ...st, ...patch } : st
                );
                return { ...t, subtasks: sts, updatedAt: Date.now() };
            })
        }));
    },

    reorderSubtasks: (taskId, start, end) => {
        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id === taskId) {
                    const sts = [...(t.subtasks || [])];
                    const [rem] = sts.splice(start, 1);
                    sts.splice(end, 0, rem);
                    return { ...t, subtasks: sts, updatedAt: Date.now() };
                }
                return t;
            })
        }));
    },

    // Comments
    setComments: (comments) => set({ comments }),

    addComment: (taskId, text) => {
        const { currentUser, users, tasks } = get();
        if (!currentUser || !text.trim()) return;
        const commentId = uid();
        const newComment: Comment = {
            id: commentId,
            taskId,
            userId: currentUser,
            text: text.trim(),
            createdAt: Date.now(),
            deletedAt: null,
        };
        set(state => ({
            comments: {
                ...state.comments,
                [taskId]: [...(state.comments[taskId] || []), newComment],
            }
        }));

        // En mode API : notifications créées par le backend après le POST du commentaire
        if (IS_API_MODE) return;

        // Détecter les @mentions et notifier les utilisateurs concernés (mode local uniquement)
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

    deleteComment: (taskId, commentId) => {
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
    setReviewers: (taskId, reviewers) => {
        const { currentUser, users, tasks } = get();
        const task = tasks.find(t => t.id === taskId);
        if (!task || !currentUser) return;

        const now = Date.now();

        // Mise à jour optimiste dans le store (tous modes)
        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id !== taskId) return t;
                const newAssignees = reviewers.filter(r => !t.assignedTo.includes(r) && r !== 'unassigned');
                const baseAssigned = t.assignedTo.filter(id => id !== 'unassigned');
                const updatedAssignedTo = newAssignees.length > 0
                    ? [...baseAssigned, ...newAssignees]
                    : t.assignedTo;
                return { ...t, reviewers, assignedTo: updatedAssignedTo, updatedAt: now };
            })
        }));

        if (IS_API_MODE) {
            // Le backend persiste + crée les notifications + broadcast SSE task:updated
            // On ne met PAS à jour updatedAt pour éviter que useApiSave double-envoie un PUT
            apiSetReviewers(taskId, reviewers).catch(err =>
                console.warn('[API] Erreur setReviewers:', err)
            );
            return;
        }

        // Mode local : notifications créées directement dans le store
        const fromUser = users.find(u => u.id === currentUser);
        const fromUserName = fromUser?.name || currentUser;
        reviewers.forEach(reviewerId => {
            get().addAppNotification({
                type: 'review_requested',
                taskId,
                taskTitle: task.title,
                fromUserId: currentUser,
                toUserId: reviewerId,
                message: `${fromUserName} t'a assigné comme réviseur sur ${task.title}`,
            });
        });
    },

    validateTask: (taskId) => {
        const { currentUser, users, tasks } = get();
        const task = tasks.find(t => t.id === taskId);
        if (!task || !currentUser) return;

        const now = Date.now();

        if (IS_API_MODE) {
            // Mise à jour optimiste du store
            get().updateTask(taskId, { status: 'done', reviewValidatedBy: currentUser, reviewValidatedAt: now });
            // Le backend gère : notifications, récurrence, persistance
            apiValidateTask(taskId).catch(err =>
                console.warn('[API] Erreur validateTask:', err)
            );
            return;
        }

        // Mode local : logique complète (récurrence + notifications)
        const fromUser = users.find(u => u.id === currentUser);
        const fromUserName = fromUser?.name || currentUser;
        get().updateTask(taskId, { status: 'done', reviewValidatedBy: currentUser, reviewValidatedAt: now });
        task.assignedTo.forEach(assigneeId => {
            get().addAppNotification({
                type: 'review_validated',
                taskId,
                taskTitle: task.title,
                fromUserId: currentUser,
                toUserId: assigneeId,
                message: `${fromUserName} a validé la tâche ${task.title} ✅`,
            });
        });
    },

    requestCorrections: (taskId, comment) => {
        const { currentUser, users, tasks } = get();
        const task = tasks.find(t => t.id === taskId);
        if (!task || !currentUser) return;

        const now = Date.now();

        if (IS_API_MODE) {
            // Mise à jour optimiste du statut uniquement — PAS du commentaire
            // Le backend crée le commentaire (POST /corrections) et le broadcast via SSE
            // Appeler addComment() ici créerait un doublon dans la DB
            get().updateTask(taskId, { status: 'doing', reviewRejectedBy: currentUser, reviewRejectedAt: now, rejectionComment: comment });
            apiRequestCorrections(taskId, comment).catch(err =>
                console.warn('[API] Erreur requestCorrections:', err)
            );
            return;
        }

        // Mode local : logique complète
        const fromUser = users.find(u => u.id === currentUser);
        const fromUserName = fromUser?.name || currentUser;
        get().updateTask(taskId, { status: 'doing', reviewRejectedBy: currentUser, reviewRejectedAt: now, rejectionComment: comment });
        get().addComment(taskId, `↩️ Corrections demandées : ${comment}`);
        task.assignedTo.forEach(assigneeId => {
            get().addAppNotification({
                type: 'review_rejected',
                taskId,
                taskTitle: task.title,
                fromUserId: currentUser,
                toUserId: assigneeId,
                message: `${fromUserName} demande des corrections sur ${task.title} : ${comment}`,
            });
        });
    },

    reopenTask: (taskId) => {
        get().updateTask(taskId, {
            status: 'doing',
            reviewValidatedBy: undefined,
            reviewValidatedAt: undefined,
            reviewRejectedBy: undefined,
            reviewRejectedAt: undefined,
            rejectionComment: undefined,
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
        set(state => ({ outlookConfig: { ...state.outlookConfig, ...patch } }));
    },
    setOutlookEvents: (events) => set({ outlookEvents: events }),
    setHighlightedTaskId: (id) => set({ highlightedTaskId: id }),
    setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
}));

export default useStore;
