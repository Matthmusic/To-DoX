import { useRef } from 'react';
import useStore from '../store/useStore';
import type { Task } from '../types';

interface DragData {
    type: 'task' | 'project';
    taskId?: string;
    project?: string;
    currentStatus?: string;
}

/**
 * Hook pour gérer le drag & drop des tâches et projets
 */
export function useDragAndDrop() {
    const { moveTask, moveProject } = useStore();
    const dragDataRef = useRef<DragData | null>(null);

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        if (!taskId) return;
        dragDataRef.current = { type: 'task', taskId };
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragStartProject = (e: React.DragEvent, project: string, currentStatus: string) => {
        dragDataRef.current = { type: 'project', project, currentStatus };
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDrop = (e: React.DragEvent, status: string) => {
        e.preventDefault();
        const d = dragDataRef.current;

        if (d?.type === 'task' && d.taskId) {
            // Déplacer une seule tâche
            moveTask(d.taskId, status);
        } else if (d?.type === 'project' && d.project && d.currentStatus) {
            // Déplacer toutes les tâches du projet
            moveProject(d.project, d.currentStatus as Task['status'], status as Task['status']);
        }

        dragDataRef.current = null;
    };

    return {
        handleDragStart,
        handleDragStartProject,
        handleDrop,
    };
}
