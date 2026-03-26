import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { TaskCard, getCardMode, type CardMode } from "./TaskCard";
import { getProjectColor } from "../utils";
import useStore from "../store/useStore";
import type { Task } from "../types";
import type { DropIndicator } from "../hooks/useDragAndDrop";

interface ProjectCardProps {
    project: string;
    status: string;
    tasks: Task[];
    isCollapsed: boolean;
    onToggleCollapse: (project: string) => void;
    onDragStartProject: (e: React.DragEvent, project: string) => void;
    onDragStartTask: (e: React.DragEvent, taskId: string) => void;
    onClickTask: (task: Task, x: number, y: number) => void;
    onContextMenuTask: (e: React.MouseEvent, task: Task) => void;
    onContextMenuProject?: (project: string) => void;
    onSetProjectDirectory: (project: string) => void;
    onDragOverTask?: (e: React.DragEvent, taskId: string, el: HTMLElement) => void;
    onDropOnTask?: (e: React.DragEvent, taskId: string) => void;
    onDragLeaveTask?: () => void;
    dropIndicator?: DropIndicator | null;
    nestTarget?: string | null;
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
    onContextMenuProject,
    onSetProjectDirectory,
    onDragOverTask,
    onDropOnTask,
    onDragLeaveTask,
    dropIndicator,
    nestTarget,
}: ProjectCardProps) {
    const { projectColors } = useStore();
    const projectColor = getProjectColor(project, projectColors);

    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

    // Hiérarchie parent-enfant dans ce groupe
    const taskIds = new Set(tasks.map(t => t.id));
    const childTaskIds = new Set(
        tasks.filter(t => t.parentTaskId && taskIds.has(t.parentTaskId)).map(t => t.id)
    );
    const rootTasks = tasks.filter(t => !childTaskIds.has(t.id));
    const childrenOf = useCallback(
        (parentId: string) => tasks.filter(t => t.parentTaskId === parentId),
        [tasks]
    );

    // Tâches parentes pliées (leurs enfants sont cachés) — initialisé depuis localStorage
    const [foldedParents, setFoldedParents] = useState<Set<string>>(() => {
        const folded = new Set<string>();
        tasks.forEach(t => {
            if (childrenOf(t.id).length > 0 && getCardMode(t.id) === 'compact') {
                folded.add(t.id);
            }
        });
        return folded;
    });

    const handleCardModeChange = useCallback((taskId: string, mode: CardMode) => {
        setFoldedParents(prev => {
            const next = new Set(prev);
            if (mode === 'compact') next.add(taskId);
            else next.delete(taskId);
            return next;
        });
    }, []);

    // Fermer le menu au clic ailleurs
    useEffect(() => {
        if (!ctxMenu) return;
        const close = () => setCtxMenu(null);
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [ctxMenu]);

    // Rendu récursif d'une tâche + ses enfants (max 2 niveaux : depth 0, 1)
    const renderTaskNode = (task: Task, depth: number, forcedMode?: CardMode): React.ReactNode => {
        const children = childrenOf(task.id);
        const isFolded = foldedParents.has(task.id);
        const card = (
            <TaskCard
                task={task}
                onDragStart={onDragStartTask}
                onClick={onClickTask}
                onContextMenu={onContextMenuTask}
                onSetProjectDirectory={() => onSetProjectDirectory(project)}
                onCardModeChange={handleCardModeChange}
                onDragOverTask={onDragOverTask}
                onDropOnTask={onDropOnTask}
                onDragLeaveTask={onDragLeaveTask}
                dropIndicator={dropIndicator}
                nestTarget={nestTarget}
                forcedMode={forcedMode}
            />
        );
        if (children.length === 0 || depth >= 2) {
            return <React.Fragment key={task.id}>{card}</React.Fragment>;
        }
        return (
            <React.Fragment key={task.id}>
                {card}
                <div className="ml-4 border-l-2 border-white/10 pl-3">
                    {children.map(child => renderTaskNode(child, depth + 1, isFolded ? 'compact' : undefined))}
                </div>
            </React.Fragment>
        );
    };

    return (
        <div
            className={`mb-4 overflow-hidden rounded-2xl bg-[#0b1124]/80 shadow-sm ring-1 ring-white/5 transition-all ${isCollapsed ? "opacity-75 hover:opacity-100" : ""
                }`}
        >
            <div
                className={`flex cursor-pointer items-center justify-between px-3 py-2 transition hover:brightness-110 ${projectColor.bg}`}
                onClick={() => onToggleCollapse(project)}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCtxMenu({ x: e.clientX, y: e.clientY });
                }}
            >
                <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight className={`h-4 w-4 ${projectColor.text}`} /> : <ChevronDown className={`h-4 w-4 ${projectColor.text}`} />}
                    <span className={`font-semibold truncate max-w-[120px] sm:max-w-xs ${projectColor.text}`}>{project}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${projectColor.bg} ${projectColor.border} ${projectColor.text}`}>
                        {tasks.length}
                    </span>
                </div>
            </div>

            {/* Mini menu contextuel */}
            {ctxMenu && createPortal(
                <div
                    style={{
                        top: Math.min(ctxMenu.y, window.innerHeight - 60),
                        left: Math.min(ctxMenu.x, window.innerWidth - 220),
                    }}
                    className="fixed z-[99999] min-w-[210px] rounded-lg border border-white/10 bg-slate-800 py-1 shadow-xl"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setCtxMenu(null);
                            onContextMenuProject?.(project);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                    >
                        <Plus className="h-4 w-4 text-slate-400" />
                        Nouvelle tâche dans ce projet
                    </button>
                </div>,
                document.body
            )}

            <AnimatePresence initial={false}>
                {!isCollapsed && (
                    <motion.div
                        className={`p-2 ${projectColor.bg}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                            duration: 0.3,
                            ease: "easeInOut"
                        }}
                    >
                        {rootTasks.map(task => renderTaskNode(task, 0))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
