import { create } from 'zustand';
import { todayISO, uid } from '../utils';
import { FIXED_USERS, DEFAULT_NOTIFICATION_SOUND } from '../constants';
import { DEFAULT_THEME } from '../themes/presets';
import type { Task, TaskData, User, Directories, NotificationSettings, ThemeSettings, Comment, PendingMention, TaskTemplate, SavedReport, AppNotification } from '../types';

interface StoreState {
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
    convertSubtaskBack: (taskId: string) => void;
    moveTask: (id: string, status: string) => void;
    archiveTask: (id: string) => void;
    unarchiveTask: (id: string) => void;
    moveProject: (projectName: string, fromStatus: Task['status'], toStatus: Task['status']) => void;

    // Subtasks
    addSubtask: (taskId: string, title: string) => void;
    toggleSubtask: (taskId: string, subtaskId: string) => void;
    deleteSubtask: (taskId: string, subtaskId: string) => void;
    updateSubtaskTitle: (taskId: string, subtaskId: string, title: string) => void;
    reorderSubtasks: (taskId: string, start: number, end: number) => void;

    // Comments
    comments: Record<string, Comment[]>;
    setComments: (comments: Record<string, Comment[]>) => void;
    addComment: (taskId: string, text: string) => void;
    deleteComment: (taskId: string, commentId: string) => void;

    // Pending mention notifications
    pendingMentions: Record<string, PendingMention[]>;
    setPendingMentions: (m: Record<string, PendingMention[]>) => void;
    clearPendingMentions: (userId: string) => void;

    // Task reorder
    reorderTask: (draggedId: string, targetId: string, position: 'before' | 'after') => void;

    // Projects
    addToProjectHistory: (projectName: string) => void;
    toggleProjectCollapse: (status: string, project: string) => void;
    isProjectCollapsed: (status: string, project: string) => boolean;
    archiveProject: (projectName: string) => void;
    unarchiveProject: (projectName: string) => void;
    deleteArchivedProject: (projectName: string) => void;

    // Templates
    templates: TaskTemplate[];
    setTemplates: (templates: TaskTemplate[]) => void;
    addTemplate: (template: Omit<TaskTemplate, 'id'>) => void;
    deleteTemplate: (id: string) => void;
    createTaskFromTemplate: (templateId: string) => void;

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

    // Review workflow
    setReviewers: (taskId: string, reviewers: string[]) => void;
    validateTask: (taskId: string) => void;
    requestCorrections: (taskId: string, comment: string) => void;
    reopenTask: (taskId: string) => void;

    // Ephemeral UI state — dialog d'assignation réviseur (action locale uniquement, non persisté)
    pendingReviewDialogTaskId: string | null;
    setPendingReviewDialogTaskId: (taskId: string | null) => void;
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
    pendingMentions: {},
    templates: [],
    savedReports: [],
    appNotifications: [],
    pendingReviewDialogTaskId: null,

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
            console.error("Tentative de création de tâche sans utilisateur connecté");
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

        // Workflow review : si la tâche passe en "review" avec des réviseurs déjà définis → notifier
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

        const now = Date.now();
        set((state) => ({
            tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updatedPatch, updatedAt: now } : t))
        }));

        // Récurrence : si la tâche passe en "done" et a une récurrence, créer la prochaine occurrence
        if (patch.status === "done") {
            const task = get().tasks.find(t => t.id === id);
            if (task?.recurrence) {
                const { type, endsAt } = task.recurrence;
                if (!endsAt || now < endsAt) {
                    // Calculer la prochaine date d'échéance
                    const baseDate = task.due ? new Date(task.due) : new Date();
                    const nextDate = new Date(baseDate);
                    if (type === 'daily') nextDate.setDate(nextDate.getDate() + 1);
                    else if (type === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
                    else if (type === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
                    const nextISO = nextDate.toISOString().split('T')[0];

                    const nextTask: Task = {
                        ...task,
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
                        subtasks: task.subtasks.map(st => ({ ...st, completed: false, completedAt: null })),
                    };
                    set(state => ({ tasks: [nextTask, ...state.tasks] }));
                }
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
        if (!task?.convertedFromSubtask) return;
        const { parentTaskId } = task.convertedFromSubtask;
        const parentExists = get().tasks.some(t => t.id === parentTaskId && !t.deletedAt && !t.archived);
        if (parentExists) {
            get().addSubtask(parentTaskId, task.title);
        }
        get().removeTask(taskId);
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

        // Détecter les @mentions et ajouter des notifications en attente
        const mentionedUsers = users.filter(u =>
            u.id !== currentUser && text.includes(`@${u.name}`)
        );
        if (mentionedUsers.length > 0) {
            const task = tasks.find(t => t.id === taskId);
            const fromUser = users.find(u => u.id === currentUser);
            const taskTitle = task?.title || 'une tâche';
            const fromUserName = fromUser?.name || currentUser;
            set(state => {
                const updated = { ...state.pendingMentions };
                mentionedUsers.forEach(u => {
                    const mention: PendingMention = { commentId, taskId, taskTitle, fromUserId: currentUser, fromUserName };
                    updated[u.id] = [...(updated[u.id] || []), mention];
                });
                return { pendingMentions: updated };
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

    // Pending mentions
    setPendingMentions: (pendingMentions) => set({ pendingMentions }),
    clearPendingMentions: (userId) => {
        set(state => {
            const updated = { ...state.pendingMentions };
            delete updated[userId];
            return { pendingMentions: updated };
        });
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
    createTaskFromTemplate: (templateId) => {
        const { templates, currentUser } = get();
        const tpl = templates.find(t => t.id === templateId);
        if (!tpl || !currentUser) return;
        get().addTask({
            title: tpl.title,
            project: tpl.project,
            priority: tpl.priority,
            assignedTo: tpl.assignedTo.length > 0 ? tpl.assignedTo : [currentUser],
            notes: tpl.notes,
        });
        // Ajouter les sous-tâches après création
        const newTask = get().tasks[0];
        if (newTask && tpl.subtaskTitles.length > 0) {
            tpl.subtaskTitles.forEach(title => get().addSubtask(newTask.id, title));
        }
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

    // ── Review workflow ─────────────────────────────────────────────────────
    setReviewers: (taskId, reviewers) => {
        const { currentUser, users, tasks } = get();
        const task = tasks.find(t => t.id === taskId);
        if (!task || !currentUser) return;

        const fromUser = users.find(u => u.id === currentUser);
        const fromUserName = fromUser?.name || currentUser;
        const now = Date.now();

        set(state => ({
            tasks: state.tasks.map(t => t.id === taskId ? { ...t, reviewers, updatedAt: now } : t)
        }));

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

        const fromUser = users.find(u => u.id === currentUser);
        const fromUserName = fromUser?.name || currentUser;
        const now = Date.now();

        // Utilise updateTask pour déclencher la logique de récurrence automatiquement
        get().updateTask(taskId, {
            status: 'done',
            reviewValidatedBy: currentUser,
            reviewValidatedAt: now,
        });

        // Notifier tous les assignés
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

        const fromUser = users.find(u => u.id === currentUser);
        const fromUserName = fromUser?.name || currentUser;
        const now = Date.now();

        get().updateTask(taskId, {
            status: 'doing',
            reviewRejectedBy: currentUser,
            reviewRejectedAt: now,
            rejectionComment: comment,
        });

        // Ajouter comme commentaire visible dans le fil
        get().addComment(taskId, `↩️ Corrections demandées : ${comment}`);

        // Notifier tous les assignés
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
}));

export default useStore;
