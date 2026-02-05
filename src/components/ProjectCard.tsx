import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TaskCard } from "./TaskCard";
import { getProjectColor } from "../utils";
import useStore from "../store/useStore";
import type { Task } from "../types";

interface ProjectCardProps {
    project: string;
    status: string;
    tasks: Task[];
    isCollapsed: boolean;
    onToggleCollapse: (project: string) => void;
    onDragStartProject: (e: React.DragEvent, project: string) => void;
    onDragStartTask: (e: React.DragEvent, taskId: string) => void;
    onClickTask: (task: Task) => void;
    onContextMenuTask: (e: React.MouseEvent, task: Task) => void;
    onSetProjectDirectory: (project: string) => void;
}

export function ProjectCard({
    project,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    status: _status,
    tasks,
    isCollapsed,
    onToggleCollapse,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onDragStartProject: _onDragStartProject,
    onDragStartTask,
    onClickTask,
    onContextMenuTask,
    onSetProjectDirectory
}: ProjectCardProps) {
    // Note: onSetProjectDirectory is still passed down because it triggers a modal in ToDoX.jsx

    const { projectColors } = useStore();
    const projectColor = getProjectColor(project, projectColors);

    return (
        <div
            className={`mb-4 overflow-hidden rounded-2xl bg-[#0b1124]/80 shadow-sm ring-1 ring-white/5 transition-all ${isCollapsed ? "opacity-75 hover:opacity-100" : ""
                }`}
        >
            <div
                className={`flex cursor-pointer items-center justify-between px-3 py-2 transition hover:brightness-110 ${projectColor.bg}`}
                onClick={() => onToggleCollapse(project)}
            >
                <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight className={`h-4 w-4 ${projectColor.text}`} /> : <ChevronDown className={`h-4 w-4 ${projectColor.text}`} />}
                    <span className={`font-semibold ${projectColor.text}`}>{project}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${projectColor.bg} ${projectColor.border} ${projectColor.text}`}>
                        {tasks.length}
                    </span>
                </div>
            </div>

            {!isCollapsed && (
                <div className={`p-2 ${projectColor.bg}`}>
                    {tasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onDragStart={onDragStartTask}
                            onClick={onClickTask}
                            onContextMenu={onContextMenuTask}
                            onSetProjectDirectory={() => onSetProjectDirectory(project)}
                        />
                    ))}
                    {/* Drop zone placeholder logic if needed */}
                </div>
            )}
        </div>
    );
}
