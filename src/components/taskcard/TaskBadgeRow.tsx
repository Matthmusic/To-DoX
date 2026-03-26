import { AlertTriangle } from "lucide-react";
import type { Task } from "../../types";
import type { ProjectColor } from "../../constants";

interface TaskBadgeRowProps {
    task: Task;
    projectColor: ProjectColor;
    showStagnationAlert: boolean;
    daysInColumn: number;
    remainingDays: number | null;
    completionDateLabel: string | null;
}

/** Ligne de badges : priorité, indicateur de stagnation, date d'échéance / complétion */
export function TaskBadgeRow({
    task,
    projectColor: _projectColor,
    showStagnationAlert,
    daysInColumn,
    remainingDays,
    completionDateLabel,
}: TaskBadgeRowProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="ml-auto flex items-center gap-2">
                {showStagnationAlert && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-orange-400" title={`Aucun mouvement depuis ${daysInColumn} jours`}>
                        <AlertTriangle className="h-3 w-3" />
                    </span>
                )}

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
    );
}
