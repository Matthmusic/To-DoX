import { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, Archive, ChevronDown, ChevronRight } from 'lucide-react';
import useStore from '../store/useStore';
import { getProjectColor } from '../utils';
import type { Task } from '../types';

interface TermineesViewProps {
    onTaskClick: (task: Task, x: number, y: number) => void;
}

function groupByProject(tasks: Task[]): Map<string, Task[]> {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
        const project = t.project || 'Sans projet';
        if (!map.has(project)) map.set(project, []);
        map.get(project)!.push(t);
    }
    return map;
}

interface TaskSectionProps {
    grouped: Map<string, Task[]>;
    canAct: boolean;
    projectColors: Record<string, number>;
    getUserName: (id: string) => string;
    onTaskClick: (task: Task, x: number, y: number) => void;
    archiveTask: (id: string) => void;
    reopenTask: (id: string) => void;
}

const PRIORITY_STYLE = {
    high: { cls: 'bg-rose-500/20 text-rose-300 border-rose-500/30', label: 'Haute' },
    med:  { cls: 'bg-amber-400/20 text-amber-300 border-amber-400/30', label: 'Moyenne' },
    low:  { cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'Basse' },
};

function TaskSection({ grouped, canAct, projectColors, getUserName, onTaskClick, archiveTask, reopenTask }: TaskSectionProps) {
    const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
    const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

    const toggleProject = (project: string) =>
        setCollapsedProjects(c => ({ ...c, [project]: !(c[project] ?? false) }));
    const toggleTask = (taskId: string) =>
        setExpandedTasks(c => ({ ...c, [taskId]: !(c[taskId] ?? false) }));

    return (
        <div className="space-y-4">
            {[...grouped.entries()].map(([project, projectTasks]) => {
                const color = getProjectColor(project, projectColors);
                const isCollapsed = collapsedProjects[project] ?? false;
                return (
                <div
                    key={project}
                    className="rounded-2xl border border-theme-primary bg-theme-secondary shadow-[0_8px_30px_rgba(2,6,23,0.25)] backdrop-blur-xl overflow-hidden"
                >
                    <div
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition hover:brightness-110 ${isCollapsed ? '' : 'border-b border-theme-primary'} ${color.bg}`}
                        onClick={() => toggleProject(project)}
                    >
                        {isCollapsed
                            ? <ChevronRight className={`h-4 w-4 shrink-0 ${color.text}`} />
                            : <ChevronDown className={`h-4 w-4 shrink-0 ${color.text}`} />
                        }
                        <span className={`font-bold text-sm ${color.text}`}>{project}</span>
                        <span className={`text-xs rounded-full border px-2 py-0.5 ${color.bg} ${color.border} ${color.text}`}>
                            {projectTasks.length}
                        </span>
                    </div>
                    {!isCollapsed && (
                        <div className="divide-y divide-white/5">
                            {projectTasks.map(task => {
                                const isExpanded = expandedTasks[task.id] ?? false;
                                const prio = PRIORITY_STYLE[task.priority];
                                const completedSubtasks = task.subtasks.filter(s => s.completed).length;
                                return (
                                <div key={task.id} className="transition-colors">
                                    {/* Ligne principale — clic = toggle expand */}
                                    <div
                                        className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] cursor-pointer group"
                                        onClick={() => toggleTask(task.id)}
                                    >
                                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-400" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-theme-primary line-clamp-2 group-hover:text-theme-accent transition-colors">
                                                {task.title}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
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
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {canAct && (
                                                <>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); reopenTask(task.id); }}
                                                        className="flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-400/20"
                                                        title="Rouvrir"
                                                    >
                                                        <RotateCcw className="h-3 w-3" />
                                                        Rouvrir
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); archiveTask(task.id); }}
                                                        className="flex items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-2 py-1 text-[10px] font-semibold text-emerald-400/60 transition hover:bg-emerald-400/15"
                                                        title="Archiver"
                                                    >
                                                        <Archive className="h-3 w-3" />
                                                        Archiver
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onTaskClick(task, e.clientX, e.clientY); }}
                                                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
                                                title="Éditer"
                                            >
                                                Éditer
                                            </button>
                                            {isExpanded
                                                ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                                : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                                            }
                                        </div>
                                    </div>

                                    {/* Détails dépliés */}
                                    {isExpanded && (
                                        <div className="px-11 pb-4 space-y-3 bg-white/[0.015] border-t border-white/5">
                                            <div className="flex flex-wrap gap-2 pt-3">
                                                <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${prio.cls}`}>
                                                    {prio.label}
                                                </span>
                                                {task.due && (
                                                    <span className="text-[10px] text-slate-400 border border-slate-600/40 bg-slate-800/40 rounded-full px-2 py-0.5">
                                                        Échéance : {new Date(task.due).toLocaleDateString('fr-FR')}
                                                    </span>
                                                )}
                                                {(task.reviewers || []).length > 0 && (
                                                    <span className="text-[10px] text-violet-300 border border-violet-400/30 bg-violet-400/10 rounded-full px-2 py-0.5">
                                                        Réviseurs : {(task.reviewers || []).map(id => getUserName(id)).join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                            {task.notes && (
                                                <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
                                                    {task.notes}
                                                </p>
                                            )}
                                            {task.subtasks.length > 0 && (
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                                        Sous-tâches ({completedSubtasks}/{task.subtasks.length})
                                                    </p>
                                                    {task.subtasks.map(s => (
                                                        <div key={s.id} className="flex items-center gap-2 text-xs">
                                                            <CheckCircle2 className={`h-3 w-3 shrink-0 ${s.completed ? 'text-emerald-400' : 'text-slate-600'}`} />
                                                            <span className={s.completed ? 'line-through text-slate-500' : 'text-slate-300'}>
                                                                {s.title}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                );
            })}
        </div>
    );
}

export function TermineesView({ onTaskClick }: TermineesViewProps) {
    const { tasks, users, currentUser, projectColors, archiveTask, reopenTask } = useStore();

    const doneTasks = useMemo(() => {
        return tasks
            .filter(t => t.status === 'done' && !t.archived && !t.deletedAt)
            .sort((a, b) => (b.completedAt || b.updatedAt) - (a.completedAt || a.updatedAt));
    }, [tasks]);

    const { myTasks, otherTasks } = useMemo(() => {
        const my: Task[] = [];
        const other: Task[] = [];
        for (const t of doneTasks) {
            const isConcerned = currentUser
                && (t.assignedTo.includes(currentUser) || (t.reviewers || []).includes(currentUser));
            if (isConcerned) my.push(t);
            else other.push(t);
        }
        return { myTasks: my, otherTasks: other };
    }, [doneTasks, currentUser]);

    const myGrouped = useMemo(() => groupByProject(myTasks), [myTasks]);
    const otherGrouped = useMemo(() => groupByProject(otherTasks), [otherTasks]);

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
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                    {/* Colonne : mes tâches */}
                    <div className="space-y-4 rounded-2xl border border-theme-primary bg-white/[0.02] p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <h2 className="text-sm font-semibold text-theme-primary">Mes tâches terminées</h2>
                            <span className="text-xs text-theme-secondary bg-white/5 border border-theme-primary rounded-full px-2 py-0.5">
                                {myTasks.length}
                            </span>
                        </div>
                        {myTasks.length === 0 ? (
                            <p className="text-xs text-slate-500 italic px-1">Aucune tâche terminée qui vous concerne</p>
                        ) : (
                            <TaskSection
                                grouped={myGrouped}
                                canAct={true}
                                projectColors={projectColors}
                                getUserName={getUserName}
                                onTaskClick={onTaskClick}
                                archiveTask={archiveTask}
                                reopenTask={reopenTask}
                            />
                        )}
                    </div>

                    {/* Colonne : autres tâches */}
                    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.01] p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <h2 className="text-sm font-semibold text-slate-400">Autres tâches terminées</h2>
                            <span className="text-xs text-slate-500 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                                {otherTasks.length}
                            </span>
                        </div>
                        {otherTasks.length === 0 ? (
                            <p className="text-xs text-slate-500 italic px-1">Aucune autre tâche terminée</p>
                        ) : (
                            <TaskSection
                                grouped={otherGrouped}
                                canAct={false}
                                projectColors={projectColors}
                                getUserName={getUserName}
                                onTaskClick={onTaskClick}
                                archiveTask={archiveTask}
                                reopenTask={reopenTask}
                            />
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
