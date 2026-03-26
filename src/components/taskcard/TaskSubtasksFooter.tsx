import { ClipboardList, ChevronDown, ChevronRight, CheckSquare } from "lucide-react";
import type { Task } from "../../types";
import useStore from "../../store/useStore";
import { getInitials } from "../../utils";
import { LinkedTextContent } from "../LinkedTextContent";

interface TaskSubtasksFooterProps {
    task: Task;
    totalSubtasks: number;
    completedSubtasks: number;
    progressPercentage: number;
    isSubtasksExpanded: boolean;
    onToggleExpanded: () => void;
}

export function TaskSubtasksFooter({
    task,
    totalSubtasks,
    completedSubtasks,
    progressPercentage,
    isSubtasksExpanded,
    onToggleExpanded,
}: TaskSubtasksFooterProps) {
    const { toggleSubtask, users, currentUser } = useStore();
    const subtasks = task.subtasks || [];

    const progressColor =
        progressPercentage === 100 ? "bg-gradient-to-r from-emerald-500 to-teal-400" :
        progressPercentage < 30    ? "bg-rose-500" :
                                     "bg-gradient-to-r from-indigo-500 to-purple-500";
    const progressTextColor =
        progressPercentage === 100 ? "text-emerald-400" :
        progressPercentage < 30    ? "text-rose-400" : "text-indigo-400";

    // ── Vue étendue : header unifié (titre + compteur + progress inline + collapse) ──
    if (isSubtasksExpanded && totalSubtasks > 0) {
        return (
            <button
                onClick={(e) => { e.stopPropagation(); onToggleExpanded(); }}
                className="w-full flex items-center gap-2 group mb-1"
            >
                <CheckSquare className={`h-4 w-4 shrink-0 ${progressPercentage === 100 ? "text-emerald-400" : "text-blue-400"}`} />
                <span className={`text-sm font-semibold ${progressPercentage === 100 ? "text-emerald-400" : "text-slate-300"}`}>
                    Sous-tâches
                </span>
                <span className={`text-xs tabular-nums ${progressTextColor}`}>
                    {completedSubtasks}/{totalSubtasks}
                </span>
                <div className="flex-1 h-1 overflow-hidden rounded-full bg-white/5">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
                <span className={`text-[10px] font-bold tabular-nums ${progressTextColor}`}>
                    {progressPercentage}%
                </span>
                <ChevronDown className="h-3 w-3 text-slate-500 group-hover:text-slate-300 transition" />
            </button>
        );
    }

    // ── Vue compacte : header résumé + liste inline des sous-tâches ──
    return (
        <div>
            {totalSubtasks > 0 && (
                <>
                    {/* Header compact : compteur + barre de progression + expand */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleExpanded(); }}
                        className="flex items-center gap-2 w-full mb-1.5 group"
                    >
                        <div className={`flex items-center gap-1.5 ${progressPercentage === 100 ? "text-emerald-400" : "text-slate-400"}`}>
                            <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-xs font-medium">{completedSubtasks}/{totalSubtasks}</span>
                        </div>
                        <div className="flex-1 h-1 overflow-hidden rounded-full bg-white/5">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                        <span className={`text-[10px] font-bold tabular-nums ${progressTextColor}`}>
                            {progressPercentage}%
                        </span>
                        <ChevronRight className="h-3 w-3 text-slate-500 group-hover:text-slate-300 transition shrink-0" />
                    </button>

                    {/* Liste compacte des sous-tâches */}
                    <div className="flex flex-col gap-0.5 mb-1" data-nodrag onClick={e => e.stopPropagation()}>
                        {subtasks.map(st => (
                            <div
                                key={st.id}
                                onClick={(e) => { e.stopPropagation(); toggleSubtask(task.id, st.id); }}
                                className="flex items-center gap-1.5 text-left w-full rounded px-1 py-0.5 hover:bg-white/5 transition group cursor-pointer"
                            >
                                <span className={`shrink-0 h-3.5 w-3.5 rounded border flex items-center justify-center transition ${
                                    st.completed
                                        ? "bg-emerald-500/30 border-emerald-500/60"
                                        : "border-white/20 group-hover:border-white/40"
                                }`}>
                                    {st.completed && (
                                        <svg className="h-2.5 w-2.5 text-emerald-400" viewBox="0 0 10 10" fill="none">
                                            <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </span>
                                <span className={`text-[11px] truncate leading-none flex-1 ${st.completed ? "line-through text-slate-500" : "text-slate-300"}`}>
                                    <LinkedTextContent
                                        text={st.title}
                                        textClassName={st.completed ? "text-slate-500 line-through" : "text-slate-300"}
                                    />
                                </span>
                                {(st.assignedTo || []).map(uid => {
                                    const assignee = users.find(u => u.id === uid);
                                    if (!assignee) return null;
                                    const isMe = uid === currentUser;
                                    return (
                                        <span key={uid} className="relative shrink-0 inline-flex items-center" title={`Affecté à ${assignee.name}`}>
                                            {!st.completed && isMe && <span className="absolute inset-0 rounded-full bg-blue-400/40 animate-ping" />}
                                            <span className="relative rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                                                {getInitials(assignee.name)}
                                            </span>
                                        </span>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {totalSubtasks === 0 && (
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleExpanded(); }}
                    className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-indigo-400 transition mb-2"
                >
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span className="font-medium">+ Ajouter des sous-tâches</span>
                </button>
            )}
        </div>
    );
}
