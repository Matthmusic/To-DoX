import React, { useState, useEffect, useRef } from "react";
import { GripVertical, Trash2, CheckSquare, Plus, ExternalLink } from "lucide-react";
import useStore from "../store/useStore";
import type { Task, Subtask } from "../types";

/**
 * Détecte et parse les chemins de fichiers dans le texte
 * Supporte les chemins avec espaces entre guillemets et les chemins sans espaces
 */
export function parseFilePaths(text: string): Array<{ type: 'text' | 'path', content: string }> {
    const parts: Array<{ type: 'text' | 'path', content: string }> = [];
    let lastIndex = 0;

    // Regex combinée pour détecter:
    // 1. Chemins entre guillemets (avec espaces): "C:\path with spaces\file.txt"
    // 2. Chemins Windows sans espaces: C:\path\file.txt
    // 3. Chemins Unix sans espaces: /path/file.txt ou ./path/file.txt
    // 4. Chemins UNC: \\server\share\file
    const pathRegex = /"([a-zA-Z]:[^"]+|\/[^"]+|\.\.?\/[^"]+|\\\\[^"]+)"|(?:[a-zA-Z]:\\(?:[^\s\\/:*?"<>|]+\\)*[^\s\\/:*?"<>|]+(?:\.[a-zA-Z0-9]+)?)|(?:\/(?:[^\s/]+\/)*[^\s/]+)|(?:\.\.?\/(?:[^\s/]+\/)*[^\s/]+)|(?:\\\\[^\s\\]+\\[^\s\\]+(?:\\[^\s\\]+)*)/g;

    let match;
    while ((match = pathRegex.exec(text)) !== null) {
        // Ajouter le texte avant le chemin
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
        }

        // Extraire le chemin (avec ou sans guillemets)
        const path = match[1] || match[0]; // match[1] = chemin entre guillemets, match[0] = chemin sans guillemets

        // Vérifier que c'est bien un chemin valide (au moins une extension ou un dossier)
        if (path.includes('\\') || path.includes('/') || path.match(/\.[a-zA-Z0-9]{2,4}$/)) {
            parts.push({ type: 'path', content: path });
            lastIndex = match.index + match[0].length;
        } else {
            // Pas un vrai chemin, traiter comme du texte
            parts.push({ type: 'text', content: match[0] });
            lastIndex = match.index + match[0].length;
        }
    }

    // Ajouter le reste du texte
    if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content: text }];
}

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
                    {parseFilePaths(subtask.title).map((part, idx) =>
                        part.type === 'path' ? (
                            <button
                                key={idx}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.electronAPI?.openFolder) {
                                        window.electronAPI.openFolder(part.content);
                                    } else {
                                        alert(`Chemin détecté: ${part.content}\n(Disponible uniquement en mode Electron)`);
                                    }
                                }}
                                className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 hover:text-blue-200 transition border border-blue-500/30 font-mono text-xs"
                                title={`Ouvrir: ${part.content}`}
                            >
                                <ExternalLink className="h-3 w-3" />
                                {part.content}
                            </button>
                        ) : (
                            <span key={idx}>{part.content}</span>
                        )
                    )}
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
