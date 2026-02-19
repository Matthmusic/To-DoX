import React, { useEffect, useRef, useState } from "react";
import { todayISO } from "./utils";
import { migrateTask } from "./utils/taskMigration";

// Store and Types
import useStore from "./store/useStore";
import type { StoredData, Task } from "./types";

type StoredDataRaw = Omit<StoredData, 'tasks'> & { tasks?: unknown[] };

// Composants extraits
import {
    TaskEditPanel,
    ArchivePanel,
    TaskArchivePanel,
    ProjectDirs,
    ProjectsListPanel,
    UsersPanel,
    StoragePanel,
    WeeklyReportModal,
    ConfirmModalHost,
    KanbanHeaderPremium,
    KanbanBoard,
    TimelineView,
} from "./components";
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

// Error Boundary
import { ErrorBoundary } from "./components/ErrorBoundary";

interface ContextMenuData {
    x: number | null;
    y: number | null;
    task: Task;
}

/**
 * To Do X — Application Kanban minimaliste et intelligente
 * Composant principal orchestrant l'interface et la logique métier
 */
export default function ToDoX() {
    // Note: useDataPersistence est maintenant appelé dans App.tsx pour éviter le problème de chicken-and-egg

    const { tasks, directories, projectHistory, users, collapsedProjects, archiveProject, currentUser } = useStore();

    const {
        filterProject,
        setFilterProject,
        filterSearch,
        setFilterSearch,
        grouped,
        filteredTasks,
    } = useFilters(tasks, currentUser);

    const {
        handleDragStart,
        handleDragStartProject,
        handleDrop
    } = useDragAndDrop();

    // UI State Management
    const [showDirPanel, setShowDirPanel] = useState(false);
    const [showArchivePanel, setShowArchivePanel] = useState(false);
    const [showTaskArchivePanel, setShowTaskArchivePanel] = useState(false);
    const [showUsersPanel, setShowUsersPanel] = useState(false);
    const [showStoragePanel, setShowStoragePanel] = useState(false);
    const [showWeeklyReportPanel, setShowWeeklyReportPanel] = useState(false);
    const [showProjectsListPanel, setShowProjectsListPanel] = useState(false);
    const [showHelpPanel, setShowHelpPanel] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
    const [showThemesPanel, setShowThemesPanel] = useState(false);
    const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
    const [activeView, setActiveView] = useState<'kanban' | 'timeline'>('kanban');

    const importFileRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<{ focus: () => void }>(null);
    const quickAddRef = useRef<{ focus: () => void }>(null);

    // Persist collapsed state
    useEffect(() => {
        localStorage.setItem('todox_collapsed_projects', JSON.stringify(collapsedProjects));
    }, [collapsedProjects]);

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
        showHelpPanel ||
        showNotificationsPanel ||
        showThemesPanel ||
        contextMenu !== null;

    // Callbacks pour les raccourcis clavier
    const shortcutsCallbacks: ShortcutsContextValue = {
        focusQuickAdd: () => {
            quickAddRef.current?.focus();
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
                onOpenWeeklyReport={() => setShowWeeklyReportPanel(true)}
                onOpenStorage={() => setShowStoragePanel(true)}
                onOpenUsers={() => setShowUsersPanel(true)}
                onOpenNotifications={() => setShowNotificationsPanel(true)}
                onOpenThemes={() => setShowThemesPanel(true)}
                onOpenArchive={() => setShowArchivePanel(true)}
                onOpenDirPanel={() => setShowDirPanel(true)}
                onOpenProjectsList={() => setShowProjectsListPanel(true)}
                onOpenTaskArchive={() => setShowTaskArchivePanel(true)}
                onExport={handleExport}
                onImport={handleImportClick}
                onOpenHelp={() => setShowHelpPanel(true)}
                activeView={activeView}
                onViewChange={setActiveView}
                filterSearch={filterSearch}
                onSearchChange={setFilterSearch}
                searchInputRef={searchInputRef}
                quickAddRef={quickAddRef}
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
                        onContextMenuTask={handleContextMenu}
                        onSetProjectDirectory={() => setShowDirPanel(true)}
                    />
                ) : (
                    <TimelineView
                        filteredTasks={filteredTasks}
                        onTaskClick={(task, x, y) => setContextMenu({ x, y, task })}
                    />
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
