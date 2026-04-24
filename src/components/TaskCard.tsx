import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DropIndicator } from "../hooks/useDragAndDrop";
import { motion, AnimatePresence } from "framer-motion";
import {
    AlertTriangle, FileText, ClipboardList,
    ArrowDownToLine, Eye, EyeOff, Link2Off,
    Star, FolderOpen, MessageCircle, MoreHorizontal, User,
} from "lucide-react";
import { createPortal } from "react-dom";
import { businessDayDelta, getInitials } from "../utils";
import { alertModal } from "../utils/confirm";
import { SubtaskList, getDroppedFilePath, formatPathForInsertion } from "./SubtaskList";
import { TaskComments } from "./TaskComments";
import useStore from "../store/useStore";
import type { Task } from "../types";
import { TaskCardActions } from "./taskcard/TaskCardActions";
import { TaskSubtasksFooter } from "./taskcard/TaskSubtasksFooter";
import { TaskReviewSection } from "./taskcard/TaskReviewSection";
import { TaskNotesSection } from "./taskcard/TaskNotesSection";
import { PriorityBadge } from "./taskcard/PriorityBadge";
import { ChildTaskTree } from "./taskcard/ChildTaskTree";
import { CalendarContent } from "./DatePickerModal";

export type CardMode = 'full' | 'compact';
const CARD_MODES_KEY = "todox_card_modes";
export function getCardMode(id: string): CardMode {
    try {
        const legacy = new Set<string>(JSON.parse(localStorage.getItem("todox_compact_cards") || "[]"));
        const modes: Record<string, CardMode> = JSON.parse(localStorage.getItem(CARD_MODES_KEY) || "{}");
        const saved = modes[id];
        if (saved === 'compact' || saved === 'full') return saved;
        if (legacy.has(id)) return 'compact';
        return 'full';
    } catch { return 'full'; }
}
function saveCardMode(id: string, mode: CardMode) {
    try {
        const modes: Record<string, CardMode> = JSON.parse(localStorage.getItem(CARD_MODES_KEY) || "{}");
        modes[id] = mode;
        localStorage.setItem(CARD_MODES_KEY, JSON.stringify(modes));
    } catch { /* ignore */ }
}

interface TaskCardProps {
    task: Task;
    onDragStart: (e: React.DragEvent, taskId: string) => void;
    onCardModeChange?: (taskId: string, mode: CardMode) => void;
    onClick: (task: Task, x: number, y: number) => void;
    onContextMenu: (e: React.MouseEvent, task: Task) => void;
    onSetProjectDirectory: () => void;
    onDragOverTask?: (e: React.DragEvent, taskId: string, el: HTMLElement) => void;
    onDropOnTask?: (e: React.DragEvent, taskId: string) => void;
    onDragLeaveTask?: () => void;
    dropIndicator?: DropIndicator | null;
    nestTarget?: string | null;
    /** Mode forcé par le parent — override le mode local */
    forcedMode?: CardMode;
}

/**
 * Carte de tâche Kanban — style C1 (bande urgence + gradient)
 */
