import { useRef, useState } from 'react';
import useStore from '../store/useStore';
import type { Task } from '../types';

interface DragData {
    type: 'task' | 'project';
    taskId?: string;
    project?: string;
    currentStatus?: string;
}

export interface DropIndicator {
    taskId: string;
    position: 'before' | 'after';
}

/**
 * Hook pour gérer le drag & drop des tâches et projets
 * - Drag entre colonnes : change le statut
 * - Drag sur une autre tâche du même groupe : réordonne
 * - Hover bas-droite > 1s : imbrique comme sous-tâche enfant
 */
export function useDragAndDrop() {
    const { moveTask, moveProject, reorderTask, setTaskParent } = useStore();
    const dragDataRef = useRef<DragData | null>(null);
    const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
    // Indicateur d'imbrication : taskId cible + progression (0→1 sur 1s)
    const [nestTarget, setNestTarget] = useState<string | null>(null);
    const nestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const nestTargetRef = useRef<string | null>(null);

    const clearNest = () => {
        if (nestTimerRef.current) { clearTimeout(nestTimerRef.current); nestTimerRef.current = null; }
        nestTargetRef.current = null;
        setNestTarget(null);
    };

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        if (!taskId) return;
        dragDataRef.current = { type: 'task', taskId };
        e.dataTransfer.effectAllowed = "move";
        clearNest();
    };

    const handleDragStartProject = (e: React.DragEvent, project: string, currentStatus: string) => {
        dragDataRef.current = { type: 'project', project, currentStatus };
        e.dataTransfer.effectAllowed = "move";
        clearNest();
    };

    // Drop sur une colonne (change le statut)
    const handleDrop = (e: React.DragEvent, status: string) => {
        e.preventDefault();
        const d = dragDataRef.current;
        clearNest();

        if (d?.type === 'task' && d.taskId) {
            moveTask(d.taskId, status);
        } else if (d?.type === 'project' && d.project && d.currentStatus) {
            moveProject(d.project, d.currentStatus as Task['status'], status as Task['status']);
        }

        dragDataRef.current = null;
        setDropIndicator(null);
    };

    // Drag over une TaskCard : calcule la position (avant/après) + détecte zone bas-droite pour nesting
    const handleDragOverTask = (e: React.DragEvent, taskId: string, element: HTMLElement) => {
        e.preventDefault();
        e.stopPropagation();
        const d = dragDataRef.current;
        if (d?.type !== 'task' || d.taskId === taskId) {
            setDropIndicator(null);
            clearNest();
            return;
        }

        const rect = element.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const relY = e.clientY - rect.top;
        const inNestZone = relX > rect.width * 0.55 && relY > rect.height * 0.55;

        if (inNestZone) {
            // Zone bas-droite : démarrer/maintenir le timer d'imbrication
            setDropIndicator(null);
            if (nestTargetRef.current !== taskId) {
                clearNest();
                nestTargetRef.current = taskId;
                setNestTarget(taskId);
                nestTimerRef.current = setTimeout(() => {
                    const draggedId = dragDataRef.current?.taskId;
                    if (draggedId && nestTargetRef.current === taskId) {
                        setTaskParent(draggedId, taskId);
                        dragDataRef.current = null;
                    }
                    clearNest();
                    setDropIndicator(null);
                }, 1000);
            }
        } else {
            // Hors zone bas-droite : réordonnement normal
            if (nestTargetRef.current) clearNest();
            const midY = rect.top + rect.height / 2;
            const position: 'before' | 'after' = e.clientY < midY ? 'before' : 'after';
            setDropIndicator({ taskId, position });
        }
    };

    // Drop sur une TaskCard
    const handleDropOnTask = (e: React.DragEvent, targetTaskId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const d = dragDataRef.current;
        clearNest();
        if (d?.type !== 'task' || !d.taskId) return;

        const { tasks } = useStore.getState();
        const draggedTask = tasks.find(t => t.id === d.taskId);
        const targetTask = tasks.find(t => t.id === targetTaskId);

        if (draggedTask && targetTask) {
            if (draggedTask.project === targetTask.project && draggedTask.status === targetTask.status) {
                const position = dropIndicator?.position ?? 'before';
                reorderTask(d.taskId, targetTaskId, position);
            } else {
                moveTask(d.taskId, targetTask.status);
            }
        }

        dragDataRef.current = null;
        setDropIndicator(null);
    };

    const handleDragLeaveTask = () => {
        setDropIndicator(null);
        clearNest();
    };

    return {
        handleDragStart,
        handleDragStartProject,
        handleDrop,
        handleDragOverTask,
        handleDropOnTask,
        handleDragLeaveTask,
        dropIndicator,
        nestTarget,
    };
}
