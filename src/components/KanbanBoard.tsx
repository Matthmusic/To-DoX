import React from 'react';
import { STATUSES } from '../constants';
import type { Task } from '../types';
import { ProjectCard } from './ProjectCard';
import useStore from '../store/useStore';

interface KanbanBoardProps {
    grouped: Record<string, Record<string, Task[]>>;
    collapsedProjects: Record<string, boolean>;
    onDragStartProject: (e: React.DragEvent, project: string, currentStatus: string) => void;
    onDragStartTask: (e: React.DragEvent, taskId: string) => void;
    onDrop: (e: React.DragEvent, status: string) => void;
    onContextMenuTask: (e: React.MouseEvent, task: Task) => void;
    onSetProjectDirectory: () => void;
}

/**
 * Tableau Kanban avec les 4 colonnes de statut
 */
export function KanbanBoard({
    grouped,
    collapsedProjects,
    onDragStartProject,
    onDragStartTask,
    onDrop,
    onContextMenuTask,
    onSetProjectDirectory,
}: KanbanBoardProps) {
    const { toggleProjectCollapse } = useStore();

    return (
        <main className="flex-1 overflow-x-auto overflow-y-hidden p-6">
            <div className="kanban-row flex h-full gap-6 justify-center">
                {STATUSES.map((status) => (
                    <div
                        key={status.id}
                        className="flex h-full flex-1 basis-0 min-w-[280px] flex-col rounded-3xl bg-white/5 border border-white/10 shadow-[0_16px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => onDrop(e, status.id)}
                    >
                        {/* Column Header */}
                        <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 bg-white/[0.02]">
                            <div className="flex items-center gap-2">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${status.color} shadow-lg`}>
                                    <status.Icon className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-slate-100">{status.label}</h2>
                                </div>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-semibold text-slate-200">
                                {grouped[status.id] ? Object.values(grouped[status.id]).reduce((acc, tasks) => acc + tasks.length, 0) : 0}
                            </span>
                        </div>

                        {/* Column Content - Projects grouped */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                            {Object.keys(grouped[status.id] || {}).map((projectName) => {
                                const projectTasks = grouped[status.id][projectName] || [];
                                const collapseKey = `${status.id}_${projectName}`;
                                const isCollapsed = collapsedProjects[collapseKey] || false;

                                return (
                                    <ProjectCard
                                        key={collapseKey}
                                        project={projectName}
                                        status={status.id}
                                        tasks={projectTasks}
                                        isCollapsed={isCollapsed}
                                        onToggleCollapse={() => toggleProjectCollapse(status.id, projectName)}
                                        onDragStartProject={(e: React.DragEvent, proj: string) => onDragStartProject(e, proj, status.id)}
                                        onDragStartTask={onDragStartTask}
                                        onClickTask={() => {}}
                                        onContextMenuTask={onContextMenuTask}
                                        onSetProjectDirectory={onSetProjectDirectory}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}
