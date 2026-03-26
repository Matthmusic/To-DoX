import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { GripVertical, Trash2, CheckSquare, Plus, ExternalLink, ArrowUpFromLine, LayoutTemplate, UserPlus, Calendar } from "lucide-react";
import { getInitials } from "../utils";
import useStore from "../store/useStore";
import type { Task, Subtask } from "../types";
import { alertModal } from "../utils/confirm";
import { LinkedTextContent } from "./LinkedTextContent";
import {
    formatPathForInsertion as formatDroppedPathForInsertion,
    getDroppedFilePath as getNativeDroppedFilePath,
    getPathDisplayName as getParsedPathDisplayName,
    hasSupportedLinkDropPayload,
    insertDroppedText,
    parseFilePaths as parseTaskLinkParts,
    resolveDroppedLinkFromDataTransfer,
} from "../utils/taskLinks";

export function getDroppedFilePath(file: File): string {
    return getNativeDroppedFilePath(file);
}

export function formatPathForInsertion(path: string): string {
    return formatDroppedPathForInsertion(path);
}

/**
 * Récupère le chemin natif d'un File droppé (fichier ou dossier).
 * Utilise webUtils.getPathForFile via l'API Electron si disponible,
 * sinon fallback sur la propriété .path (ancienne API).
 */
 

/**
 * Détecte et parse les URLs https?:// et les chemins de fichiers dans le texte
 */
export function parseFilePaths(text: string) {
    return parseTaskLinkParts(text);
    const parts: Array<{ type: 'text' | 'path' | 'url', content: string }> = [];
    let lastIndex = 0;

    // Regex combinée pour détecter dans l'ordre :
    // 1. URLs https?://
    // 2. Chemins entre guillemets (avec espaces): "C:\path with spaces\file.txt"
    // 3. Chemins Windows sans espaces: C:\path\file.txt
    // 4. Chemins Unix sans espaces: /path/file.txt ou ./path/file.txt
    // 5. Chemins UNC: \\server\share\file
    const combinedRegex = /(https?:\/\/[^\s"<>]+)|"([a-zA-Z]:[^"]+|\/[^"]+|\.\.?\/[^"]+|\\\\[^"]+)"|(?:[a-zA-Z]:\\(?:[^\s\\/:*?"<>|]+\\)*[^\s\\/:*?"<>|]+(?:\.[a-zA-Z0-9]+)?)|(?:\/(?:[^\s/]+\/)*[^\s/]+)|(?:\.\.?\/(?:[^\s/]+\/)*[^\s/]+)|(?:\\\\[^\s\\]+\\[^\s\\]+(?:\\[^\s\\]+)*)/g;

    let match;
    while ((match = combinedRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
        }

        if (match[1]) {
            // URL https?://
            parts.push({ type: 'url', content: match[1] });
            lastIndex = match.index + match[0].length;
        } else {
            // Chemin fichier (avec ou sans guillemets)
            const path = match[2] || match[0];
            if (path.includes('\\') || path.includes('/') || path.match(/\.[a-zA-Z0-9]{2,4}$/)) {
                parts.push({ type: 'path', content: path });
                lastIndex = match.index + match[0].length;
            } else {
                parts.push({ type: 'text', content: match[0] });
                lastIndex = match.index + match[0].length;
            }
        }
    }

    if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content: text }];
}

/**
 * Retourne uniquement le nom de fichier ou dossier (dernier segment du chemin)
 */
export function getPathDisplayName(path: string): string {
    return getParsedPathDisplayName(path);
}

interface ContextMenuProps {
    x: number;
    y: number;
    assignedTo: string[];
    startDate: string | null | undefined;
    endDate: string | null | undefined;
    users: Array<{ id: string; name: string }>;
    onConvert: () => void;
    onToggleAssign: (userId: string) => void;
    onSetDates: (patch: { startDate?: string | null; endDate?: string | null }) => void;
    onClose: () => void;
}

