import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { todayISO } from "./utils";
import { migrateTask } from "./utils/taskMigration";

// Store and Types
import useStore from "./store/useStore";
import type { StoredData, Task } from "./types";

type StoredDataRaw = Omit<StoredData, 'tasks'> & { tasks?: unknown[] };

// Composants extraits
import {
    TaskEditPanel,
    TaskCard,
    ArchivePanel,
    TaskArchivePanel,
    ProjectDirs,
    ProjectsListPanel,
    AdminProjectsPanel,
    UsersPanel,
    StoragePanel,
    WeeklyReportModal,
    ConfirmModalHost,
    KanbanHeaderPremium,
    KanbanBoard,
    TimelineView,
    DashboardView,
} from "./components";
import { TermineesView } from "./components/TermineesView";
import { TimesheetView } from "./components/TimesheetView";
import { alertModal } from "./utils/confirm";

// Hooks personnalisés
import { useFilters } from "./hooks/useFilters";
import { useDragAndDrop } from "./hooks/useDragAndDrop";
import { useDefaultShortcuts } from "./hooks/useKeyboardShortcuts";
import { useNotifications } from "./hooks/useNotifications";

// Contexts
import { ShortcutsProvider, type ShortcutsContextValue } from "./contexts/ShortcutsContext";

// Composants raccourcis
import { ShortcutsHelpPanel } from "./components/ShortcutsHelpPanel";

// Composants notifications
import { NotificationsPanel } from "./components/settings/NotificationsPanel";

// Composants thèmes
import { ThemePanel } from "./components/settings/ThemePanel";
import { TemplatesPanel } from "./components/settings/TemplatesPanel";
import { OutlookPanel } from "./components/settings/OutlookPanel";

// Hook Outlook
import { useOutlookSync } from "./hooks/useOutlookSync";

// Error Boundary
import { ErrorBoundary } from "./components/ErrorBoundary";

interface ContextMenuData {
    x: number | null;
    y: number | null;
    task: Task;
}

interface ReviewerPickerDialogProps {
    taskId: string;
    onConfirm: (reviewerIds: string[]) => void;
    onDismiss: () => void;
}

