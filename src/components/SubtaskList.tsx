import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { GripVertical, Trash2, CheckSquare, Plus, ExternalLink, ArrowUpFromLine, LayoutTemplate } from "lucide-react";
import useStore from "../store/useStore";
import type { Task, Subtask } from "../types";

/**
 * Récupère le chemin natif d'un File droppé (fichier ou dossier).
 * Utilise webUtils.getPathForFile via l'API Electron si disponible,
 * sinon fallback sur la propriété .path (ancienne API).
 */
export function getDroppedFilePath(file: File): string {
    if (window.electronAPI?.getPathForFile) {
        return window.electronAPI.getPathForFile(file);
    }
    return (file as File & { path?: string }).path ?? '';
}

/**
 * Formate un chemin pour insertion : ajoute des guillemets si le chemin contient des espaces.
 */
export function formatPathForInsertion(path: string): string {
    return path.includes(' ') ? `"${path}"` : path;
}

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

/**
 * Retourne uniquement le nom de fichier ou dossier (dernier segment du chemin)
 */
export function getPathDisplayName(path: string): string {
    const normalized = path.replace(/[/\\]+$/, '');
    const parts = normalized.split(/[/\\]/);
    return parts[parts.length - 1] || path;
}

interface ContextMenuProps {
    x: number;
    y: number;
    onConvert: () => void;
    onClose: () => void;
}

