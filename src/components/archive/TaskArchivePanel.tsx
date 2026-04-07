import { useEffect, useMemo, useState } from "react";
import { IS_API_MODE } from "../../api/client";
import { apiGetArchivedTasks } from "../../api/tasks";
import useStore from "../../store/useStore";
import type { Task } from "../../types";
import { classNames } from "../../utils";
import { confirmModal } from "../../utils/confirm";
import { GlassModal } from "../ui/GlassModal";

interface TaskArchivePanelProps {
    onClose: () => void;
}

export function TaskArchivePanel({ onClose }: TaskArchivePanelProps) {
    const { tasks, setTasks, unarchiveTask, removeTask } = useStore();
    const [isLoading, setIsLoading] = useState(IS_API_MODE);

    // En mode API : charger les tâches archivées à la demande (pas au démarrage)
    useEffect(() => {
        if (!IS_API_MODE) return;
        setIsLoading(true);
        apiGetArchivedTasks()
            .then(archived => {
                setTasks([
                    ...useStore.getState().tasks.filter(t => !t.archived),
                    ...archived,
                ]);
            })
            .catch(() => { /* silencieux, le store garde ce qu'il a */ })
            .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const archivedTasks = useMemo(() => {
        return tasks.filter((t: Task) => t.archived && !t.deletedAt).sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
    }, [tasks]);

    return (
        <GlassModal isOpen={true} onClose={onClose} title="Archives des tâches" size="xl">
            <p className="mt-2 text-sm text-slate-400">
                Tâches archivées. Vous pouvez les désarchiver pour les remettre actives ou les supprimer définitivement.
            </p>
            <div className="mt-4 max-h-[70vh] space-y-3 overflow-auto pr-1">
                {isLoading && (
                    <div className="text-sm text-slate-400">Chargement des archives…</div>
                )}
                {!isLoading && archivedTasks.length === 0 && (
                    <div className="text-sm text-slate-400">
                        Aucune tâche archivée.
                    </div>
                )}
                {archivedTasks.map((task) => (
                    <div
                        key={task.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <h4 className="font-semibold text-slate-100">{task.title}</h4>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                                        {task.project}
                                    </span>
                                    {task.priority && (
                                        <span className={classNames(
                                            "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide shadow-inner",
                                            task.priority === "high" ? "bg-gradient-to-r from-rose-500 to-orange-400 text-slate-900" :
                                                task.priority === "med" ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-900" :
                                                    "bg-gradient-to-r from-emerald-400 to-lime-300 text-slate-900"
                                        )}>
                                            {task.priority === "high" ? "Haute" : task.priority === "med" ? "Moyenne" : "Basse"}
                                        </span>
                                    )}
                                    {task.archivedAt && (
                                        <span className="text-xs text-slate-500">
                                            Archivé le {new Date(task.archivedAt).toLocaleDateString()}
                                        </span>
                                    )}
                                    {task.completedAt && (
                                        <span className="text-xs text-emerald-400">
                                            Terminé le {new Date(task.completedAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                                {task.notes && (
                                    <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{task.notes}</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => unarchiveTask(task.id)}
                                    className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-100 transition hover:bg-cyan-400/20"
                                >
                                    Désarchiver
                                </button>
                                <button
                                    onClick={async () => {
                                        if (await confirmModal(`Supprimer définitivement la tâche "${task.title}" ?`)) {
                                            removeTask(task.id);
                                        }
                                    }}
                                    className="rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-1 text-sm text-rose-100 transition hover:bg-rose-400/20"
                                >
                                    Supprimer
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </GlassModal>
    );
}
