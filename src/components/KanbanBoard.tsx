import React, { useState } from 'react';
import { STATUSES } from '../constants';
import type { Task } from '../types';
import { ProjectCard } from './ProjectCard';
import useStore from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import type { DropIndicator } from '../hooks/useDragAndDrop';

interface KanbanBoardProps {
    grouped: Record<string, Record<string, Task[]>>;
    collapsedProjects: Record<string, boolean>;
    onDragStartProject: (e: React.DragEvent, project: string, currentStatus: string) => void;
    onDragStartTask: (e: React.DragEvent, taskId: string) => void;
    onDrop: (e: React.DragEvent, status: string) => void;
    onClickTask: (task: Task, x: number, y: number) => void;
    onContextMenuTask: (e: React.MouseEvent, task: Task) => void;
    onContextMenuProject?: (project: string) => void;
    onSetProjectDirectory: () => void;
    onDragOverTask?: (e: React.DragEvent, taskId: string, el: HTMLElement) => void;
    onDropOnTask?: (e: React.DragEvent, taskId: string) => void;
    onDragLeaveTask?: () => void;
    dropIndicator?: DropIndicator | null;
    nestTarget?: string | null;
}

const kanbanStatuses = STATUSES.filter(s => s.kanban);

/**
 * Tableau Kanban avec les colonnes de statut
 * - Mobile (< md / 768px) : une colonne à la fois avec tabs de navigation
 * - Desktop (≥ md) : colonnes côte à côte
 */