function SubtaskContextMenu({ x, y, onConvert, onClose }: ContextMenuProps) {
    useEffect(() => {
        const handleClick = () => onClose();
        window.addEventListener('mousedown', handleClick);
        return () => window.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    // Ajuster pour ne pas sortir de l'écran
    const adjustedX = Math.min(x, window.innerWidth - 180);
    const adjustedY = Math.min(y, window.innerHeight - 60);

    return createPortal(
        <div
            style={{ top: adjustedY, left: adjustedX }}
            className="fixed z-[99999] min-w-[160px] rounded-lg border border-white/10 bg-slate-800 py-1 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
        >
            <button
                onClick={() => { onConvert(); onClose(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
                <ArrowUpFromLine className="h-4 w-4 text-blue-400" />
                Convertir en tâche
            </button>
        </div>,
        document.body
    );
}

interface SubtaskItemProps {
    subtask: Subtask;
    task: Task;
    isDragging: boolean;
    onGripMouseDown: () => void;
}

/**
 * Item individuel d'une sous-tâche
 */
export function SubtaskItem({ subtask, task, isDragging, onGripMouseDown }: SubtaskItemProps) {
    const { toggleSubtask, deleteSubtask, updateSubtaskTitle, addTask, users } = useStore();
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(subtask.title);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [isFileDropTarget, setIsFileDropTarget] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileDragOver = (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        setIsFileDropTarget(true);
    };

    const handleFileDrop = (e: React.DragEvent) => {
        if (e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        setIsFileDropTarget(false);
        const file = e.dataTransfer.files[0];
        const path = getDroppedFilePath(file);
        if (!path) return;
        const formattedPath = formatPathForInsertion(path);
        const newTitle = subtask.title ? `${subtask.title} ${formattedPath}` : formattedPath;
        updateSubtaskTitle(task.id, subtask.id, newTitle);
    };

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (editTitle.trim() && editTitle !== subtask.title) {
            updateSubtaskTitle(task.id, subtask.id, editTitle);
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

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleConvertToTask = () => {
        addTask({
            title: subtask.title,
            project: task.project,
            priority: task.priority,
            assignedTo: task.assignedTo,
            status: 'todo',
            convertedFromSubtask: { parentTaskId: task.id, parentTaskTitle: task.title },
        });
        deleteSubtask(task.id, subtask.id);
    };

    return (
        <>
            <div
                onContextMenu={handleContextMenu}
                onDragOver={handleFileDragOver}
                onDragLeave={() => setIsFileDropTarget(false)}
                onDrop={handleFileDrop}
                className={`flex items-center gap-2 rounded-lg p-2 transition select-none ${isDragging ? "opacity-50" : ""} ${isFileDropTarget ? "border border-blue-400/60 bg-blue-400/10" : "bg-white/5"}`}
                title="Déposer un fichier pour l'attacher"
            >
                <GripVertical
                    className="h-4 w-4 cursor-grab text-slate-400 shrink-0"
                    onMouseDown={onGripMouseDown}
                />
                <input
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={() => toggleSubtask(task.id, subtask.id)}
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
                        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); } }}
                        onDrop={(e) => {
                            if (e.dataTransfer.files.length === 0) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const file = e.dataTransfer.files[0];
                            const path = getDroppedFilePath(file);
                            if (!path) return;
                            const formattedPath = formatPathForInsertion(path);
                            const input = e.currentTarget;
                            const start = input.selectionStart ?? editTitle.length;
                            const end = input.selectionEnd ?? editTitle.length;
                            const newTitle = editTitle.slice(0, start) + (start > 0 ? ' ' : '') + formattedPath + editTitle.slice(end);
                            setEditTitle(newTitle);
                        }}
                        className="flex-1 rounded bg-white/10 px-2 py-1 text-sm text-slate-100 outline-none focus:bg-white/20"
                    />
                ) : (
                    <span
                        onDoubleClick={() => setIsEditing(true)}
                        className={`flex-1 text-sm ${subtask.completed ? "text-slate-400 line-through" : "text-slate-200"} cursor-default select-none`}
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
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(part.content);
                                    }}
                                    className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 hover:text-blue-200 transition border border-blue-500/30 font-mono text-xs"
                                    title={part.content}
                                >
                                    <ExternalLink className="h-3 w-3" />
                                    {getPathDisplayName(part.content)}
                                </button>
                            ) : (
                                <span key={idx}>{part.content}</span>
                            )
                        )}
                    </span>
                )}
                {subtask.completed && subtask.completedBy && (() => {
                    const completer = users.find(u => u.id === subtask.completedBy);
                    if (!completer) return null;
                    const initials = completer.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                    const dateStr = subtask.completedAt
                        ? new Date(subtask.completedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '';
                    return (
                        <span
                            className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400"
                            title={`Validé par ${completer.name}${dateStr ? ` — ${dateStr}` : ''}`}
                        >
                            {initials}
                        </span>
                    );
                })()}
                <button
                    onClick={() => deleteSubtask(task.id, subtask.id)}
                    className="rounded p-1 text-slate-400 transition hover:bg-red-500/20 hover:text-red-400"
                    title="Supprimer"
                >
                    <Trash2 className="h-3 w-3" />
                </button>
            </div>
            {contextMenu && (
                <SubtaskContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onConvert={handleConvertToTask}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </>
    );
}

interface SubtaskListProps {
    task: Task;
}

/**
 * Liste de sous-tâches avec drag & drop
 */
export function SubtaskList({ task }: SubtaskListProps) {
    const { addSubtask, reorderSubtasks, templates, applyTemplateToTask } = useStore();
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const dragFromGrip = useRef(false);
    const [isNewDropTarget, setIsNewDropTarget] = useState(false);
    const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
    const templateDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showTemplateDropdown) return;
        function handleClickOutside(e: MouseEvent) {
            if (templateDropdownRef.current?.contains(e.target as Node)) return;
            setShowTemplateDropdown(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showTemplateDropdown]);

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
        if (!dragFromGrip.current) { e.preventDefault(); return; }
        dragFromGrip.current = false;
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        e.stopPropagation(); // empêche TaskCard d'annuler ce drag via son handler data-nodrag
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation(); // empêche TaskCard de traiter ce dragover comme un drop de tâche
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
                {templates.length > 0 && (
                    <div ref={templateDropdownRef} className="relative ml-auto">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowTemplateDropdown(v => !v); }}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-400 transition"
                            title="Appliquer un template"
                        >
                            <LayoutTemplate className="h-3.5 w-3.5" />
                            Template
                        </button>
                        {showTemplateDropdown && (
                            <div className="absolute top-full mt-1 right-0 w-52 rounded-xl border border-white/10 bg-[#161b2e] shadow-2xl p-1.5 z-[99999]">
                                <p className="text-[10px] text-slate-500 px-2 pb-1 font-semibold uppercase">Templates</p>
                                {templates.map(tpl => (
                                    <button
                                        key={tpl.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            applyTemplateToTask(task.id, tpl.id);
                                            setShowTemplateDropdown(false);
                                        }}
                                        className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-slate-200 hover:bg-white/5 transition"
                                    >
                                        <span className="font-medium block truncate">{tpl.name}</span>
                                        <span className="text-[10px] text-slate-500">{tpl.subtaskTitles.length} sous-tâche{tpl.subtaskTitles.length > 1 ? 's' : ''}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
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
                            task={task}
                            isDragging={draggedIndex === index}
                            onGripMouseDown={() => { dragFromGrip.current = true; }}
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
                    onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); setIsNewDropTarget(true); } }}
                    onDragLeave={() => setIsNewDropTarget(false)}
                    onDrop={(e) => {
                        if (e.dataTransfer.files.length === 0) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setIsNewDropTarget(false);
                        const file = e.dataTransfer.files[0];
                        const path = getDroppedFilePath(file);
                        if (!path) return;
                        const formattedPath = formatPathForInsertion(path);
                        setNewSubtaskTitle(prev => prev ? `${prev} ${formattedPath}` : formattedPath);
                    }}
                    placeholder="Ajouter une sous-tâche... (ou déposer un fichier)"
                    className={`flex-1 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none transition ${isNewDropTarget ? 'bg-blue-500/15 border border-blue-400/50' : 'bg-white/10 focus:bg-white/20'}`}
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
