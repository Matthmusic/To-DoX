import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DropIndicator } from "../hooks/useDragAndDrop";
import { motion } from "framer-motion";
import {
    ClipboardList, AlertTriangle, Paperclip, FileText, MoreHorizontal,
    FolderOpen, ChevronDown, ChevronRight, Star, User, ExternalLink, Edit3, MessageCircle,
    CheckCircle2, RotateCcw, ArrowDownToLine
} from "lucide-react";
import { createPortal } from "react-dom";
import { businessDayDelta, getProjectColor, getInitials } from "../utils";
import { SubtaskList, parseFilePaths, getPathDisplayName, getDroppedFilePath, formatPathForInsertion } from "./SubtaskList";
import { TaskComments } from "./TaskComments";
import useStore from "../store/useStore";
import type { Task } from "../types";

interface TaskCardProps {
    task: Task;
    onDragStart: (e: React.DragEvent, taskId: string) => void;
    onClick: (task: Task, x: number, y: number) => void;
    onContextMenu: (e: React.MouseEvent, task: Task) => void;
    onSetProjectDirectory: () => void;
    onDragOverTask?: (e: React.DragEvent, taskId: string, el: HTMLElement) => void;
    onDropOnTask?: (e: React.DragEvent, taskId: string) => void;
    onDragLeaveTask?: () => void;
    dropIndicator?: DropIndicator | null;
}

/**
 * Carte de tâche Kanban
 */