export function KanbanBoard({
    grouped,
    collapsedProjects,
    onDragStartProject,
    onDragStartTask,
    onDrop,
    onClickTask,
    onContextMenuTask,
    onContextMenuProject,
    onSetProjectDirectory,
    onDragOverTask,
    onDropOnTask,
    onDragLeaveTask,
    dropIndicator,
    nestTarget,
}: KanbanBoardProps) {
    const { toggleProjectCollapse, notificationPanelSide } = useStore(useShallow((s) => ({ toggleProjectCollapse: s.toggleProjectCollapse, notificationPanelSide: s.notificationPanelSide })));
    const [activeMobileTab, setActiveMobileTab] = useState(0);

    const renderColumnContent = (statusId: string) => {
        const projectNames = Object.keys(grouped[statusId] || {});
        if (projectNames.length === 0) {
            return (
                <p className="text-xs text-slate-500 italic text-center py-8 select-none">
                    Aucune tâche
                </p>
            );
        }
        return projectNames.map((projectName) => {
            const projectTasks = grouped[statusId][projectName] || [];
            const collapseKey = `${statusId}_${projectName}`;
            const isCollapsed = collapsedProjects[collapseKey] || false;
            return (
                <ProjectCard
                    key={collapseKey}
                    project={projectName}
                    status={statusId}
                    tasks={projectTasks}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() => toggleProjectCollapse(statusId, projectName)}
                    onDragStartProject={(e: React.DragEvent, proj: string) => onDragStartProject(e, proj, statusId)}
                    onDragStartTask={onDragStartTask}
                    onClickTask={onClickTask}
                    onContextMenuTask={onContextMenuTask}
                    onContextMenuProject={onContextMenuProject}
                    onSetProjectDirectory={onSetProjectDirectory}
                    onDragOverTask={onDragOverTask}
                    onDropOnTask={onDropOnTask}
                    onDragLeaveTask={onDragLeaveTask}
                    dropIndicator={dropIndicator}
                    nestTarget={nestTarget}
                />
            );
        });
    };

    return (
        <main className={`min-h-0 flex-1 overflow-hidden flex flex-col md:block bg-transparent ${notificationPanelSide === 'left' ? 'pl-24' : 'pr-24'}`}>

            {/* ── MOBILE : onglets + vue colonne unique ── */}
            <div className="md:hidden flex flex-col h-full">
                {/* Tab bar */}
                <div className="flex shrink-0 border-b border-theme-primary bg-theme-secondary">
                    {kanbanStatuses.map((status, i) => {
                        const count = grouped[status.id]
                            ? Object.values(grouped[status.id]).reduce((acc, tasks) => acc + tasks.length, 0)
                            : 0;
                        const isActive = activeMobileTab === i;
                        return (
                            <button
                                key={status.id}
                                onClick={() => setActiveMobileTab(i)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2 ${
                                    isActive ? 'border-current' : 'border-transparent text-theme-secondary'
                                }`}
                                style={isActive ? { color: 'var(--color-primary)', borderColor: 'var(--color-primary)' } : {}}
                            >
                                <status.Icon className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{status.label}</span>
                                {count > 0 && (
                                    <span className="shrink-0 rounded-full bg-[rgba(var(--overlay-rgb),0.1)] px-1.5 py-px text-[9px] leading-none">
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Contenu colonne active — on rend uniquement la colonne sélectionnée */}
                <div
                    className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[rgba(var(--overlay-rgb),0.1)]"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop(e, kanbanStatuses[activeMobileTab].id)}
                >
                    {renderColumnContent(kanbanStatuses[activeMobileTab].id)}
                </div>
            </div>

            {/* ── DESKTOP : colonnes côte à côte ── */}
            {/*
             * La marge intérieure est en miroir de notificationPanelSide : le côté qui accole
             * le panneau (via pl-24/pr-24 sur <main> ci-dessus) reste sans marge supplémentaire,
             * l'autre côté garde une petite marge de respiration (4/6). Sans ce miroir, passer
             * en dock gauche cumulait pl-24 (main) + pl-4 (ici) à gauche et laissait 0 à droite :
             * la dernière colonne touchait le bord de l'écran.
             */}
            <div className={`hidden md:flex h-full pb-4 pt-1 lg:pb-6 gap-4 lg:gap-6 overflow-x-auto ${notificationPanelSide === 'left' ? 'pr-4 lg:pr-6' : 'pl-4 lg:pl-6'}`}>
                <div className="kanban-row flex h-full gap-4 lg:gap-6 w-full">
                    {kanbanStatuses.map((status) => (
                        <div
                            key={status.id}
                            // Effet néomorphique : ombre douce légèrement portée vers le bas (voir
                            // --neu-shadow-dark, calculée par thème dans useTheme.ts) + un fin liseré
                            // clair intérieur (--neu-shadow-light) tout autour pour le relief, sans
                            // bordure. Une ombre parfaitement symétrique (0 0 24px, essayée avant)
                            // remontait trop haut et créait une couture visible avec la barre au-dessus
                            // des colonnes -- léger décalage vers le bas + rayon réduit pour rester
                            // contenue sous chaque colonne.
                            className="flex h-full flex-1 basis-0 min-w-[260px] lg:min-w-[280px] flex-col overflow-hidden rounded-3xl bg-theme-secondary shadow-[0_6px_16px_var(--neu-shadow-dark),inset_0_0_0_1px_var(--neu-shadow-light)] backdrop-blur-xl"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => onDrop(e, status.id)}
                        >
                            {/* Column Header */}
                            <div className="flex items-center justify-between border-b border-theme-primary px-3 py-2 bg-[rgba(var(--overlay-rgb),0.02)]">
                                <div className="flex items-center gap-2">
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${status.color} shadow-lg`}>
                                        <status.Icon className="h-4 w-4 text-white" />
                                    </div>
                                    <h2 className="text-sm font-bold text-theme-primary">{status.label}</h2>
                                </div>
                                <span className="rounded-full border border-theme-primary bg-[rgba(var(--overlay-rgb),0.05)] px-2 py-0.5 text-xs font-semibold text-theme-secondary">
                                    {grouped[status.id] ? Object.values(grouped[status.id]).reduce((acc, tasks) => acc + tasks.length, 0) : 0}
                                </span>
                            </div>

                            {/* Column Content */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[rgba(var(--overlay-rgb),0.1)] hover:scrollbar-thumb-[rgba(var(--overlay-rgb),0.2)]">
                                {renderColumnContent(status.id)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
