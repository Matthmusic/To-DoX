import React from "react";
import { Star, FolderOpen, MessageCircle, MoreHorizontal, User } from "lucide-react";
import { getInitials } from "../../utils";
import type { Task } from "../../types";

interface UnifiedBadge {
    userId: string;
    name: string;
    isCreator: boolean;
    isReviewer: boolean;
}

interface TaskCardActionsProps {
    task: Task;
    isCompact: boolean;
    unifiedUserBadges: UnifiedBadge[] | null;
    commentCount: number;
    hasMention: boolean;
    projectDir: string | null;
    onContextMenu: (e: React.MouseEvent, task: Task) => void;
    onToggleFavorite: (e: React.MouseEvent) => void;
    onOpenFolder: (e: React.MouseEvent) => void;
    onExpandSubtasks: () => void;
    userButtonRef: React.RefObject<HTMLButtonElement | null>;
}

/** Boutons d'action dans l'en-tête de la TaskCard : user badges, favoris, dossier, commentaires, ⋯ */
export function TaskCardActions({
    task,
    isCompact,
    unifiedUserBadges,
    commentCount,
    hasMention,
    projectDir,
    onContextMenu,
    onToggleFavorite,
    onOpenFolder,
    onExpandSubtasks,
    userButtonRef,
}: TaskCardActionsProps) {
    if (isCompact) {
        return (
            <button
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                onClick={(e) => { e.stopPropagation(); onContextMenu(e, task); }}
            >
                <MoreHorizontal className="h-4 w-4" />
            </button>
        );
    }

    return (
        <>
            {/* ── Pastilles utilisateurs (créateur + assignés, dédupliqués) ── */}
            {unifiedUserBadges === null ? (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onContextMenu(e, task); }}
                    className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-500/30 bg-slate-700/20 text-slate-400 transition-all hover:scale-110 hover:bg-slate-700/30 cursor-pointer"
                    title="Non assignée - Cliquer pour assigner"
                >
                    <User className="h-3.5 w-3.5" />
                </button>
            ) : (
                unifiedUserBadges.map((badge, idx) => (
                    <button
                        key={badge.userId}
                        type="button"
                        ref={idx === 0 ? userButtonRef : undefined}
                        onClick={(e) => { e.stopPropagation(); onContextMenu(e, task); }}
                        className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold transition-all hover:scale-110 cursor-pointer ${
                            badge.isCreator
                                ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-200 hover:bg-emerald-300/25"
                                : "border-blue-300/40 bg-blue-300/15 text-blue-200 hover:bg-blue-300/25"
                        } ${
                            badge.isReviewer
                                ? "ring-2 ring-violet-400"
                                : ""
                        }`}
                        title={`${badge.name}${badge.isCreator ? " (créateur)" : ""}${badge.isReviewer ? " (réviseur)" : ""} — Cliquer pour gérer`}
                    >
                        {getInitials(badge.name)}
                    </button>
                ))
            )}
            {/* ── Favoris — position fixe après les users ── */}
            <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(e); }}
                className={`rounded-lg p-1.5 transition ${task.favorite
                    ? "text-amber-400 hover:bg-amber-400/20"
                    : "text-slate-400 hover:bg-white/10 hover:text-amber-400"
                }`}
                title={task.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            >
                <Star className="h-4 w-4" fill={task.favorite ? "currentColor" : "none"} />
            </button>
            {/* ── Dossier — position fixe après les users ── */}
            {task.project && (
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenFolder(e); }}
                    className={`rounded-lg p-1.5 transition ${projectDir ? "text-indigo-400 hover:bg-indigo-400/20" : "text-slate-600 hover:text-slate-300"}`}
                    title={projectDir ? `Ouvrir : ${projectDir}` : "Configurer le dossier"}
                >
                    <FolderOpen className="h-4 w-4" />
                </button>
            )}
            {/* ── Commentaires ── */}
            {commentCount > 0 && (
                <button
                    onClick={(e) => { e.stopPropagation(); onExpandSubtasks(); }}
                    className={`flex items-center gap-0.5 rounded-lg p-1.5 transition hover:bg-white/10 ${hasMention ? "animate-pulse text-amber-400 hover:text-amber-300" : "text-slate-400 hover:text-white"}`}
                    title={hasMention ? `Vous êtes mentionné(e) — ${commentCount} commentaire(s)` : `${commentCount} commentaire(s)`}
                >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="text-[9px] font-bold">{commentCount}</span>
                </button>
            )}
            {/* ── Plus ── */}
            <button
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                onClick={(e) => { e.stopPropagation(); onContextMenu(e, task); }}
            >
                <MoreHorizontal className="h-4 w-4" />
            </button>
        </>
    );
}