export function TaskCard({
    task,
    onDragStart,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onClick: _onClick,
    onContextMenu,
    onSetProjectDirectory,
    onDragOverTask,
    onDropOnTask,
    onDragLeaveTask,
    dropIndicator,
}: TaskCardProps) {
    const { directories, users, projectColors, updateTask, comments, currentUser, validateTask, requestCorrections, convertSubtaskBack } = useStore();
    const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false);
    const [showUserPopover, setShowUserPopover] = useState(false);
    const [subtaskOriginMenu, setSubtaskOriginMenu] = useState<{ x: number; y: number } | null>(null);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [showCorrectionInput, setShowCorrectionInput] = useState(false);
    const [correctionText, setCorrectionText] = useState("");
    const [localNotes, setLocalNotes] = useState(task.notes || "");
    const [notesDropTarget, setNotesDropTarget] = useState(false);
    const [cardFileDropTarget, setCardFileDropTarget] = useState(false);
    const [isTextFocused, setIsTextFocused] = useState(false);
    const preventNextDrag = useRef(false);
    const userButtonRef = useRef<HTMLButtonElement>(null);
    const userPopoverRef = useRef<HTMLDivElement>(null);
    const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const isDropTarget = dropIndicator?.taskId === task.id;
    const showLineBefore = isDropTarget && dropIndicator?.position === 'before';
    const showLineAfter = isDropTarget && dropIndicator?.position === 'after';

    // Calcul des indicateurs visuels
    const remainingDays = task.due ? businessDayDelta(task.due) : null;
    const isOverdue = remainingDays !== null && remainingDays < 0;

    // Urgency tone - gradient overlay based on business days remaining
    const urgencyTone = (() => {
        if (remainingDays === null) return "from-slate-500/10 via-slate-500/5 to-transparent";
        if (remainingDays < 0) return "from-rose-600/40 via-rose-500/20 to-transparent";
        if (remainingDays < 3) return "from-rose-500/35 via-rose-500/15 to-transparent";
        if (remainingDays <= 7) return "from-amber-400/30 via-amber-400/10 to-transparent";
        return "from-emerald-400/30 via-emerald-400/10 to-transparent";
    })();
    // Using updatedAt as proxy for status change if we don't track statusUpdatedAt separate
    // Assuming updatedAt exists on Task interface as number
    const daysInColumn = task.updatedAt
        ? Math.floor((Date.now() - task.updatedAt) / (1000 * 60 * 60 * 24))
        : 0;
    const showStagnationAlert = (task.status === "doing" || task.status === "review") && daysInColumn > 3;
    const isDueToday = remainingDays === 0;

    // Compteur de commentaires + mention de l'utilisateur courant
    const taskComments = (comments[task.id] || []).filter(c => !c.deletedAt);
    const commentCount = taskComments.length;
    const currentUserName = currentUser ? users.find(u => u.id === currentUser)?.name : null;
    const hasMention = !!currentUserName && taskComments.some(c => c.text.includes(`@${currentUserName}`));

    // Subtask Progress Calculation
    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter(st => st.completed).length;
    const totalSubtasks = subtasks.length;
    const progressPercentage = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

    const projectColor = task.project ? getProjectColor(task.project, projectColors) : { border: "", bg: "", text: "" };
    const projectDir = task.project ? directories[task.project] : null;

    const urgencyGlowClass = (() => {
        if (remainingDays === null) return "hover:shadow-[0_0_0_1px_rgba(148,163,184,0.2),0_0_24px_rgba(148,163,184,0.15)]";
        if (remainingDays < 0) return "hover:shadow-[0_0_0_1px_rgba(244,63,94,0.35),0_0_24px_rgba(244,63,94,0.35)]";
        if (remainingDays < 3) return "hover:shadow-[0_0_0_1px_rgba(244,63,94,0.35),0_0_24px_rgba(244,63,94,0.35)]";
        if (remainingDays <= 7) return "hover:shadow-[0_0_0_1px_rgba(251,191,36,0.35),0_0_24px_rgba(251,191,36,0.35)]";
        return "hover:shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_0_24px_rgba(52,211,153,0.35)]";
    })();

    // Find assigned users (multiple)
    const assignedUsers = useMemo(() => {
        return task.assignedTo.map(userId => users.find(u => u.id === userId)).filter(Boolean);
    }, [task.assignedTo, users]);

    // Find reviewer users
    const reviewerUsers = useMemo(() => {
        return (task.reviewers || []).map(userId => users.find(u => u.id === userId)).filter(Boolean);
    }, [task.reviewers, users]);

    // Find creator user
    const creatorUser = useMemo(() => {
        return users.find(u => u.id === task.createdBy) || users.find(u => u.id === "unassigned");
    }, [task.createdBy, users]);

    // Synchroniser localNotes avec task.notes
    useEffect(() => {
        setLocalNotes(task.notes || "");
    }, [task.notes]);

    // Auto-focus + auto-resize le textarea lors de l'édition
    useEffect(() => {
        if (isEditingNotes && notesTextareaRef.current) {
            const ta = notesTextareaRef.current;
            ta.focus();
            ta.style.height = 'auto';
            ta.style.height = Math.max(100, ta.scrollHeight) + 'px';
        }
    }, [isEditingNotes]);

    useEffect(() => {
        if (!showUserPopover) return;
        function handleClickOutside(event: MouseEvent) {
            if (
                userPopoverRef.current?.contains(event.target as Node) ||
                userButtonRef.current?.contains(event.target as Node)
            ) {
                return;
            }
            setShowUserPopover(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showUserPopover]);

    // Format completion date
    const completionDateLabel = useMemo(() => {
        if (task.status !== "done") return null;
        const ts = task.completedAt || task.updatedAt || task.createdAt;
        if (!ts) return null;
        const date = new Date(ts);
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }, [task.status, task.completedAt, task.updatedAt, task.createdAt]);

    const handleOpenFolder = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (projectDir) {
            // Utiliser l'API Electron exposée
            if (window.electronAPI?.openFolder) {
                window.electronAPI.openFolder(projectDir);
            }
        } else {
            // Ouvrir la modale de configuration
            onSetProjectDirectory();
        }
    };

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation();
        updateTask(task.id, { favorite: !task.favorite });
    };

    const handleSaveNotes = () => {
        if (localNotes !== task.notes) {
            updateTask(task.id, { notes: localNotes });
        }
        setIsEditingNotes(false);
    };

    const handleNotesKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setLocalNotes(task.notes || "");
            setIsEditingNotes(false);
        }
        // Ctrl+Enter pour sauvegarder
        if (e.key === "Enter" && e.ctrlKey) {
            handleSaveNotes();
        }
    };

    return (
        <div className="relative">
            {showLineBefore && <div className="absolute -top-1.5 left-0 right-0 h-0.5 rounded-full bg-blue-400 z-20 pointer-events-none" />}
        <motion.div
            ref={cardRef}
            draggable={!isTextFocused}
            onFocus={(e) => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) setIsTextFocused(true); }}
            onBlur={(e) => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) setIsTextFocused(false); }}
            onMouseDown={(e) => { preventNextDrag.current = !!(e.target as HTMLElement).closest('[data-nodrag]'); }}
            onDragStart={(e: any) => {
                if (isTextFocused || preventNextDrag.current) { e.preventDefault(); preventNextDrag.current = false; return; }
                onDragStart(e as React.DragEvent, task.id);
            }}
            onDragOver={(e: any) => {
                const dragEvent = e as React.DragEvent;
                if (dragEvent.dataTransfer.types.includes('Files')) {
                    dragEvent.preventDefault();
                    dragEvent.stopPropagation();
                    setCardFileDropTarget(true);
                    return;
                }
                cardRef.current && onDragOverTask?.(dragEvent, task.id, cardRef.current);
            }}
            onDrop={(e: any) => {
                const dragEvent = e as React.DragEvent;
                if (dragEvent.dataTransfer.files.length > 0) {
                    dragEvent.preventDefault();
                    dragEvent.stopPropagation();
                    setCardFileDropTarget(false);
                    const file = dragEvent.dataTransfer.files[0];
                    const path = getDroppedFilePath(file);
                    if (!path) return;
                    const formattedPath = formatPathForInsertion(path);
                    const currentNotes = task.notes || '';
                    const newNotes = currentNotes ? `${currentNotes}\n${formattedPath}` : formattedPath;
                    setLocalNotes(newNotes);
                    updateTask(task.id, { notes: newNotes });
                    return;
                }
                onDropOnTask?.(dragEvent, task.id);
            }}
            onDragLeave={() => { setCardFileDropTarget(false); onDragLeaveTask?.(); }}
            onClick={() => setIsSubtasksExpanded(v => !v)}
            onContextMenu={(e) => onContextMenu(e, task)}
            className={`group relative mb-3 flex flex-col gap-3 rounded-2xl border border-white/5 bg-[#161b2e] p-4 shadow-lg transition-all hover:border-white/20 ${urgencyGlowClass} ${isDueToday ? "pulse-glow" : isOverdue ? "ring-1 ring-rose-500/50" : ""
                } ${task.favorite ? "overflow-visible rainbow-border" : "overflow-hidden"} ${isDropTarget ? "ring-1 ring-blue-400/50" : ""} ${cardFileDropTarget ? "ring-2 ring-blue-400/70 border-blue-400/40 bg-blue-500/5" : ""}`}
            title={cardFileDropTarget ? "Déposer pour ajouter le chemin à la note" : undefined}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
                duration: 0.2,
                ease: "easeOut"
            }}
        >
            {/* Urgency gradient overlay */}
            <div className={`absolute inset-0 pointer-events-none opacity-80 bg-gradient-to-br ${urgencyTone}`} />

            {/* Card content - relative z-10 to appear above gradient */}
            <div className="relative z-10 flex flex-col gap-3">

            {/* Badge : tâche issue d'une sous-tâche */}
            {task.convertedFromSubtask && (
                <>
                <button
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSubtaskOriginMenu({ x: e.clientX, y: e.clientY });
                    }}
                    className="flex items-center gap-1.5 self-start rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 hover:bg-indigo-400/20 transition cursor-context-menu"
                    title={`Issu de la sous-tâche de : ${task.convertedFromSubtask.parentTaskTitle}\nClic droit pour reconvertir en sous-tâche`}
                >
                    <ArrowDownToLine className="h-3 w-3" />
                    Sous-tâche de : {task.convertedFromSubtask.parentTaskTitle}
                </button>
                {subtaskOriginMenu && createPortal(
                    <div
                        style={{ top: Math.min(subtaskOriginMenu.y, window.innerHeight - 60), left: Math.min(subtaskOriginMenu.x, window.innerWidth - 200) }}
                        className="fixed z-[99999] min-w-[190px] rounded-lg border border-white/10 bg-slate-800 py-1 shadow-xl"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                convertSubtaskBack(task.id);
                                setSubtaskOriginMenu(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                        >
                            <ArrowDownToLine className="h-4 w-4 text-indigo-400" />
                            Reconvertir en sous-tâche
                        </button>
                    </div>,
                    document.body
                )}
                {subtaskOriginMenu && createPortal(
                    <div className="fixed inset-0 z-[99998]" onMouseDown={() => setSubtaskOriginMenu(null)} />,
                    document.body
                )}
                </>
            )}

            {/* Header: Title + Actions */}
            <div className="flex items-start justify-between gap-2">
                <h4 className="text-base font-bold text-white leading-snug line-clamp-2 uppercase">
                    {task.title}
                </h4>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleToggleFavorite(e); }}
                        className={`rounded-lg p-1.5 transition ${task.favorite
                            ? "text-amber-400 hover:bg-amber-400/20"
                            : "text-slate-400 hover:bg-white/10 hover:text-amber-400"
                            }`}
                        title={task.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                    >
                        <Star className="h-4 w-4" fill={task.favorite ? "currentColor" : "none"} />
                    </button>
                    {task.project && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleOpenFolder(e); }}
                            className={`rounded-lg p-1.5 transition ${projectDir ? "text-indigo-400 hover:bg-indigo-400/20" : "text-slate-600 hover:text-slate-300"}`}
                            title={projectDir ? `Ouvrir : ${projectDir}` : "Configurer le dossier"}
                        >
                            <FolderOpen className="h-4 w-4" />
                        </button>
                    )}
                    {/* Créateur */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onContextMenu(e, task);
                        }}
                        className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold transition-all hover:scale-110 cursor-pointer ${
                            creatorUser && creatorUser.id !== "unassigned"
                                ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-200 hover:bg-emerald-300/25"
                                : "border-slate-500/30 bg-slate-700/20 text-slate-400 hover:bg-slate-700/30"
                        } ${task.status === 'review' && task.movedToReviewBy && creatorUser?.id === task.movedToReviewBy ? "ring-2 ring-violet-400 ring-offset-1 ring-offset-[#161b2e]" : ""}`}
                        title={creatorUser && creatorUser.id !== "unassigned" ? `Créée par ${creatorUser.name} - Cliquer pour gérer` : "Créateur inconnu - Cliquer pour gérer"}
                    >
                        {getInitials(creatorUser?.id !== "unassigned" ? creatorUser?.name : null)}
                    </button>
                    {/* Affecté à (multiple) */}
                    {assignedUsers.length === 0 ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onContextMenu(e, task);
                            }}
                            className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-500/30 bg-slate-700/20 text-slate-400 transition-all hover:scale-110 hover:bg-slate-700/30 cursor-pointer"
                            title="Non assignée - Cliquer pour assigner"
                        >
                            <User className="h-3.5 w-3.5" />
                        </button>
                    ) : (
                        assignedUsers.map((user, idx) => (
                            <button
                                key={user!.id}
                                type="button"
                                ref={idx === 0 ? userButtonRef : undefined}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onContextMenu(e, task);
                                }}
                                className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-300/40 bg-blue-300/15 text-blue-200 text-[10px] font-bold transition-all hover:scale-110 hover:bg-blue-300/25 cursor-pointer ${task.status === 'review' && task.movedToReviewBy && user!.id === task.movedToReviewBy ? "ring-2 ring-violet-400 ring-offset-1 ring-offset-[#161b2e]" : ""}`}
                                title={`Assignée à ${user!.name} - Cliquer pour gérer`}
                            >
                                {getInitials(user!.name)}
                            </button>
                        ))
                    )}
                    {/* Commentaires */}
                    {commentCount > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsSubtasksExpanded(true); }}
                            className={`flex items-center gap-0.5 rounded-lg p-1.5 transition hover:bg-white/10 ${hasMention ? "animate-pulse text-amber-400 hover:text-amber-300" : "text-slate-400 hover:text-white"}`}
                            title={hasMention ? `Vous êtes mentionné(e) — ${commentCount} commentaire(s)` : `${commentCount} commentaire(s)`}
                        >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span className="text-[9px] font-bold">{commentCount}</span>
                        </button>
                    )}
                    <button
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                        onClick={(e) => {
                            e.stopPropagation();
                            onContextMenu(e, task);
                        }}
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-2">
                {task.project && (
                    <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${projectColor.bg} ${projectColor.border} ${projectColor.text}`}
                    >
                        {task.project}
                    </span>
                )}

                <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${task.priority === 'high' ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white' :
                    task.priority === 'med' ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-black' :
                        'bg-gradient-to-r from-emerald-400 to-lime-400 text-black'
                    }`}>
                    {task.priority === 'high' ? 'HAUTE' : task.priority === 'med' ? 'MOYENNE' : 'BASSE'}
                </span>

                <div className="ml-auto flex items-center gap-2">
                    {/* Stagnation Alert */}
                    {showStagnationAlert && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-orange-400" title={`Aucun mouvement depuis ${daysInColumn} jours`}>
                            <AlertTriangle className="h-3 w-3" />
                        </span>
                    )}

                    {/* Due Date or Completion Date */}
                    {task.status === "done" ? (
                        completionDateLabel ? (
                            <span className="text-[11px] font-bold text-emerald-400">
                                Fait le : {completionDateLabel}
                            </span>
                        ) : (
                            <span className="text-[11px] font-bold text-emerald-400">Fait</span>
                        )
                    ) : (
                        (remainingDays !== null) && (
                            <span className={`text-[11px] font-bold ${
                                remainingDays < 0 ? "text-rose-400" :
                                    remainingDays < 3 ? "text-rose-400" :
                                        remainingDays <= 7 ? "text-amber-400" :
                                            "text-emerald-400"
                                }`}>
                                {task.status === "review" && task.movedToReviewAt && (() => {
                                    const d = new Date(task.movedToReviewAt);
                                    const dd = String(d.getDate()).padStart(2, '0');
                                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                                    const hh = String(d.getHours()).padStart(2, '0');
                                    const mn = String(d.getMinutes()).padStart(2, '0');
                                    return <span className="font-normal text-violet-400 mr-1">À réviser depuis ({dd}/{mm} {hh}:{mn})</span>;
                                })()}
                                {remainingDays < 0 ? `J+${Math.abs(remainingDays)}` : `J-${remainingDays} ouvrés`}
                            </span>
                        )
                    )}
                </div>
            </div>

            {/* Footer: Subtasks & Interactions */}
            <div>
                {(totalSubtasks > 0 || task.notes) && (
                    <div className="flex flex-col gap-1.5 mb-2">
                        {task.notes && (
                            <span className="flex items-center justify-center gap-1.5 w-full rounded py-0.5 bg-amber-400/15 text-amber-400" title="Cette tâche contient une note">
                                <FileText className="h-3 w-3" />
                                <span className="text-[10px] font-semibold leading-none">note</span>
                            </span>
                        )}
                        {totalSubtasks > 0 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsSubtasksExpanded(!isSubtasksExpanded);
                                }}
                                className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-indigo-400 transition"
                            >
                                <div className={`flex items-center gap-1 ${progressPercentage === 100 ? "text-emerald-400" : ""}`}>
                                    <ClipboardList className="h-3.5 w-3.5" />
                                    <span className="font-medium">{completedSubtasks}/{totalSubtasks} sous-tâches</span>
                                </div>
                                {isSubtasksExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </button>
                        )}
                    </div>
                )}

                {/* Button to add first subtask */}
                {totalSubtasks === 0 && !isSubtasksExpanded && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsSubtasksExpanded(true);
                        }}
                        className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-indigo-400 transition mb-2"
                    >
                        <ClipboardList className="h-3.5 w-3.5" />
                        <span className="font-medium">+ Ajouter des sous-tâches</span>
                    </button>
                )}

                {/* Progress Bar */}
                {totalSubtasks > 0 && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${progressPercentage === 100 ? "bg-gradient-to-r from-emerald-500 to-teal-400" :
                                progressPercentage < 30 ? "bg-rose-500" :
                                    "bg-gradient-to-r from-indigo-500 to-purple-500"
                                }`}
                            style={{ width: `${progressPercentage}%` }}
                        />
                        {progressPercentage > 0 && <span className="sr-only">{progressPercentage}%</span>}
                    </div>
                )}

                {/* Percent text just above bar if needed, or keeping minimal */}
                {totalSubtasks > 0 && (
                    <p className={`mt-1 text-[10px] font-bold ${progressPercentage === 100 ? "text-emerald-400" :
                        progressPercentage < 30 ? "text-rose-400" :
                            "text-indigo-400"
                        }`}>
                        {progressPercentage}%
                    </p>
                )}
            </div>

            {/* ── Workflow de révision ─────────────────────────────── */}
            {task.status === "review" && (
                <div onClick={e => e.stopPropagation()} className="space-y-2">
                    {/* Avatars des réviseurs désignés */}
                    {reviewerUsers.length > 0 && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">Réviseurs :</span>
                            {reviewerUsers.map(user => {
                                const isMe = user!.id === currentUser;
                                return (
                                    <span
                                        key={user!.id}
                                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[9px] font-bold transition-all ${
                                            isMe
                                                ? "border-violet-400 bg-violet-400/30 text-violet-100 ring-2 ring-violet-400 ring-offset-1 ring-offset-[#161b2e] animate-pulse"
                                                : "border-violet-400/40 bg-violet-400/15 text-violet-200"
                                        }`}
                                        title={isMe ? `${user!.name} (vous — révision en attente)` : user!.name}
                                    >
                                        {getInitials(user!.name)}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                    {/* Boutons d'action de révision — visibles uniquement pour les réviseurs désignés */}
                    {currentUser && (task.reviewers || []).includes(currentUser) && (
                        !showCorrectionInput ? (
                        <div className="flex gap-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    validateTask(task.id);
                                }}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 hover:text-emerald-200"
                                title="Valider cette tâche"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Valider
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowCorrectionInput(true);
                                }}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/25 hover:text-amber-200"
                                title="Demander des corrections"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Corrections
                            </button>
                        </div>
                        ) : (
                        <div className="space-y-1.5">
                            <textarea
                                autoFocus
                                value={correctionText}
                                onChange={e => setCorrectionText(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Escape') { setShowCorrectionInput(false); setCorrectionText(""); }
                                    if (e.key === 'Enter' && e.ctrlKey && correctionText.trim().length >= 5) {
                                        requestCorrections(task.id, correctionText.trim());
                                        setShowCorrectionInput(false);
                                        setCorrectionText("");
                                    }
                                }}
                                placeholder="Motif des corrections... (Ctrl+Enter pour envoyer)"
                                className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100 placeholder-amber-400/50 focus:outline-none focus:border-amber-400 resize-none"
                                rows={2}
                            />
                            <div className="flex gap-1.5">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (correctionText.trim().length < 5) return;
                                        requestCorrections(task.id, correctionText.trim());
                                        setShowCorrectionInput(false);
                                        setCorrectionText("");
                                    }}
                                    disabled={correctionText.trim().length < 5}
                                    className="flex-1 rounded-xl border border-amber-500/40 bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Envoyer
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowCorrectionInput(false); setCorrectionText(""); }}
                                    className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-400 transition hover:bg-white/10"
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                        )
                    )}
                </div>
            )}

            {/* Expanded Content: Notes + Subtasks */}
            {isSubtasksExpanded && (
                <div data-nodrag onClick={e => e.stopPropagation()} className="mt-2 pt-2 border-t border-white/5 space-y-3">
                    {/* Notes Section — toujours visible quand la carte est dépliée */}
                    <div className="rounded-lg bg-white/5 border border-white/10 p-3 hover:border-amber-400/30 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                                <Paperclip className="h-3.5 w-3.5 text-amber-400" />
                                <span className="text-xs font-bold text-amber-400 uppercase">Notes</span>
                            </div>
                            {!isEditingNotes && task.notes && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsEditingNotes(true);
                                    }}
                                    className="p-1 rounded hover:bg-amber-400/20 text-amber-400 transition"
                                    title="Éditer les notes"
                                >
                                    <Edit3 className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                        {isEditingNotes ? (
                            <div className="space-y-2">
                                <textarea
                                    ref={notesTextareaRef}
                                    value={localNotes}
                                    onChange={(e) => {
                                        setLocalNotes(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = Math.max(100, e.target.scrollHeight) + 'px';
                                    }}
                                    onBlur={handleSaveNotes}
                                    onKeyDown={handleNotesKeyDown}
                                    onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); setNotesDropTarget(true); } }}
                                    onDragLeave={() => setNotesDropTarget(false)}
                                    onDrop={(e) => {
                                        if (e.dataTransfer.files.length === 0) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setNotesDropTarget(false);
                                        const file = e.dataTransfer.files[0];
                                        const path = getDroppedFilePath(file);
                                        if (!path) return;
                                        const formattedPath = formatPathForInsertion(path);
                                        const ta = e.currentTarget;
                                        const start = ta.selectionStart ?? localNotes.length;
                                        const end = ta.selectionEnd ?? localNotes.length;
                                        const newNotes = localNotes.slice(0, start) + (start > 0 ? '\n' : '') + formattedPath + localNotes.slice(end);
                                        setLocalNotes(newNotes);
                                        updateTask(task.id, { notes: newNotes });
                                    }}
                                    className={`w-full min-h-[100px] rounded-lg border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:bg-white/15 resize-y transition ${notesDropTarget ? 'border-blue-400/60 bg-blue-400/10' : 'bg-white/10 border-amber-400/30'}`}
                                    placeholder="Ajouter des notes... (Ctrl+Enter pour sauvegarder, Echap pour annuler)"
                                />
                                <div className="flex gap-2 text-xs text-slate-300">
                                    <span>💡 Astuce: Utilisez des guillemets pour les chemins avec espaces</span>
                                </div>
                            </div>
                        ) : task.notes ? (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.getSelection()?.toString()) return;
                                    setIsEditingNotes(true);
                                }}
                                onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); setNotesDropTarget(true); } }}
                                onDragLeave={() => setNotesDropTarget(false)}
                                onDrop={(e) => {
                                    if (e.dataTransfer.files.length === 0) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setNotesDropTarget(false);
                                    const file = e.dataTransfer.files[0];
                                    const path = getDroppedFilePath(file);
                                    if (!path) return;
                                    const formattedPath = formatPathForInsertion(path);
                                    const newNotes = localNotes ? `${localNotes}\n${formattedPath}` : formattedPath;
                                    setLocalNotes(newNotes);
                                    updateTask(task.id, { notes: newNotes });
                                }}
                                className={`text-sm text-slate-300 whitespace-pre-wrap leading-relaxed cursor-pointer hover:text-white transition rounded-lg p-1 select-text ${notesDropTarget ? 'border border-blue-400/60 bg-blue-400/10' : ''}`}
                                title="Cliquer pour éditer · Déposer un fichier pour insérer son chemin"
                            >
                                {parseFilePaths(task.notes).map((part, idx) =>
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
                            </div>
                        ) : (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingNotes(true);
                                }}
                                onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); setNotesDropTarget(true); } }}
                                onDragLeave={() => setNotesDropTarget(false)}
                                onDrop={(e) => {
                                    if (e.dataTransfer.files.length === 0) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setNotesDropTarget(false);
                                    const file = e.dataTransfer.files[0];
                                    const path = getDroppedFilePath(file);
                                    if (!path) return;
                                    const formattedPath = formatPathForInsertion(path);
                                    setLocalNotes(formattedPath);
                                    updateTask(task.id, { notes: formattedPath });
                                }}
                                className={`min-h-[40px] flex items-center rounded-lg border border-dashed px-3 py-2 text-xs italic cursor-pointer transition ${notesDropTarget ? 'border-blue-400/60 bg-blue-400/10 text-blue-300' : 'border-white/10 text-slate-500 hover:text-amber-400 hover:border-amber-400/30'}`}
                                title="Cliquer pour écrire · Déposer un fichier ou dossier"
                            >
                                {notesDropTarget ? 'Déposer pour ajouter le chemin...' : 'Ajouter une note ou un fichier/dossier...'}
                            </div>
                        )}
                    </div>

                    {/* Subtasks Section */}
                    <SubtaskList task={task} />

                    {/* Comments Section */}
                    <div className="pt-2 border-t border-white/5">
                        <TaskComments taskId={task.id} />
                    </div>
                </div>
            )}
            </div>
            {/* Popover retiré - les initiales sont maintenant affichées directement sur les badges */}
        </motion.div>
            {showLineAfter && <div className="absolute -bottom-1.5 left-0 right-0 h-0.5 rounded-full bg-blue-400 z-20 pointer-events-none" />}
        </div>
    );
}
