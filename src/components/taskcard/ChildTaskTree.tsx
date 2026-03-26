import { ClipboardList, Loader2, SearchCheck, CheckCircle2, Link2Off } from "lucide-react";
import type { Task } from "../../types";
import { businessDayDelta } from "../../utils";
import { PriorityBadge } from "./PriorityBadge";
import useStore from "../../store/useStore";

interface ChildTaskTreeProps {
    parentTask: Task;
    allTasks: Task[];
    /** Ouvre le panneau d'édition d'une tâche */
    onOpenTask: (task: Task, x: number, y: number) => void;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
    todo:   <ClipboardList className="h-3 w-3 text-slate-400" />,
    doing:  <Loader2 className="h-3 w-3 text-blue-400" />,
    review: <SearchCheck className="h-3 w-3 text-violet-400" />,
    done:   <CheckCircle2 className="h-3 w-3 text-emerald-400" />,
};

/** Arborescence des tâches enfantes d'une tâche parente */
export function ChildTaskTree({ parentTask, allTasks, onOpenTask }: ChildTaskTreeProps) {
    const { setTaskParent } = useStore();

    const children = allTasks
        .filter(t => t.parentTaskId === parentTask.id && !t.archived && !t.deletedAt)
        .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));

    if (children.length === 0) return null;

    return (
        <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
            <div className="flex items-center gap-1.5 mb-1.5">
                <Link2Off className="h-3 w-3 text-indigo-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                    Tâches liées ({children.length})
                </span>
            </div>
            {children.map(child => {
                const remaining = child.due ? businessDayDelta(child.due) : null;
                const deadlineColor =
                    remaining === null ? "text-slate-500" :
                    remaining < 0     ? "text-rose-400" :
                    remaining < 3     ? "text-rose-400" :
                    remaining <= 7    ? "text-amber-400" : "text-emerald-400";
                const deadlineLabel =
                    remaining === null ? null :
                    remaining < 0     ? `J+${Math.abs(remaining)}` :
                    remaining === 0   ? "Aujourd'hui" : `J-${remaining}`;

                return (
                    <div
                        key={child.id}
                        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 hover:bg-white/10 transition cursor-pointer group"
                        onClick={(e) => { e.stopPropagation(); onOpenTask(child, e.clientX, e.clientY); }}
                        title={`Ouvrir : ${child.title}`}
                    >
                        <span className="shrink-0">{STATUS_ICONS[child.status] ?? STATUS_ICONS.todo}</span>
                        <span className={`flex-1 text-xs font-medium truncate ${child.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                            {child.title}
                        </span>
                        <PriorityBadge priority={child.priority} />
                        {deadlineLabel && (
                            <span className={`shrink-0 text-[10px] font-bold tabular-nums ${deadlineColor}`}>
                                {deadlineLabel}
                            </span>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); setTaskParent(child.id, null); }}
                            className="shrink-0 opacity-0 group-hover:opacity-100 rounded p-0.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition"
                            title="Délier de cette tâche"
                        >
                            <Link2Off className="h-3 w-3" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
