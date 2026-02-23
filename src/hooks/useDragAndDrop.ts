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
 */
export function useDragAndDrop() {
    const { moveTask, moveProject, reorderTask } = useStore();
    const dragDataRef = useRef<DragData | null>(null);
    const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        if (!taskId) return;
        dragDataRef.current = { type: 'task', taskId };
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragStartProject = (e: React.DragEvent, project: string, currentStatus: string) => {
        dragDataRef.current = { type: 'project', project, currentStatus };
        e.dataTransfer.effectAllowed = "move";
    };

    // Drop sur une colonne (change le statut)
    const handleDrop = (e: React.DragEvent, status: string) => {
        e.preventDefault();
        const d = dragDataRef.current;

        if (d?.type === 'task' && d.taskId) {
            moveTask(d.taskId, status);
        } else if (d?.type === 'project' && d.project && d.currentStatus) {
            moveProject(d.project, d.currentStatus as Task['status'], status as Task['status']);
        }

        dragDataRef.current = null;
        setDropIndicator(null);
    };

    // Drag over une TaskCard : calcule la position (avant/après) et met à jour l'indicateur
    const handleDragOverTask = (e: React.DragEvent, taskId: string, element: HTMLElement) => {
        e.preventDefault();
        e.stopPropagation();
        const d = dragDataRef.current;
        if (d?.type !== 'task' || d.taskId === taskId) {
            setDropIndicator(null);
            return;
        }
        const rect = element.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const position: 'before' | 'after' = e.clientY < midY ? 'before' : 'after';
        setDropIndicator({ taskId, position });
    };

    // Drop sur une TaskCard
    const handleDropOnTask = (e: React.DragEvent, targetTaskId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const d = dragDataRef.current;
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
    };

    return {
        handleDragStart,
        handleDragStartProject,
        handleDrop,
        handleDragOverTask,
        handleDropOnTask,
        handleDragLeaveTask,
        dropIndicator,
    };
}