function SubtaskContextMenu({ x, y, assignedTo, startDate, endDate, users, onConvert, onToggleAssign, onSetDates, onClose }: ContextMenuProps) {
    useEffect(() => {
        const handleClick = () => onClose();
        window.addEventListener('mousedown', handleClick);
        return () => window.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    const openUp   = y > window.innerHeight / 2;
    const openLeft = x > window.innerWidth  / 2;

    const style: React.CSSProperties = {
        ...(openUp   ? { bottom: window.innerHeight - y } : { top: y }),
        ...(openLeft ? { right:  window.innerWidth  - x } : { left: x }),
    };

    return createPortal(
        <div
            style={style}
            className="fixed z-[99999] min-w-[210px] rounded-lg border border-white/10 bg-slate-800 py-1 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
        >
            <button
                onClick={() => { onConvert(); onClose(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
                <ArrowUpFromLine className="h-4 w-4 text-blue-400" />
                Convertir en tâche
            </button>
            <div className="mx-2 my-1 h-px bg-white/10" />
            <p className="px-3 py-1 text-[10px] font-semibold uppercase text-slate-500 flex items-center gap-1.5">
                <UserPlus className="h-3 w-3" /> Affecter à
            </p>
            <div className="flex flex-wrap gap-1.5 px-3 py-1.5">
                {users.map(u => (
                    <button
                        key={u.id}
                        onClick={() => onToggleAssign(u.id)}
                        title={assignedTo.includes(u.id) ? `Retirer ${u.name}` : u.name}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold transition ${
                            assignedTo.includes(u.id)
                                ? "bg-blue-500/30 text-blue-300 ring-2 ring-blue-400/60"
                                : "bg-white/10 text-slate-300 hover:bg-white/20"
                        }`}
                    >
                        {getInitials(u.name)}
                    </button>
                ))}
            </div>
            {assignedTo.length > 0 && (
                <>
                    <div className="mx-2 my-1 h-px bg-white/10" />
                    <p className="px-3 py-1 text-[10px] font-semibold uppercase text-slate-500 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" /> Date (timeline)
                    </p>
                    <div className="px-3 py-1.5 flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 w-12 shrink-0">Début</span>
                            <input
                                type="date"
                                value={startDate ?? ''}
                                onChange={(e) => onSetDates({ startDate: e.target.value || null })}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="flex-1 rounded bg-white/10 px-2 py-1 text-xs text-slate-200 outline-none focus:bg-white/20 [color-scheme:dark]"
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 w-12 shrink-0">Fin</span>
                            <input
                                type="date"
                                value={endDate ?? ''}
                                onChange={(e) => onSetDates({ endDate: e.target.value || null })}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="flex-1 rounded bg-white/10 px-2 py-1 text-xs text-slate-200 outline-none focus:bg-white/20 [color-scheme:dark]"
                            />
                        </div>
                    </div>
                    {(startDate || endDate) && (
                        <button
                            onClick={() => { onSetDates({ startDate: null, endDate: null }); onClose(); }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-rose-400 transition hover:bg-white/10"
                        >
                            Retirer les dates
                        </button>
                    )}
                </>
            )}
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
    const { toggleSubtask, deleteSubtask, updateSubtaskTitle, assignSubtask, unassignSubtask, setSubtaskDates, addTask, users, storagePath } = useStore();
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(subtask.title);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [isFileDropTarget, setIsFileDropTarget] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropDivRef = useRef<HTMLDivElement>(null);

    const handleFileDragOver = (e: React.DragEvent) => {
        if (!hasSupportedLinkDropPayload(e.dataTransfer)) return;
        e.preventDefault();
        e.stopPropagation();
        setIsFileDropTarget(true);
    };

    // Listener natif — React onDrop ne reçoit pas les drops OLE d'Outlook en Electron
    // (Electron dispatche IDataObject::Drop() sans passer par la délégation d'events React)
    useEffect(() => {
        const el = dropDivRef.current;
        if (!el) return;
        const nativeDrop = async (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsFileDropTarget(false);
            console.log('[NATIVE DROP] types:', Array.from(e.dataTransfer?.types ?? []), 'files:', e.dataTransfer?.files?.length, e.dataTransfer?.files?.[0]?.name);
            if (!e.dataTransfer) return;
            const resolution = await resolveDroppedLinkFromDataTransfer(
                e.dataTransfer as Pick<DataTransfer, 'files' | 'getData'>,
                { storagePath }
            );
            if (!resolution) return;
            if ('error' in resolution) { await alertModal(resolution.error); return; }
            const newTitle = insertDroppedText(subtask.title, resolution.insertedText, { separator: ' ' });
            updateSubtaskTitle(task.id, subtask.id, newTitle);
        };
        el.addEventListener('drop', nativeDrop);
        return () => el.removeEventListener('drop', nativeDrop);
    }, [subtask.title, subtask.id, task.id, storagePath, updateSubtaskTitle]);

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
                ref={dropDivRef}
                onContextMenu={handleContextMenu}
                onDragOver={handleFileDragOver}
                onDragLeave={() => setIsFileDropTarget(false)}
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
                        onDragOver={(e) => {
                            if (!hasSupportedLinkDropPayload(e.dataTransfer)) return;
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onDrop={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const resolution = await resolveDroppedLinkFromDataTransfer(e.dataTransfer, { storagePath });
                            if (!resolution) return;
                            if ('error' in resolution) {
                                await alertModal(resolution.error);
                                return;
                            }
                            const input = e.currentTarget;
                            const start = input.selectionStart ?? editTitle.length;
                            const end = input.selectionEnd ?? editTitle.length;
                            const newTitle = insertDroppedText(editTitle, resolution.insertedText, {
                                start,
                                end,
                                separator: ' ',
                            });
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
                        <LinkedTextContent
                            text={subtask.title}
                            textClassName={subtask.completed ? "text-slate-400 line-through" : "text-slate-200"}
                        />
                        {false && parseFilePaths(subtask.title).map((part, idx) =>
                            part.type === 'url' ? (
                                <button
                                    key={idx}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.electronAPI?.openExternalUrl) {
                                            window.electronAPI.openExternalUrl(part.content);
                                        } else {
                                            window.open(part.content, '_blank', 'noopener,noreferrer');
                                        }
                                    }}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(part.content);
                                    }}
                                    className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 hover:text-emerald-200 transition border border-emerald-500/30 text-xs"
                                    title={`Ouvrir : ${part.content}\nClic droit : copier`}
                                >
                                    <ExternalLink className="h-3 w-3" />
                                    {part.content.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 40)}{part.content.replace(/^https?:\/\//, '').length > 40 ? '…' : ''}
                                </button>
                            ) : part.type === 'path' ? (
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
                {/* Badges utilisateurs affectés — pulsants */}
                {(subtask.assignedTo || []).map(uid => {
                    const assignee = users.find(u => u.id === uid);
                    if (!assignee) return null;
                    return (
                        <span key={uid} className="relative shrink-0 inline-flex items-center" title={`Affecté à ${assignee.name}`}>
                            {!subtask.completed && <span className="absolute inset-0 rounded-full bg-blue-400/40 animate-ping" />}
                            <span className="relative rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                                {getInitials(assignee.name)}
                            </span>
                        </span>
                    );
                })}
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
                    assignedTo={subtask.assignedTo || []}
                    startDate={subtask.startDate}
                    endDate={subtask.endDate}
                    users={users}
                    onConvert={handleConvertToTask}
                    onToggleAssign={(userId) => {
                        const assigned = subtask.assignedTo || [];
                        if (assigned.includes(userId)) {
                            unassignSubtask(task.id, subtask.id, userId);
                        } else {
                            assignSubtask(task.id, subtask.id, userId);
                        }
                    }}
                    onSetDates={(patch) => setSubtaskDates(task.id, subtask.id, patch)}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </>
    );
}

interface SubtaskListProps {
    task: Task;
    hideHeader?: boolean;
}

/**
 * Liste de sous-tâches avec drag & drop
 */
export function SubtaskList({ task, hideHeader }: SubtaskListProps) {
    const { addSubtask, reorderSubtasks, templates, applyTemplateToTask, storagePath } = useStore();
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const dragFromGrip = useRef(false);
    const [isNewDropTarget, setIsNewDropTarget] = useState(false);
    const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
    const templateDropdownRef = useRef<HTMLDivElement>(null);
    const newSubtaskInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!showTemplateDropdown) return;
        function handleClickOutside(e: MouseEvent) {
            if (templateDropdownRef.current?.contains(e.target as Node)) return;
            setShowTemplateDropdown(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showTemplateDropdown]);

    // Listener natif sur l'input "nouvelle sous-tâche" — même raison que SubtaskItem
    useEffect(() => {
        const el = newSubtaskInputRef.current;
        if (!el) return;
        const nativeDrop = async (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsNewDropTarget(false);
            console.log('[NATIVE DROP input] types:', Array.from(e.dataTransfer?.types ?? []), 'files:', e.dataTransfer?.files?.length);
            if (!e.dataTransfer) return;
            const resolution = await resolveDroppedLinkFromDataTransfer(
                e.dataTransfer as Pick<DataTransfer, 'files' | 'getData'>,
                { storagePath }
            );
            if (!resolution) return;
            if ('error' in resolution) { await alertModal(resolution.error); return; }
            setNewSubtaskTitle(prev => insertDroppedText(prev, resolution.insertedText, { separator: ' ' }));
        };
        el.addEventListener('drop', nativeDrop);
        return () => el.removeEventListener('drop', nativeDrop);
    }, [storagePath]);

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
        <div className="relative z-20 space-y-2">
            {!hideHeader && (<div className="flex items-center gap-2">
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
            </div>)}

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
                    ref={newSubtaskInputRef}
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onDragOver={(e) => {
                        if (!hasSupportedLinkDropPayload(e.dataTransfer)) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setIsNewDropTarget(true);
                    }}
                    onDragLeave={() => setIsNewDropTarget(false)}
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
