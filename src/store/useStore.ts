import { create } from 'zustand';
import { todayISO, uid } from '../utils';
import { FIXED_USERS } from '../constants';
import type { Task, TaskData, User, Directories } from '../types';

interface StoreState {
    // State
    tasks: Task[];
    directories: Directories;
    projectHistory: string[];
    projectColors: Record<string, number>;
    users: User[];
    currentUser: string | null; // ID de l'utilisateur actuellement connecté
    collapsedProjects: Record<string, boolean>;
    storagePath: string | null;
    isLoadingData: boolean;
    saveError: string | null;

    // Simple Setters
    setTasks: (tasks: Task[]) => void;
    setDirectories: (directories: Directories) => void;
    setProjectHistory: (history: string[]) => void;
    setProjectColors: (colors: Record<string, number>) => void;
    setProjectColor: (projectName: string, colorIndex: number) => void;
    setUsers: (users: User[]) => void;
    setCurrentUser: (userId: string | null) => void;
    setStoragePath: (path: string | null) => void;
    setIsLoadingData: (loading: boolean) => void;
    setSaveError: (error: string | null) => void;

    // Task Actions
    addTask: (data: TaskData) => void;
    updateTask: (id: string, patch: Partial<Task>) => void;
    removeTask: (id: string) => void;
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

    // Projects
    addToProjectHistory: (projectName: string) => void;
    toggleProjectCollapse: (status: string, project: string) => void;
    isProjectCollapsed: (status: string, project: string) => boolean;
    archiveProject: (projectName: string) => void;
    unarchiveProject: (projectName: string) => void;
    deleteArchivedProject: (projectName: string) => void;
}

const useStore = create<StoreState>((set, get) => ({
    // State
    tasks: [],
    directories: {},
    projectHistory: [],
    projectColors: {},
    users: FIXED_USERS, // Liste fixe d'utilisateurs, non modifiable
    currentUser: null, // Par défaut, aucun utilisateur connecté (sera défini plus tard)
    collapsedProjects: {},
    storagePath: null,
    isLoadingData: true,
    saveError: null,

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
    setStoragePath: (path) => set({ storagePath: path }),
    setIsLoadingData: (loading) => set({ isLoadingData: loading }),
    setSaveError: (error) => set({ saveError: error }),

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
            title: data.title?.trim() || "Sans titre",
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
        if (patch.status === "done") {
            updatedPatch.completedAt = Date.now();
        } else if (patch.status) {
            updatedPatch.completedAt = null;
        }

        // Mise à jour optimiste locale
        const now = Date.now();
        set((state) => ({
            tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updatedPatch, updatedAt: now } : t))
        }));

    },

    removeTask: (id) => {
        const now = Date.now();
        set((state) => ({
            tasks: state.tasks.map((t) => t.id === id ? { ...t, deletedAt: now, updatedAt: now } : t)
        }));
    },

    moveTask: (id, status) => get().updateTask(id, { status: status as Task['status'] }),

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

        // Optimiste
        set(state => ({
            tasks: state.tasks.map(t => {
                if (t.id === taskId) {
                    const sts = (t.subtasks || []).map(st => st.id === subtaskId ? { ...st, completed: newCompleted, completedAt: newCompleted ? Date.now() : null } : st);
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
    }
}));

export default useStore;
