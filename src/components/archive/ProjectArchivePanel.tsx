import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import useStore from "../../store/useStore";
import type { Task } from "../../types";
import { GlassModal } from "../ui/GlassModal";
import { confirmModal } from "../../utils/confirm";

interface ProjectArchivePanelProps {
    onClose: () => void;
}

export function ProjectArchivePanel({ onClose }: ProjectArchivePanelProps) {
    const { tasks, unarchiveProject, unarchiveTask, deleteArchivedProject } = useStore();
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

    function toggleExpand(project: string) {
        setExpandedProjects(prev => {
            const next = new Set(prev);
            if (next.has(project)) next.delete(project);
            else next.add(project);
            return next;
        });
    }

    // Calculer les projets archivés (dérivé du state global)
    const archivedProjects = useMemo(() => {
        const stats: Record<string, { total: number; done: number; completedAt: number | null; archivedAt: number | null; project: string; taskList: Task[] }> = {};
        tasks.forEach((task: Task) => {
            if (task.archived && !task.deletedAt && task.project) {
                if (!stats[task.project]) {
                    stats[task.project] = { total: 0, done: 0, completedAt: null, archivedAt: null, project: task.project, taskList: [] };
                }
                stats[task.project].total++;
                stats[task.project].taskList.push(task);
                if (task.status === "done") stats[task.project].done++;
                if (!stats[task.project].archivedAt || (task.archivedAt && stats[task.project].archivedAt && task.archivedAt > stats[task.project].archivedAt!)) {
                    stats[task.project].archivedAt = task.archivedAt || null;
                }
            }
        });

        return Object.values(stats).map(s => ({
            ...s,
            pct: s.total > 0 ? Math.round((s.done / s.total) * 100) : 0
        })).sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
    }, [tasks]);

    return (
        <GlassModal isOpen={true} onClose={onClose} title="Archives" size="xl">
            <p className="mt-2 text-sm text-slate-400">
                Projets archivés. Vous pouvez les désarchiver pour les remettre actifs ou les supprimer définitivement.
            </p>
            <div className="mt-4 max-h-[60vh] space-y-3 overflow-auto pr-1">
                {archivedProjects.length === 0 && (
                    <div className="text-sm text-slate-400">
                        Aucun projet archivé.
                    </div>
                )}
                {archivedProjects.map((p) => {
                    const isExpanded = expandedProjects.has(p.project);
                    return (
                        <div
                            key={p.project}
                            className="rounded-2xl border border-white/10 bg-white/5 p-4"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                    <button
                                        onClick={() => toggleExpand(p.project)}
                                        className="shrink-0 text-slate-400 hover:text-slate-200 transition-colors"
                                        aria-label={isExpanded ? "Réduire" : "Développer"}
                                    >
                                        {isExpanded
                                            ? <ChevronDown className="w-4 h-4" />
                                            : <ChevronRight className="w-4 h-4" />
                                        }
                                    </button>
                                    <span className="font-semibold text-slate-100">{p.project}</span>
                                    <span className="text-sm text-slate-400">
                                        {p.done}/{p.total} ({p.pct}%)
                                    </span>
                                    {p.archivedAt && (
                                        <span className="text-xs text-slate-500 hidden sm:inline">
                                            Archivé le {new Date(p.archivedAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2 shrink-0 ml-2">
                                    <button
                                        onClick={() => unarchiveProject(p.project)}
                                        className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-100 transition hover:bg-cyan-400/20"
                                    >
                                        Désarchiver
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (await confirmModal(`Supprimer définitivement le projet "${p.project}" et toutes ses tâches ?`)) {
                                                deleteArchivedProject(p.project);
                                            }
                                        }}
                                        className="rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-1 text-sm text-rose-100 transition hover:bg-rose-400/20"
                                    >
                                        Supprimer
                                    </button>
                                </div>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-300 to-rose-400 transition-all"
                                    style={{ width: `${p.pct}%` }}
                                    aria-label={`${p.pct}%`}
                                />
                            </div>

                            {/* Liste des tâches (déroulable) */}
                            {isExpanded && (
                                <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
                                    {p.taskList.map((task) => (
                                        <div
                                            key={task.id}
                                            className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <span className={`text-sm ${task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                                                    {task.title}
                                                </span>
                                                {task.archivedAt && (
                                                    <span className="ml-2 text-xs text-slate-500">
                                                        {new Date(task.archivedAt).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => unarchiveTask(task.id)}
                                                className="shrink-0 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-200 transition hover:bg-cyan-400/20"
                                            >
                                                Désarchiver
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </GlassModal>
    );
}
