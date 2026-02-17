import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
    ClipboardList, AlertTriangle, Paperclip, MoreHorizontal,
    FolderOpen, ChevronDown, ChevronRight, Star, User, ExternalLink, Edit3
} from "lucide-react";
import { businessDayDelta, getProjectColor, getInitials } from "../utils";
import { SubtaskList, parseFilePaths } from "./SubtaskList";
import { TaskComments } from "./TaskComments";
import useStore from "../store/useStore";
import type { Task } from "../types";

interface TaskCardProps {
    task: Task;
    onDragStart: (e: React.DragEvent, taskId: string) => void;
    onClick: (task: Task) => void;
    onContextMenu: (e: React.MouseEvent, task: Task) => void;
    onSetProjectDirectory: () => void;
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
    onSetProjectDirectory
}: TaskCardProps) {
    const { directories, users, projectColors, updateTask } = useStore();
    const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false);
    const [showUserPopover, setShowUserPopover] = useState(false);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [localNotes, setLocalNotes] = useState(task.notes || "");
    const userButtonRef = useRef<HTMLButtonElement>(null);
    const userPopoverRef = useRef<HTMLDivElement>(null);
    const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

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
    const showStagnationAlert = task.status === "doing" && daysInColumn > 3;
    const isDueToday = remainingDays === 0;

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

    // Find creator user
    const creatorUser = useMemo(() => {
        return users.find(u => u.id === task.createdBy) || users.find(u => u.id === "unassigned");
    }, [task.createdBy, users]);

    // Synchroniser localNotes avec task.notes
    useEffect(() => {
        setLocalNotes(task.notes || "");
    }, [task.notes]);

    // Auto-focus le textarea lors de l'édition
    useEffect(() => {
        if (isEditingNotes && notesTextareaRef.current) {
            notesTextareaRef.current.focus();
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
        <motion.div
            draggable
            onDragStart={(e: any) => onDragStart(e as React.DragEvent, task.id)}
            onClick={() => {
                setIsSubtasksExpanded((prev) => !prev);
            }}
            onContextMenu={(e) => onContextMenu(e, task)}
            className={`group relative mb-3 flex flex-col gap-3 rounded-2xl border border-white/5 bg-[#161b2e] p-4 shadow-lg transition-all hover:border-white/20 ${urgencyGlowClass} ${isDueToday ? "pulse-glow" : isOverdue ? "ring-1 ring-rose-500/50" : ""
                } ${task.favorite ? "overflow-visible rainbow-border" : "overflow-hidden"}`}
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
            {/* Header: Title + Actions */}
            <div className="flex items-start justify-between gap-2">
                <h4 className="text-base font-bold text-white leading-snug line-clamp-2 uppercase">
                    {task.title}
                </h4>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleToggleFavorite}
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
                            onClick={handleOpenFolder}
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
                        }`}
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
                                className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-300/40 bg-blue-300/15 text-blue-200 text-[10px] font-bold transition-all hover:scale-110 hover:bg-blue-300/25 cursor-pointer"
                                title={`Assignée à ${user!.name} - Cliquer pour gérer`}
                            >
                                {getInitials(user!.name)}
                            </button>
                        ))
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
                                {remainingDays < 0 ? `J${remainingDays}` : `J-${remainingDays} ouvrés`}
                            </span>
                        )
                    )}
                </div>
            </div>

            {/* Footer: Subtasks & Interactions */}
            <div>
                {(totalSubtasks > 0 || task.notes) && (
                    <div className="flex items-center gap-3 mb-2">
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
                        {task.notes && (
                            <Paperclip className="h-3.5 w-3.5 text-slate-400" />
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

            {/* Expanded Content: Notes + Subtasks */}
            {isSubtasksExpanded && (
                <div onClick={e => e.stopPropagation()} className="mt-2 pt-2 border-t border-white/5 space-y-3">
                    {/* Notes Section */}
                    {(task.notes || isEditingNotes) && (
                        <div className="rounded-lg bg-white/5 border border-white/10 p-3 hover:border-amber-400/30 transition-colors">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <Paperclip className="h-3.5 w-3.5 text-amber-400" />
                                    <span className="text-xs font-bold text-amber-400 uppercase">Notes</span>
                                </div>
                                {!isEditingNotes && (
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
                                        onChange={(e) => setLocalNotes(e.target.value)}
                                        onBlur={handleSaveNotes}
                                        onKeyDown={handleNotesKeyDown}
                                        className="w-full min-h-[100px] rounded-lg bg-white/10 border border-amber-400/30 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:bg-white/15 resize-y"
                                        placeholder="Ajouter des notes... (Ctrl+Enter pour sauvegarder, Echap pour annuler)"
                                    />
                                    <div className="flex gap-2 text-xs text-slate-300">
                                        <span>💡 Astuce: Utilisez des guillemets pour les chemins avec espaces</span>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsEditingNotes(true);
                                    }}
                                    className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed cursor-pointer hover:text-white transition"
                                >
                                    {parseFilePaths(task.notes || "").map((part, idx) =>
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
                                </div>
                            )}
                        </div>
                    )}

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
    );
}
