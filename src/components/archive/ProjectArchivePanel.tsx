import { useMemo } from "react";
import useStore from "../../store/useStore";
import type { Task } from "../../types";
import { Modal } from "../ui/Modal";
import { confirmModal } from "../../utils/confirm";

interface ProjectArchivePanelProps {
    onClose: () => void;
}

export function ProjectArchivePanel({ onClose }: ProjectArchivePanelProps) {
    const { tasks, unarchiveProject, deleteArchivedProject } = useStore();

    // Calculer les projets archivés (dérivé du state global)
    const archivedProjects = useMemo(() => {
        const stats: Record<string, { total: number; done: number; completedAt: number | null; archivedAt: number | null; project: string }> = {};
        tasks.forEach((task: Task) => {
            if (task.archived && !task.deletedAt && task.project) {
                if (!stats[task.project]) {
                    stats[task.project] = { total: 0, done: 0, completedAt: null, archivedAt: null, project: task.project };
                }
                stats[task.project].total++;
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
        <Modal isOpen={true} onClose={onClose} title="Archives" width="max-w-3xl">
            <p className="mt-2 text-sm text-slate-400">
                Projets archivés. Vous pouvez les désarchiver pour les remettre actifs ou les supprimer définitivement.
            </p>
            <div className="mt-4 max-h-[60vh] space-y-3 overflow-auto pr-1">
                {archivedProjects.length === 0 && (
                    <div className="text-sm text-slate-400">
                        Aucun projet archivé.
                    </div>
                )}
                {archivedProjects.map((p) => (
                    <div
                        key={p.project}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="font-semibold text-slate-100">{p.project}</span>
                                <span className="ml-3 text-sm text-slate-400">
                                    {p.done}/{p.total} ({p.pct}%)
                                </span>
                                {p.archivedAt && (
                                    <span className="ml-3 text-xs text-slate-500">
                                        Archivé le {new Date(p.archivedAt).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => unarchiveProject(p.project)}
                                    className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-100 transition hover:bg-cyan-400/20"
                                >
                                    Désarchiver
                                </button>
                                <button
                                    onClick={async () => {
                                        if (await confirmModal(`Supprimer d?finitivement le projet "${p.project}" et toutes ses t?ches ?`)) {
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
                    </div>
                ))}
            </div>
        </Modal>
    );
}
