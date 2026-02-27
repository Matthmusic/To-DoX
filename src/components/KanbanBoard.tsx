import React, { useState } from 'react';
import { STATUSES } from '../constants';
import type { Task } from '../types';
import { ProjectCard } from './ProjectCard';
import useStore from '../store/useStore';
import type { DropIndicator } from '../hooks/useDragAndDrop';

interface KanbanBoardProps {
    grouped: Record<string, Record<string, Task[]>>;
    collapsedProjects: Record<string, boolean>;
    onDragStartProject: (e: React.DragEvent, project: string, currentStatus: string) => void;
    onDragStartTask: (e: React.DragEvent, taskId: string) => void;
    onDrop: (e: React.DragEvent, status: string) => void;
    onClickTask: (task: Task, x: number, y: number) => void;
    onContextMenuTask: (e: React.MouseEvent, task: Task) => void;
    onSetProjectDirectory: () => void;
    onDragOverTask?: (e: React.DragEvent, taskId: string, el: HTMLElement) => void;
    onDropOnTask?: (e: React.DragEvent, taskId: string) => void;
    onDragLeaveTask?: () => void;
    dropIndicator?: DropIndicator | null;
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
    onSetProjectDirectory,
    onDragOverTask,
    onDropOnTask,
    onDragLeaveTask,
    dropIndicator,
}: KanbanBoardProps) {
    const { toggleProjectCollapse } = useStore();
    const [activeMobileTab, setActiveMobileTab] = useState(0);

    const renderColumnContent = (statusId: string) => (
        Object.keys(grouped[statusId] || {}).map((projectName) => {
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
                    onSetProjectDirectory={onSetProjectDirectory}
                    onDragOverTask={onDragOverTask}
                    onDropOnTask={onDropOnTask}
                    onDragLeaveTask={onDragLeaveTask}
                    dropIndicator={dropIndicator}
                />
            );
        })
    );

    return (
        <main className="flex-1 overflow-hidden flex flex-col md:block bg-transparent">

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
                                    <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-px text-[9px] leading-none">
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Contenu colonne active — on rend uniquement la colonne sélectionnée */}
                <div
                    className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop(e, kanbanStatuses[activeMobileTab].id)}
                >
                    {renderColumnContent(kanbanStatuses[activeMobileTab].id)}
                </div>
            </div>

            {/* ── DESKTOP : colonnes côte à côte ── */}
            <div className="hidden md:flex h-full p-4 lg:p-6 gap-4 lg:gap-6 overflow-x-auto">
                <div className="kanban-row flex h-full gap-4 lg:gap-6 justify-center w-full">
                    {kanbanStatuses.map((status) => (
                        <div
                            key={status.id}
                            className="flex h-full flex-1 basis-0 min-w-[260px] lg:min-w-[280px] flex-col rounded-3xl bg-theme-secondary border border-theme-primary shadow-[0_16px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => onDrop(e, status.id)}
                        >
                            {/* Column Header */}
                            <div className="flex items-center justify-between border-b border-theme-primary px-3 py-2 bg-white/[0.02]">
                                <div className="flex items-center gap-2">
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${status.color} shadow-lg`}>
                                        <status.Icon className="h-4 w-4 text-white" />
                                    </div>
                                    <h2 className="text-sm font-bold text-theme-primary">{status.label}</h2>
                                </div>
                                <span className="rounded-full border border-theme-primary bg-white/5 px-2 py-0.5 text-xs font-semibold text-theme-secondary">
                                    {grouped[status.id] ? Object.values(grouped[status.id]).reduce((acc, tasks) => acc + tasks.length, 0) : 0}
                                </span>
                            </div>

                            {/* Column Content */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                                {renderColumnContent(status.id)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