export function TaskCard({
    task,
    onDragStart,
    onClick: _onClick,
    onContextMenu,
    onSetProjectDirectory,
    onCardModeChange,
    onDragOverTask,
    onDropOnTask,
    onDragLeaveTask,
    dropIndicator,
    nestTarget,
    forcedMode,
}: TaskCardProps) {
    const { directories, users, tasks, updateTask, comments, currentUser, validateTask, requestCorrections, convertSubtaskBack, setTaskParent, highlightedTaskId, setHighlightedTaskId } = useStore();
    const [cardMode, setCardMode] = useState<CardMode>(() => getCardMode(task.id));
    const isCompact = (forcedMode ?? cardMode) === 'compact';
    const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false);
    const [subtaskOriginMenu, setSubtaskOriginMenu] = useState<{ x: number; y: number } | null>(null);
    const [parentTaskMenu, setParentTaskMenu] = useState<{ x: number; y: number } | null>(null);
    const [cardFileDropTarget, setCardFileDropTarget] = useState(false);
    const [isTextFocused, setIsTextFocused] = useState(false);
    const [dueDateTooltip, setDueDateTooltip] = useState<{ x: number; y: number } | null>(null);
    const preventNextDrag = useRef(false);
    const userButtonRef = useRef<HTMLButtonElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const isHighlighted = highlightedTaskId === task.id;

    // Scroll vers la carte, déplie en full et auto-clear après 10s quand elle est mise en surbrillance
    useEffect(() => {
        if (!isHighlighted) return;
        // Déplie la carte si elle est en mode compact
        if (isCompact && !forcedMode) {
            setCardMode('full');
            saveCardMode(task.id, 'full');
            onCardModeChange?.(task.id, 'full');
        }
        setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        const timer = setTimeout(() => setHighlightedTaskId(null), 10000);
        return () => clearTimeout(timer);
    }, [isHighlighted]);

    const isDropTarget = dropIndicator?.taskId === task.id;
    const showLineBefore = isDropTarget && dropIndicator?.position === 'before';
    const showLineAfter = isDropTarget && dropIndicator?.position === 'after';
    const isNestTarget = nestTarget === task.id;

    const remainingDays = task.due ? businessDayDelta(task.due) : null;
    const isOverdue = remainingDays !== null && remainingDays < 0;
    const isDueToday = remainingDays === 0;

    const urgencyTone = (() => {
        if (remainingDays === null) return "from-slate-500/10 via-slate-500/5 to-transparent";
        if (remainingDays < 0)  return "from-rose-600/40 via-rose-500/20 to-transparent";
        if (remainingDays < 3)  return "from-rose-500/35 via-rose-500/15 to-transparent";
        if (remainingDays <= 7) return "from-amber-400/30 via-amber-400/10 to-transparent";
        return "from-emerald-400/30 via-emerald-400/10 to-transparent";
    })();

    // Bande urgence C1
    const urgencyBand = (() => {
        const d = remainingDays;
        if (d === null) return { bg: 'bg-slate-800/60',   border: 'border-b border-slate-600/20',   text: 'text-slate-500',   label: 'SANS ÉCHÉANCE' };
        if (d < 0)      return { bg: 'bg-rose-950/80',    border: 'border-b border-rose-500/50',    text: 'text-rose-300',    label: `EN RETARD · J+${Math.abs(d)}` };
        if (d === 0)    return { bg: 'bg-rose-950/70',    border: 'border-b border-rose-400/50',    text: 'text-rose-300',    label: "AUJOURD'HUI" };
        if (d < 3)      return { bg: 'bg-rose-950/60',    border: 'border-b border-rose-400/40',    text: 'text-rose-300',    label: `URGENT · J-${d}` };
        if (d <= 7)     return { bg: 'bg-amber-950/60',   border: 'border-b border-amber-500/40',   text: 'text-amber-300',   label: `CETTE SEMAINE · J-${d}` };
        return           { bg: 'bg-emerald-950/40',  border: 'border-b border-emerald-500/20',  text: 'text-emerald-400', label: `DANS ${d} JOURS` };
    })();

    const daysInColumn = task.updatedAt
        ? Math.floor((Date.now() - task.updatedAt) / (1000 * 60 * 60 * 24))
        : 0;
    const showStagnationAlert = (task.status === "doing" || task.status === "review") && daysInColumn > 3;

    const calendarSelectedClass = (() => {
        if (remainingDays === null) return "border-slate-400/60 bg-slate-400/20 text-slate-200 animate-pulse font-bold";
        if (remainingDays < 3)  return "border-rose-300/60 bg-rose-300/20 text-rose-100 animate-pulse font-bold";
        if (remainingDays <= 7) return "border-amber-300/60 bg-amber-300/20 text-amber-100 animate-pulse font-bold";
        return "border-emerald-400/60 bg-emerald-400/20 text-emerald-100 animate-pulse font-bold";
    })();

    const urgencyGlowClass = (() => {
        if (remainingDays === null) return "hover:shadow-[0_0_0_1px_rgba(148,163,184,0.2),0_0_24px_rgba(148,163,184,0.15)]";
        if (remainingDays < 0)  return "hover:shadow-[0_0_0_1px_rgba(244,63,94,0.35),0_0_24px_rgba(244,63,94,0.35)]";
        if (remainingDays < 3)  return "hover:shadow-[0_0_0_1px_rgba(244,63,94,0.35),0_0_24px_rgba(244,63,94,0.35)]";
        if (remainingDays <= 7) return "hover:shadow-[0_0_0_1px_rgba(251,191,36,0.35),0_0_24px_rgba(251,191,36,0.35)]";
        return "hover:shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_0_24px_rgba(52,211,153,0.35)]";
    })();

    const taskComments = (comments[task.id] || []).filter(c => !c.deletedAt);
    const commentCount = taskComments.length;
    const currentUserName = currentUser ? users.find(u => u.id === currentUser)?.name : null;
    const hasMention = !!currentUserName && taskComments.some(c => c.text.includes(`@${currentUserName}`));

    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter(st => st.completed).length;
    const totalSubtasks = subtasks.length;
    const progressPercentage = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

    const projectDir = task.project ? directories[task.project] : null;

    const creatorUser = useMemo(() => {
        return users.find(u => u.id === task.createdBy) || users.find(u => u.id === "unassigned");
    }, [task.createdBy, users]);

    const reviewerUsers = useMemo(() => {
        return (task.reviewers || []).map(userId => users.find(u => u.id === userId)).filter(Boolean);
    }, [task.reviewers, users]);

    const unifiedUserBadges = useMemo(() => {
        const reviewerIds = new Set(task.reviewers || []);
        const seen = new Set<string>();
        const result: Array<{ userId: string; name: string; isCreator: boolean; isReviewer: boolean }> = [];
        if (creatorUser && creatorUser.id !== 'unassigned') {
            seen.add(creatorUser.id);
            result.push({ userId: creatorUser.id, name: creatorUser.name, isCreator: true, isReviewer: reviewerIds.has(creatorUser.id) });
        }
        for (const userId of task.assignedTo) {
            if (seen.has(userId) || userId === 'unassigned') continue;
            const user = users.find(u => u.id === userId);
            if (!user) continue;
            seen.add(userId);
            result.push({ userId: user.id, name: user.name, isCreator: false, isReviewer: reviewerIds.has(user.id) });
        }
        if (result.length === 0 && task.assignedTo.length === 0) return null;
        return result.length > 0 ? result : null;
    }, [creatorUser, task.assignedTo, task.reviewers, users]);

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
            if (window.electronAPI?.openFolder) window.electronAPI.openFolder(projectDir);
        } else {
            onSetProjectDirectory();
        }
    };

    const handleCopyFolderPath = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (projectDir) {
            navigator.clipboard.writeText(projectDir);
        }
    };

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation();
        updateTask(task.id, { favorite: !task.favorite });
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
                    dragEvent.preventDefault(); dragEvent.stopPropagation(); setCardFileDropTarget(true); return;
                }
                cardRef.current && onDragOverTask?.(dragEvent, task.id, cardRef.current);
            }}
            onDrop={(e: any) => {
                const dragEvent = e as React.DragEvent;
                if (dragEvent.dataTransfer.files.length > 0) {
                    dragEvent.preventDefault(); dragEvent.stopPropagation(); setCardFileDropTarget(false);
                    const file = dragEvent.dataTransfer.files[0];
                    const path = getDroppedFilePath(file);
                    if (!path) return;
                    const formattedPath = formatPathForInsertion(path);
                    const currentNotes = task.notes || '';
                    const newNotes = currentNotes ? `${currentNotes}\n${formattedPath}` : formattedPath;
                    updateTask(task.id, { notes: newNotes });
                    return;
                }
                onDropOnTask?.(dragEvent, task.id);
            }}
            onDragLeave={() => { setCardFileDropTarget(false); onDragLeaveTask?.(); }}
            onClick={() => setIsSubtasksExpanded(v => !v)}
            onDoubleClick={(e) => {
                if (!isCompact || forcedMode) return;
                e.stopPropagation();
                const next: CardMode = 'full';
                setCardMode(next);
                saveCardMode(task.id, next);
                onCardModeChange?.(task.id, next);
            }}
            onContextMenu={(e) => onContextMenu(e, task)}
            className={`group relative mb-3 flex flex-col rounded-2xl border border-white/5 bg-[#161b2e] shadow-lg transition-all hover:border-white/20 ${urgencyGlowClass} ${isDueToday ? "pulse-glow" : isOverdue ? "ring-1 ring-rose-500/50" : ""} ${task.favorite ? "overflow-visible rainbow-border" : "overflow-hidden"} ${isDropTarget ? "ring-1 ring-blue-400/50" : ""} ${cardFileDropTarget ? "ring-2 ring-blue-400/70 border-blue-400/40 bg-blue-500/5" : ""} ${isHighlighted ? "animate-pulse" : ""}`}
            style={isHighlighted ? {
                boxShadow: '0 0 0 2px var(--color-primary), 0 0 28px var(--color-primary), 0 0 60px color-mix(in srgb, var(--color-primary) 40%, transparent)',
                borderColor: 'var(--color-primary)',
            } : undefined}
            title={cardFileDropTarget ? "Déposer pour ajouter le chemin à la note" : undefined}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
        >
            {/* Wrapper interne — always overflow-hidden + rounded pour clipper proprement le contenu même quand la carte est overflow-visible (rainbow-border) */}
            <div className="rounded-2xl overflow-hidden flex flex-col flex-1">

            {/* Urgency gradient overlay */}
            <div className={`absolute inset-0 pointer-events-none opacity-80 bg-gradient-to-br ${urgencyTone}`} />

            {/* Overlay nesting — zone bas-droite active */}
            {isNestTarget && (
                <div className="absolute inset-0 pointer-events-none z-20 rounded-2xl ring-2 ring-violet-400/80 bg-violet-500/10">
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-violet-500/30 border border-violet-400/50 px-2 py-0.5">
                        <span className="text-[9px] font-bold text-violet-200 tracking-wide">IMBRIQUER</span>
                    </div>
                </div>
            )}

            {/* Bande urgence C1 — masquée en mode compact */}
            {!isCompact && (
                <div className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 ${urgencyBand.bg} ${urgencyBand.border}`}>
                    {/* ● Dot priorité */}
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-white/15 ${
                        task.priority === 'high' ? 'bg-rose-500' :
                        task.priority === 'med'  ? 'bg-amber-400' : 'bg-emerald-400'
                    }`} title={`Priorité ${task.priority === 'high' ? 'HAUTE' : task.priority === 'med' ? 'MOY.' : 'BASSE'}`} />
                    {showStagnationAlert && (
                        <span title={`Aucun mouvement depuis ${daysInColumn} jours`}>
                            <AlertTriangle className="h-3 w-3 text-orange-400 shrink-0" />
                        </span>
                    )}
                    <span className={`text-[9px] font-bold tracking-widest uppercase ${urgencyBand.text}`}>
                        {urgencyBand.label}
                    </span>
                    {task.due && (() => {
                        const d = new Date(task.due!);
                        const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                        const day = utc.getUTCDay() || 7;
                        utc.setUTCDate(utc.getUTCDate() + 4 - day);
                        const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
                        const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
                        return (
                            <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums bg-black/30 border border-white/10 cursor-pointer hover:bg-black/50 transition ${urgencyBand.text}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (dueDateTooltip) { setDueDateTooltip(null); return; }
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    setDueDateTooltip({ x: rect.left, y: rect.bottom + 6 });
                                }}
                            >
                                {`${task.due!.slice(8, 10)}/${task.due!.slice(5, 7)}/${task.due!.slice(2, 4)} - S${week}`}
                            </span>
                        );
                    })()}
                    {dueDateTooltip && task.due && createPortal(
                        <>
                            <div className="fixed inset-0 z-[99998]" onClick={(e) => { e.stopPropagation(); setDueDateTooltip(null); }} />
                            <div
                                style={{ top: dueDateTooltip.y, left: dueDateTooltip.x }}
                                className="fixed z-[99999] w-[280px] rounded-2xl border border-white/20 bg-[#161b2e] p-3 text-slate-100 shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <CalendarContent
                                    value={task.due}
                                    onSelect={(iso) => { updateTask(task.id, { due: iso }); setDueDateTooltip(null); }}
                                    onClose={() => setDueDateTooltip(null)}
                                    showCloseButton
                                    selectedClassName={calendarSelectedClass}
                                />
                            </div>
                        </>,
                        document.body
                    )}
                    {task.status === 'review' && task.movedToReviewAt && (() => {
                        const d = new Date(task.movedToReviewAt);
                        const dd = String(d.getDate()).padStart(2, '0');
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const hh = String(d.getHours()).padStart(2, '0');
                        const mn = String(d.getMinutes()).padStart(2, '0');
                        return <span className="text-[9px] text-violet-400 shrink-0 tabular-nums">· révision {dd}/{mm} {hh}:{mn}</span>;
                    })()}
                    <span className="flex-1" />
                    {task.notes && (
                        <span title="Note attachée"><FileText className="h-3 w-3 text-amber-500/70 shrink-0" /></span>
                    )}
                    {totalSubtasks > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] text-slate-400 tabular-nums">
                            <ClipboardList className="h-3 w-3" />{completedSubtasks}/{totalSubtasks}
                        </span>
                    )}
                    {/* Badges utilisateurs dans la bande */}
                    <div className="flex items-center gap-0.5">
                        {unifiedUserBadges === null ? (
                            <button
                                ref={userButtonRef}
                                onClick={(e) => { e.stopPropagation(); onContextMenu(e, task); }}
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-500/30 bg-slate-500/10 text-slate-400 transition hover:bg-slate-500/20"
                                title="Non assignée — cliquer pour assigner"
                            >
                                <User className="h-3 w-3" />
                            </button>
                        ) : (
                            unifiedUserBadges.map((badge, idx) => (
                                <button
                                    key={badge.userId}
                                    ref={idx === 0 ? userButtonRef : undefined}
                                    onClick={(e) => { e.stopPropagation(); onContextMenu(e, task); }}
                                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold transition hover:scale-110 ${
                                        badge.isCreator
                                            ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-200"
                                            : "border-blue-300/40 bg-blue-300/15 text-blue-200"
                                    } ${badge.isReviewer ? "ring-1 ring-violet-400" : ""}`}
                                    title={`${badge.name}${badge.isCreator ? " (créateur)" : ""}${badge.isReviewer ? " (réviseur)" : ""}`}
                                >
                                    {getInitials(badge.name)}
                                </button>
                            ))
                        )}
                    </div>
                    {commentCount > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsSubtasksExpanded(true); }}
                            className={`flex items-center gap-0.5 rounded p-0.5 text-[9px] font-bold transition ${hasMention ? "text-amber-400 animate-pulse" : "text-slate-500 hover:text-white"}`}
                            title={hasMention ? `Vous êtes mentionné(e) — ${commentCount} commentaire(s)` : `${commentCount} commentaire(s)`}
                        >
                            <MessageCircle className="h-3 w-3" />{commentCount}
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); handleToggleFavorite(e); }}
                        className={`rounded p-0.5 transition ${task.favorite ? "text-amber-400" : "text-slate-600 hover:text-amber-400"}`}
                        title={task.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                    >
                        <Star className="h-3.5 w-3.5" fill={task.favorite ? "currentColor" : "none"} />
                    </button>
                    {task.project && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleOpenFolder(e); }}
                            onContextMenu={projectDir ? handleCopyFolderPath : undefined}
                            className={`rounded p-0.5 transition ${projectDir ? "text-indigo-400" : "text-slate-600 hover:text-slate-300"}`}
                            title={projectDir ? `Ouvrir : ${projectDir} (clic droit : copier)` : "Configurer le dossier projet"}
                        >
                            <FolderOpen className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onContextMenu(e, task); }}
                        className="rounded p-0.5 text-slate-500 transition hover:text-white"
                    >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* Corps */}
            <div className="relative z-10 flex flex-col gap-3 p-3">

            {/* Badge : tâche issue d'une sous-tâche */}
            {task.convertedFromSubtask && (
                <>
                <button
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => {
                        e.preventDefault(); e.stopPropagation();
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
                                const result = convertSubtaskBack(task.id);
                                setSubtaskOriginMenu(null);
                                if (result === 'parent_not_found') {
                                    alertModal(`La tâche parente "${task.convertedFromSubtask!.parentTaskTitle}" a été supprimée. Impossible de reconvertir en sous-tâche.`);
                                } else if (result === 'parent_deleted') {
                                    alertModal(`Reconverti en sous-tâche. Note : la tâche parente "${task.convertedFromSubtask!.parentTaskTitle}" est archivée.`);
                                }
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

            {/* Badge : tâche liée à une parente */}
            {task.parentTaskId && (() => {
                const parent = tasks.find(t => t.id === task.parentTaskId);
                if (!parent) return null;
                return (
                    <>
                    <button
                        onClick={(e) => e.stopPropagation()}
                        onContextMenu={(e) => {
                            e.preventDefault(); e.stopPropagation();
                            setParentTaskMenu({ x: e.clientX, y: e.clientY });
                        }}
                        className="flex items-center gap-1.5 self-start rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 hover:bg-indigo-400/20 transition cursor-context-menu"
                        title={`Tâche parente : ${parent.title}\nClic droit pour délier`}
                    >
                        <Link2Off className="h-3 w-3" />
                        Tâche de : {parent.title}
                    </button>
                    {parentTaskMenu && createPortal(
                        <div
                            style={{ top: Math.min(parentTaskMenu.y, window.innerHeight - 60), left: Math.min(parentTaskMenu.x, window.innerWidth - 200) }}
                            className="fixed z-[99999] min-w-[170px] rounded-lg border border-white/10 bg-slate-800 py-1 shadow-xl"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={(e) => { e.stopPropagation(); setTaskParent(task.id, null); setParentTaskMenu(null); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                            >
                                <Link2Off className="h-4 w-4 text-rose-400" />
                                Délier du parent
                            </button>
                        </div>,
                        document.body
                    )}
                    {parentTaskMenu && createPortal(
                        <div className="fixed inset-0 z-[99998]" onMouseDown={() => setParentTaskMenu(null)} />,
                        document.body
                    )}
                    </>
                );
            })()}

            {/* Header : toggle + titre + badge priorité | badges utilisateurs / MoreHorizontal */}
            <div className={`flex ${isCompact ? "items-center" : "items-start"} justify-between gap-2`}>
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {/* Toggle mode : full ↔ compact (masqué quand le mode est imposé par le parent) */}
                    {!forcedMode && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setCardMode(prev => {
                                    const next: CardMode = prev === 'full' ? 'compact' : 'full';
                                    saveCardMode(task.id, next);
                                    onCardModeChange?.(task.id, next);
                                    return next;
                                });
                            }}
                            className="shrink-0 rounded p-0.5 text-slate-300 transition hover:text-white"
                            title={isCompact ? 'Afficher le détail' : 'Réduire la carte'}
                        >
                            {isCompact ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                    )}
                    <h4 className={`font-bold text-white leading-snug uppercase ${isCompact ? "text-sm line-clamp-1" : "text-base line-clamp-2"}`}>
                        {task.title}
                    </h4>
                </div>

                {/* Mode compact : chips à droite + MoreHorizontal */}
                {isCompact && (
                    <div className="shrink-0 flex items-center gap-1.5">
                        {task.due && task.status !== "done" && (() => {
                            const d = new Date(task.due!);
                            const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                            const day = utc.getUTCDay() || 7;
                            utc.setUTCDate(utc.getUTCDate() + 4 - day);
                            const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
                            const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
                            return (
                                <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums bg-black/30 border border-white/10 cursor-pointer hover:bg-black/50 transition ${urgencyBand.text}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (dueDateTooltip) { setDueDateTooltip(null); return; }
                                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                        setDueDateTooltip({ x: rect.left, y: rect.bottom + 6 });
                                    }}
                                >
                                    {`${task.due!.slice(8, 10)}/${task.due!.slice(5, 7)}/${task.due!.slice(2, 4)} - S${week}`}
                                </span>
                            );
                        })()}
                        {task.status === "done" && (
                            <span className="text-[10px] font-bold tabular-nums text-emerald-400">
                                {completionDateLabel ?? "✓"}
                            </span>
                        )}
                        {remainingDays !== null && task.status !== "done" && (
                            <span className={`text-[10px] font-bold tabular-nums ${
                                remainingDays < 0 ? "text-rose-400" :
                                remainingDays < 3 ? "text-rose-400" :
                                remainingDays <= 7 ? "text-amber-400" : "text-emerald-400"
                            }`}>
                                {remainingDays < 0 ? `J+${Math.abs(remainingDays)}` : `J-${remainingDays}`}
                            </span>
                        )}
                        <PriorityBadge priority={task.priority} />
                        {showStagnationAlert && <AlertTriangle className="h-3 w-3 text-orange-400" />}
                        {task.notes && <FileText className="h-3 w-3 text-amber-500/70" />}
                        {totalSubtasks > 0 && (
                            <span className="text-[10px] text-slate-500 tabular-nums">{completedSubtasks}/{totalSubtasks}</span>
                        )}
                        {task.status === 'review' && task.movedToReviewAt && (() => {
                            const d = new Date(task.movedToReviewAt);
                            const dd = String(d.getDate()).padStart(2, '0');
                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                            const hh = String(d.getHours()).padStart(2, '0');
                            const mn = String(d.getMinutes()).padStart(2, '0');
                            return <span className="text-[9px] text-violet-400 shrink-0 tabular-nums">↑{dd}/{mm} {hh}:{mn}</span>;
                        })()}
                        <TaskCardActions
                            task={task}
                            isCompact={true}
                            unifiedUserBadges={unifiedUserBadges}
                            commentCount={commentCount}
                            hasMention={hasMention}
                            projectDir={projectDir}
                            onContextMenu={onContextMenu}
                            onToggleFavorite={handleToggleFavorite}
                            onOpenFolder={handleOpenFolder}
                            onCopyFolderPath={handleCopyFolderPath}
                            onExpandSubtasks={() => setIsSubtasksExpanded(true)}
                            userButtonRef={userButtonRef}
                        />
                    </div>
                )}

            </div>

            {/* Barre de progression sous-tâches — mode compact uniquement */}
            {isCompact && totalSubtasks > 0 && (
                <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/5 mt-1">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${
                            progressPercentage === 100 ? "bg-gradient-to-r from-emerald-500 to-teal-400" :
                            progressPercentage < 30    ? "bg-rose-500" :
                                                         "bg-gradient-to-r from-indigo-500 to-purple-500"
                        }`}
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
            )}

            {/* Contenu détaillé — masqué en mode compact */}
            <AnimatePresence initial={false}>
            {!isCompact && (
            <motion.div
                key="full-content"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
            >
                <div className="flex flex-col gap-3 px-2 pb-2">
                {task.status === "done" && completionDateLabel && (
                    <span className="text-[10px] font-bold text-emerald-400">Fait le : {completionDateLabel}</span>
                )}

                {/* Badge note — vue normale uniquement */}
                {task.notes && !isSubtasksExpanded && (
                    <span className="flex items-center justify-center gap-1.5 w-full rounded py-0.5 bg-amber-400/15 text-amber-400" title="Cette tâche contient une note">
                        <FileText className="h-3 w-3" />
                        <span className="text-[10px] font-semibold leading-none">note</span>
                    </span>
                )}

                {/* Encart notes — vue étendue, sous le titre */}
                {isSubtasksExpanded && (
                    <div data-nodrag onClick={e => e.stopPropagation()}>
                        <TaskNotesSection task={task} updateTask={updateTask} />
                    </div>
                )}

                <TaskSubtasksFooter
                    task={task}
                    totalSubtasks={totalSubtasks}
                    completedSubtasks={completedSubtasks}
                    progressPercentage={progressPercentage}
                    isSubtasksExpanded={isSubtasksExpanded}
                    onToggleExpanded={() => setIsSubtasksExpanded(v => !v)}
                />

                {/* SubtaskList fusionnée avec TaskSubtasksFooter en vue étendue */}
                {isSubtasksExpanded && (
                    <div data-nodrag onClick={e => e.stopPropagation()}>
                        <SubtaskList task={task} hideHeader />
                    </div>
                )}

                <TaskReviewSection
                    task={task}
                    reviewerUsers={reviewerUsers}
                    currentUser={currentUser}
                    validateTask={validateTask}
                    requestCorrections={requestCorrections}
                />

                {/* Contenu étendu : tâches liées + commentaires */}
                {isSubtasksExpanded && (
                    <div data-nodrag onClick={e => e.stopPropagation()} className="mt-2 pt-2 border-t border-white/5 space-y-3">
                        <ChildTaskTree
                            parentTask={task}
                            allTasks={tasks}
                            onOpenTask={_onClick}
                        />
                        <div className="pt-2 border-t border-white/5">
                            <TaskComments taskId={task.id} />
                        </div>
                    </div>
                )}
                </div>{/* fin flex flex-col gap-3 */}
            </motion.div>
            )}
            </AnimatePresence>
            </div>{/* fin corps */}
            </div>{/* fin wrapper interne overflow-hidden */}
        </motion.div>
            {showLineAfter && <div className="absolute -bottom-1.5 left-0 right-0 h-0.5 rounded-full bg-blue-400 z-20 pointer-events-none" />}
        </div>
    );
}
