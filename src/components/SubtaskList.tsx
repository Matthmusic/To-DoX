import React, { useState, useEffect, useRef } from "react";
import { GripVertical, Trash2, CheckSquare, Plus } from "lucide-react";
import useStore from "../store/useStore";
import type { Task, Subtask } from "../types";

interface SubtaskItemProps {
    subtask: Subtask;
    taskId: string;
    isDragging: boolean;
}

/**
 * Item individuel d'une sous-tâche
 */
export function SubtaskItem({ subtask, taskId, isDragging }: SubtaskItemProps) {
    const { toggleSubtask, deleteSubtask, updateSubtaskTitle } = useStore();
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(subtask.title);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (editTitle.trim() && editTitle !== subtask.title) {
            updateSubtaskTitle(taskId, subtask.id, editTitle);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSave();
        } else if (e.key === "Escape") {
            setEditTitle(subtask.title);
            setIsEditing(false);
        }
    };

    return (
        <div
            className={`flex items-center gap-2 rounded-lg bg-white/5 p-2 transition ${isDragging ? "opacity-50" : ""
                }`}
        >
            <GripVertical className="h-4 w-4 cursor-grab text-slate-400" />
            <input
                type="checkbox"
                checked={subtask.completed}
                onChange={() => toggleSubtask(taskId, subtask.id)}
                className="h-4 w-4 rounded accent-emerald-400"
            />
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className="flex-1 rounded bg-white/10 px-2 py-1 text-sm text-slate-100 outline-none focus:bg-white/20"
                />
            ) : (
                <span
                    onDoubleClick={() => setIsEditing(true)}
                    className={`flex-1 text-sm ${subtask.completed ? "text-slate-400 line-through" : "text-slate-200"
                        } cursor-text`}
                    title="Double-cliquer pour éditer"
                >
                    {subtask.title}
                </span>
            )}
            <button
                onClick={() => deleteSubtask(taskId, subtask.id)}
                className="rounded p-1 text-slate-400 transition hover:bg-red-500/20 hover:text-red-400"
                title="Supprimer"
            >
                <Trash2 className="h-3 w-3" />
            </button>
        </div>
    );
}

interface SubtaskListProps {
    task: Task;
}

/**
 * Liste de sous-tâches avec drag & drop
 */
export function SubtaskList({ task }: SubtaskListProps) {
    const { addSubtask, reorderSubtasks } = useStore();
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleAdd = () => {
        if (newSubtaskTitle.trim()) {
            addSubtask(task.id, newSubtaskTitle);
            setNewSubtaskTitle("");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleAdd();
        }
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        reorderSubtasks(task.id, draggedIndex, index);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    return (
        <div className="relative z-20 mt-3 space-y-2 border-t border-white/10 pt-3">
            <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-semibold text-slate-300">Sous-tâches</span>
            </div>

            {/* Liste des sous-tâches */}
            <div className="space-y-1">
                {(task.subtasks || []).map((subtask, index) => (
                    <div
                        key={subtask.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                    >
                        <SubtaskItem
                            subtask={subtask}
                            taskId={task.id}
                            isDragging={draggedIndex === index}
                        />
                    </div>
                ))}
            </div>

            {/* Input pour ajouter une nouvelle sous-tâche */}
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ajouter une sous-tâche..."
                    className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus:bg-white/20"
                />
                <button
                    onClick={handleAdd}
                    disabled={!newSubtaskTitle.trim()}
                    className="rounded-lg bg-blue-500 p-2 text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Ajouter"
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
