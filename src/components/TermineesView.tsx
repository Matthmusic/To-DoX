import { useMemo } from 'react';
import { CheckCircle2, RotateCcw, Archive } from 'lucide-react';
import useStore from '../store/useStore';
import type { Task } from '../types';

interface TermineesViewProps {
    onTaskClick: (task: Task, x: number, y: number) => void;
}

export function TermineesView({ onTaskClick }: TermineesViewProps) {
    const { tasks, users, archiveTask, reopenTask } = useStore();

    const doneTasks = useMemo(() => {
        return tasks
            .filter(t => t.status === 'done' && !t.archived && !t.deletedAt)
            .sort((a, b) => (b.completedAt || b.updatedAt) - (a.completedAt || a.updatedAt));
    }, [tasks]);

    const grouped = useMemo(() => {
        const map = new Map<string, Task[]>();
        for (const t of doneTasks) {
            const project = t.project || 'Sans projet';
            if (!map.has(project)) map.set(project, []);
            map.get(project)!.push(t);
        }
        return map;
    }, [doneTasks]);

    const getUserName = (id: string) => users.find(u => u.id === id)?.name ?? id;

    if (doneTasks.length === 0) {
        return (
            <main className="flex-1 flex flex-col items-center justify-center text-slate-500">
                <CheckCircle2 className="h-16 w-16 opacity-20 mb-4" />
                <p className="text-lg font-semibold">Aucune tâche terminée</p>
                <p className="text-sm mt-1">Les tâches validées apparaîtront ici</p>
            </main>
        );
    }

    return (
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 bg-transparent">
            <div className="max-w-4xl mx-auto space-y-6">
                {[...grouped.entries()].map(([project, projectTasks]) => (
                    <div
                        key={project}
                        className="rounded-2xl border border-theme-primary bg-theme-secondary shadow-[0_8px_30px_rgba(2,6,23,0.25)] backdrop-blur-xl overflow-hidden"
                    >
                        {/* Header projet */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-theme-primary bg-white/[0.02]">
                            <span className="font-bold text-theme-primary text-sm">{project}</span>
                            <span className="text-xs text-theme-secondary bg-white/5 border border-theme-primary rounded-full px-2 py-0.5">
                                {projectTasks.length}
                            </span>
                        </div>

                        {/* Tâches */}
                        <div className="divide-y divide-white/5">
                            {projectTasks.map(task => (
                                <div
                                    key={task.id}
                                    className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group"
                                >
                                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-400" />
                                    <div
                                        className="flex-1 min-w-0 cursor-pointer"
                                        onClick={(e) => onTaskClick(task, e.clientX, e.clientY)}
                                    >
                                        <p className="text-sm font-medium text-theme-primary line-clamp-2 sm:truncate group-hover:text-theme-accent transition-colors">
                                            {task.title}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-3 mt-1">
                                            {task.reviewValidatedBy ? (
                                                <span className="text-xs text-emerald-400/80">
                                                    Validé par {getUserName(task.reviewValidatedBy)}
                                                    {task.reviewValidatedAt && ` · ${new Date(task.reviewValidatedAt).toLocaleDateString('fr-FR')}`}
                                                </span>
                                            ) : task.completedAt ? (
                                                <span className="text-xs text-slate-500">
                                                    Terminé le {new Date(task.completedAt).toLocaleDateString('fr-FR')}
                                                </span>
                                            ) : null}
                                            {task.assignedTo.length > 0 && (
                                                <span className="text-xs text-slate-500">
                                                    {task.assignedTo.map(id => getUserName(id)).join(', ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 sm:gap-1.5 shrink-0">
                                        <button
                                            onClick={() => reopenTask(task.id)}
                                            className="flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-400/20"
                                            title="Rouvrir (passe en En cours)"
                                        >
                                            <RotateCcw className="h-3 w-3" />
                                            Rouvrir
                                        </button>
                                        <button
                                            onClick={() => archiveTask(task.id)}
                                            className="flex items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-2 py-1 text-[10px] font-semibold text-emerald-400/60 transition hover:bg-emerald-400/15"
                                            title="Archiver cette tâche"
                                        >
                                            <Archive className="h-3 w-3" />
                                            Archiver
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}