function ReviewerPickerDialog({ taskId, onConfirm, onDismiss }: ReviewerPickerDialogProps) {
    const { tasks, users, currentUser } = useStore();
    const task = tasks.find(t => t.id === taskId);
    const [selected, setSelected] = useState<string[]>(task?.reviewers || []);
    const sortedUsers = [...users].sort((a, b) => {
        if (a.id === currentUser) return -1;
        if (b.id === currentUser) return 1;
        return 0;
    });

    if (!task) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-80 rounded-2xl border border-violet-400/30 bg-[#0f1629] p-5 shadow-2xl">
                <h3 className="mb-1 text-sm font-bold text-white">Désigner un réviseur</h3>
                <p className="mb-4 text-xs text-slate-400 leading-relaxed">
                    La tâche <span className="text-violet-300 font-semibold">"{task.title}"</span> est en révision.
                    Choisissez un ou plusieurs réviseurs.
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto mb-4">
                    {sortedUsers.map(user => (
                        <label key={user.id} className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/5 cursor-pointer transition">
                            <input
                                type="checkbox"
                                checked={selected.includes(user.id)}
                                onChange={(e) => setSelected(e.target.checked
                                    ? [...selected, user.id]
                                    : selected.filter(id => id !== user.id)
                                )}
                                className="h-4 w-4 rounded accent-violet-400"
                            />
                            <span className="text-sm text-slate-100">{user.name}</span>
                        </label>
                    ))}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => onConfirm(selected)}
                        disabled={selected.length === 0}
                        className="flex-1 rounded-xl bg-violet-500/80 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Confirmer
                    </button>
                    <button
                        onClick={onDismiss}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400 transition hover:bg-white/10"
                    >
                        Plus tard
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * To Do X — Application Kanban minimaliste et intelligente
 * Composant principal orchestrant l'interface et la logique métier
 */
export default function ToDoX() {
    // Note: useDataPersistence est maintenant appelé dans App.tsx pour éviter le problème de chicken-and-egg

    const { tasks, directories, projectHistory, users, collapsedProjects, archiveProject, renameProject, currentUser, viewAsUser, pendingMentions, clearPendingMentions, appNotifications, setReviewers, pendingReviewDialogTaskId, setPendingReviewDialogTaskId } = useStore();

    const mentionCount = currentUser ? (pendingMentions[currentUser] || []).length : 0;

    const {
        filterProject,
        setFilterProject,
        filterSearch,
        setFilterSearch,
        grouped,
        filteredTasks,
        filterUser,
    } = useFilters(tasks, viewAsUser ?? currentUser);

    const {
        handleDragStart,
        handleDragStartProject,
        handleDrop,
        handleDragOverTask,
        handleDropOnTask,
        handleDragLeaveTask,
        dropIndicator,
    } = useDragAndDrop();

    // UI State Management
    const [showDirPanel, setShowDirPanel] = useState(false);
    const [showArchivePanel, setShowArchivePanel] = useState(false);
    const [showTaskArchivePanel, setShowTaskArchivePanel] = useState(false);
    const [showUsersPanel, setShowUsersPanel] = useState(false);
    const [showStoragePanel, setShowStoragePanel] = useState(false);
    const [showWeeklyReportPanel, setShowWeeklyReportPanel] = useState(false);
    const [showProjectsListPanel, setShowProjectsListPanel] = useState(false);
    const [showAdminProjectsPanel, setShowAdminProjectsPanel] = useState(false);
    const [showHelpPanel, setShowHelpPanel] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() =>
        localStorage.getItem('todox_notif_enabled') !== 'false'
    );
    const [showThemesPanel, setShowThemesPanel] = useState(false);
    const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
    const [showOutlookPanel, setShowOutlookPanel] = useState(false);
    const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
    const [centeredTask, setCenteredTask] = useState<Task | null>(null);
    const [activeView, setActiveView] = useState<'kanban' | 'timeline' | 'dashboard' | 'terminées' | 'pointage'>('kanban');
    const importFileRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<{ focus: () => void }>(null);
    const quickAddRef = useRef<{ focus: () => void }>(null);
    const [quickAddTrigger, setQuickAddTrigger] = useState(0);

    // Persist collapsed state
    useEffect(() => {
        localStorage.setItem('todox_collapsed_projects', JSON.stringify(collapsedProjects));
    }, [collapsedProjects]);

    // Desktop notifications pour les nouvelles AppNotifications
    const appNotifsInitializedRef = useRef(false);
    const prevUnreadNotifIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        const myUnread = appNotifications.filter(n => n.toUserId === currentUser && !n.readAt);
        const myUnreadIds = new Set(myUnread.map(n => n.id));
        if (!appNotifsInitializedRef.current) {
            prevUnreadNotifIdsRef.current = myUnreadIds;
            appNotifsInitializedRef.current = true;
            return;
        }
        for (const notif of myUnread) {
            if (!prevUnreadNotifIdsRef.current.has(notif.id) && notificationsEnabled) {
                window.electronAPI?.sendNotification('To-Do X', notif.message, `review-${notif.id}`);
            }
        }
        prevUnreadNotifIdsRef.current = myUnreadIds;
    }, [appNotifications, currentUser]);

    // Écouter l'event custom déclenché depuis TitleBar (clic sur notif)
    const handleOpenTaskById = useCallback((taskId: string) => {
        const task = tasks.find(t => t.id === taskId);
        if (task) setContextMenu({ x: window.innerWidth, y: 48, task });
    }, [tasks]);
    useEffect(() => {
        const handler = (e: Event) => {
            const taskId = (e as CustomEvent<{ taskId: string }>).detail?.taskId;
            if (taskId) handleOpenTaskById(taskId);
        };
        window.addEventListener('todox:openTask', handler);
        return () => window.removeEventListener('todox:openTask', handler);
    }, [handleOpenTaskById]);

    // Ouvrir une tâche en mode modal centré (depuis le dashboard)
    useEffect(() => {
        const handler = (e: Event) => {
            const taskId = (e as CustomEvent<{ taskId: string }>).detail?.taskId;
            const task = tasks.find(t => t.id === taskId);
            if (task) setCenteredTask(task);
        };
        window.addEventListener('todox:openTaskModal', handler);
        return () => window.removeEventListener('todox:openTaskModal', handler);
    }, [tasks]);

    // Import/Export Handlers
    const handleExport = () => {
        const dataStr = JSON.stringify({ tasks: tasks.filter(t => !t.deletedAt), directories, projectHistory, users }, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `todox_export_${todayISO()}.json`;
        link.click();
    };

    const handleImportClick = () => importFileRef.current?.click();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // VALIDATION CRITIQUE: L'import ne peut pas se faire sans utilisateur connecté
        if (!currentUser || currentUser === "unassigned") {
            alertModal("Erreur : Vous devez être connecté pour importer des tâches");
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const result = ev.target?.result as string;
                if (!result) return;
                const parsed = JSON.parse(result) as StoredDataRaw;
                const state = useStore.getState();
                const { setTasks, setDirectories, setProjectHistory } = state;

                // Récupérer les données existantes pour le merge
                const existingTasks = state.tasks;
                const existingDirectories = state.directories;
                const existingProjectHistory = state.projectHistory;
                const importerUserId = currentUser; // Plus besoin de fallback, déjà validé

                // Migrer et merger les tâches importées
                if (parsed.tasks) {
                    // Créer un Set des IDs existants pour éviter les doublons
                    const existingTaskIds = new Set(existingTasks.map(t => t.id));

                    const migratedTasks: Task[] = parsed.tasks
                        .map((t) => migrateTask(t, { fallbackUser: importerUserId }))
                        .filter((t) => !existingTaskIds.has(t.id))
                        .map((t) => ({
                            ...t,
                            // Attribuer l'utilisateur actuel comme créateur et assigné des tâches importées
                            createdBy: importerUserId,
                            assignedTo: [importerUserId],
                        }));

                    // Merger avec les tâches existantes
                    setTasks([...existingTasks, ...migratedTasks]);
                }

                // Merger les directories (sans écraser les existants)
                if (parsed.directories) {
                    setDirectories({ ...existingDirectories, ...parsed.directories });
                }

                // Merger l'historique des projets (sans doublons)
                if (parsed.projectHistory) {
                    const mergedHistory = [...new Set([...existingProjectHistory, ...parsed.projectHistory])];
                    setProjectHistory(mergedHistory);
                }

                // Note: On ne touche PAS aux users - ils sont gérés localement

                alertModal(`Import réussi ! ${parsed.tasks?.length || 0} tâche(s) importée(s) et fusionnée(s).`);
            } catch (error) {
                console.error("Import error:", error);
                alertModal("Erreur d'import : fichier JSON invalide");
            }
        };
        reader.readAsText(file);
    };

    const handleContextMenu = (e: React.MouseEvent, task: Task) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, task });
    };

    const handleProjectClick = (projectName: string) => {
        setFilterProject(filterProject === projectName ? "all" : projectName);
    };

    // === NOTIFICATIONS SYSTÈME ===
    useNotifications();

    // === OUTLOOK SYNC ===
    const { fetchOutlookEvents, icsExportPath, icsServerUrl } = useOutlookSync();

    // === KEYBOARD SHORTCUTS ===

    // Détection d'un modal/panel ouvert (pour désactiver certains raccourcis)
    const isAnyModalOpen =
        showDirPanel ||
        showArchivePanel ||
        showTaskArchivePanel ||
        showUsersPanel ||
        showStoragePanel ||
        showWeeklyReportPanel ||
        showProjectsListPanel ||
        showAdminProjectsPanel ||
        showHelpPanel ||
        showNotificationsPanel ||
        showThemesPanel ||
        showOutlookPanel ||
        contextMenu !== null;

    // Callbacks pour les raccourcis clavier
    const shortcutsCallbacks: ShortcutsContextValue = {
        focusQuickAdd: () => {
            setQuickAddTrigger(t => t + 1);
        },

        focusSearch: () => {
            setShowSearch(true);
            // Focus après un micro-délai pour que l'input soit rendu
            setTimeout(() => searchInputRef.current?.focus(), 0);
        },

        openExport: () => {
            handleExport();
        },

        closeModals: () => {
            // Fermer tous les modaux/panels
            setShowDirPanel(false);
            setShowArchivePanel(false);
            setShowTaskArchivePanel(false);
            setShowUsersPanel(false);
            setShowStoragePanel(false);
            setShowWeeklyReportPanel(false);
            setShowProjectsListPanel(false);
            setShowAdminProjectsPanel(false);
            setShowHelpPanel(false);
            setShowNotificationsPanel(false);
            setShowSearch(false);
            setContextMenu(null);
        },

        openArchives: () => {
            setShowTaskArchivePanel(true);
        },

        openProjects: () => {
            setShowProjectsListPanel(true);
        },

        openHelp: () => {
            setShowHelpPanel(true);
        },
    };

    // Activer les raccourcis (hook qui gère tout)
    const { shortcuts } = useDefaultShortcuts(shortcutsCallbacks, isAnyModalOpen);

    return (
        <ShortcutsProvider value={shortcutsCallbacks}>
        <div className="flex h-full w-full flex-col bg-transparent text-theme-primary font-sans selection:bg-purple-500/30">
            {/* HEADER PREMIUM */}
            <KanbanHeaderPremium
                filterProject={filterProject}
                onProjectClick={handleProjectClick}
                onArchiveProject={archiveProject}
                onRenameProject={renameProject}
                onOpenWeeklyReport={() => setShowWeeklyReportPanel(true)}
                onOpenStorage={() => setShowStoragePanel(true)}
                onOpenUsers={() => setShowUsersPanel(true)}
                mentionCount={mentionCount}
                onOpenNotifications={() => {
                    setShowNotificationsPanel(true);
                    if (currentUser) clearPendingMentions(currentUser);
                }}
                notificationsEnabled={notificationsEnabled}
                onToggleNotifications={() => {
                    const next = !notificationsEnabled;
                    setNotificationsEnabled(next);
                    localStorage.setItem('todox_notif_enabled', String(next));
                }}
                onOpenThemes={() => setShowThemesPanel(true)}
                onOpenArchive={() => setShowArchivePanel(true)}
                onOpenDirPanel={() => setShowDirPanel(true)}
                onOpenProjectsList={() => setShowProjectsListPanel(true)}
                isAdmin={currentUser === "matthieu"}
                onOpenAdminProjects={() => setShowAdminProjectsPanel(true)}
                onOpenTaskArchive={() => setShowTaskArchivePanel(true)}
                onExport={handleExport}
                onImport={handleImportClick}
                onOpenHelp={() => setShowHelpPanel(true)}
                onOpenTemplates={() => setShowTemplatesPanel(true)}
                onOpenOutlook={() => setShowOutlookPanel(true)}
                activeView={activeView}
                onViewChange={setActiveView}
                filterSearch={filterSearch}
                onSearchChange={setFilterSearch}
                searchInputRef={searchInputRef}
                quickAddRef={quickAddRef}
                triggerOpenQuickAdd={quickAddTrigger}
                showSearch={showSearch}
            />

            {/* MAIN CONTENT */}
            <ErrorBoundary name="KanbanBoard">
                {activeView === 'kanban' ? (
                    <KanbanBoard
                        grouped={grouped}
                        collapsedProjects={collapsedProjects}
                        onDragStartProject={handleDragStartProject}
                        onDragStartTask={handleDragStart}
                        onDrop={handleDrop}
                        onClickTask={(task) => setContextMenu({ x: window.innerWidth, y: 48, task })}
                        onContextMenuTask={handleContextMenu}
                        onSetProjectDirectory={() => setShowDirPanel(true)}
                        onDragOverTask={handleDragOverTask}
                        onDropOnTask={handleDropOnTask}
                        onDragLeaveTask={handleDragLeaveTask}
                        dropIndicator={dropIndicator}
                    />
                ) : activeView === 'timeline' ? (
                    <TimelineView
                        filteredTasks={filteredTasks}
                        onTaskClick={(task, x, y) => setContextMenu({ x, y, task })}
                        icsExportPath={icsExportPath}
                        selectedUserId={filterUser !== 'all' ? filterUser : undefined}
                        onRefreshOutlook={fetchOutlookEvents}
                    />
                ) : activeView === 'terminées' ? (
                    <TermineesView
                        onTaskClick={(task, x, y) => setContextMenu({ x, y, task })}
                    />
                ) : activeView === 'pointage' ? (
                    <TimesheetView />
                ) : (
                    <DashboardView />
                )}
            </ErrorBoundary>

            {/* MODALS & PANELS */}
            <ErrorBoundary name="Modals">
            {contextMenu && (
                <TaskEditPanel
                    task={contextMenu.task}
                    position={contextMenu.x !== null && contextMenu.y !== null ? { x: contextMenu.x, y: contextMenu.y } : { x: 0, y: 0 }}
                    onClose={() => setContextMenu(null)}
                />
            )}
            {centeredTask && createPortal(
                <div
                    className="fixed inset-0 z-[99998] flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
                    onMouseDown={(e) => { if (e.target === e.currentTarget) setCenteredTask(null); }}
                >
                    <div className="w-[min(1200px,90vw)] max-h-[90vh] overflow-y-auto" onMouseDown={e => e.stopPropagation()}>
                        <TaskCard
                            task={centeredTask}
                            onDragStart={() => {}}
                            onClick={() => {}}
                            onContextMenu={(e, task) => {
                                setCenteredTask(null);
                                setContextMenu({ x: e.clientX, y: e.clientY, task });
                            }}
                            onSetProjectDirectory={() => {}}
                        />
                    </div>
                </div>,
                document.body
            )}

            {showWeeklyReportPanel && (
                <WeeklyReportModal
                    onClose={() => setShowWeeklyReportPanel(false)}
                />
            )}

            {showArchivePanel && (
                <ArchivePanel
                    onClose={() => setShowArchivePanel(false)}
                />
            )}

            {showTaskArchivePanel && (
                <TaskArchivePanel
                    onClose={() => setShowTaskArchivePanel(false)}
                />
            )}

            {showDirPanel && (
                <ProjectDirs
                    onClose={() => setShowDirPanel(false)}
                />
            )}

            {showProjectsListPanel && (
                <ProjectsListPanel
                    onClose={() => setShowProjectsListPanel(false)}
                />
            )}

            {showAdminProjectsPanel && (
                <AdminProjectsPanel
                    onClose={() => setShowAdminProjectsPanel(false)}
                />
            )}

            {showUsersPanel && (
                <UsersPanel
                    onClose={() => setShowUsersPanel(false)}
                />
            )}

            {showStoragePanel && (
                <StoragePanel
                    onClose={() => setShowStoragePanel(false)}
                />
            )}

            {showHelpPanel && (
                <ShortcutsHelpPanel
                    onClose={() => setShowHelpPanel(false)}
                    shortcuts={shortcuts}
                />
            )}

            {showNotificationsPanel && (
                <NotificationsPanel
                    onClose={() => setShowNotificationsPanel(false)}
                />
            )}

            {showThemesPanel && (
                <ThemePanel
                    onClose={() => setShowThemesPanel(false)}
                />
            )}

            {showTemplatesPanel && (
                <TemplatesPanel
                    onClose={() => setShowTemplatesPanel(false)}
                />
            )}

            {showOutlookPanel && (
                <OutlookPanel
                    onClose={() => setShowOutlookPanel(false)}
                    onSyncNow={fetchOutlookEvents}
                    icsExportPath={icsExportPath}
                    icsServerUrl={icsServerUrl}
                />
            )}

            {/* Sélecteur de réviseurs — s'ouvre quand une tâche passe en révision sans réviseur (action locale uniquement) */}
            {pendingReviewDialogTaskId && (
                <ReviewerPickerDialog
                    taskId={pendingReviewDialogTaskId}
                    onConfirm={(reviewerIds) => {
                        setReviewers(pendingReviewDialogTaskId, reviewerIds);
                        setPendingReviewDialogTaskId(null);
                    }}
                    onDismiss={() => setPendingReviewDialogTaskId(null)}
                />
            )}
            </ErrorBoundary>

            {/* Hidden File Input for Import */}
            <input
                type="file"
                ref={importFileRef}
                className="hidden"
                accept=".json"
                onChange={handleFileChange}
            />
            <ConfirmModalHost />
        </div>
        </ShortcutsProvider>
    );
}
