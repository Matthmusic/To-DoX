import { useState, useMemo } from 'react';
import { AlertTriangle, Clock, CheckCircle2, Users, FolderKanban, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import useStore from '../store/useStore';
import { useTheme } from '../hooks/useTheme';
import { getProjectColor } from '../utils';

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
    todo: '#3b82f6', doing: '#22d3ee', review: '#eab308', done: '#22c55e',
};
const STATUS_LABEL: Record<string, string> = {
    todo: 'À faire', doing: 'En cours', review: 'En revue', done: 'Terminé',
};
const USER_PALETTE = [
    '#22d3ee', '#a78bfa', '#34d399', '#f59e0b',
    '#f87171', '#60a5fa', '#fb923c', '#e879f9',
    '#818cf8', '#2dd4bf',
];

function openTask(id: string) {
    window.dispatchEvent(new CustomEvent('todox:openTaskModal', { detail: { taskId: id } }));
}

function fmtDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return "Auj.";
    if (diff === 1) return 'Dem.';
    if (diff < 0) return `J+${Math.abs(diff)}`;
    if (diff < 7) return `J+${diff}`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

type MobileTab = 'projets' | 'equipe' | 'timeline';

// ── Component ──────────────────────────────────────────────────────────────

export function DashboardView() {
    const { tasks, users, projectColors, currentUser } = useStore();
    const { activeTheme } = useTheme();
    const primary = activeTheme.palette.primary;

    const [filterUser, setFilterUser] = useState<string>('all');
    const [expandedProject, setExpandedProject] = useState<string | null>(null);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
    const [overdueExpanded, setOverdueExpanded] = useState(false);
    const [mobileTab, setMobileTab] = useState<MobileTab>('projets');
    const [equipeCollapsed, setEquipeCollapsed] = useState<boolean>(() =>
        localStorage.getItem('dashboard_equipe_collapsed') === 'true'
    );
    const [timelineCollapsed, setTimelineCollapsed] = useState<boolean>(() =>
        localStorage.getItem('dashboard_timeline_collapsed') === 'true'
    );

    const toggleEquipe = () => setEquipeCollapsed(v => {
        localStorage.setItem('dashboard_equipe_collapsed', String(!v));
        return !v;
    });
    const toggleTimeline = () => setTimelineCollapsed(v => {
        localStorage.setItem('dashboard_timeline_collapsed', String(!v));
        return !v;
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const in7daysStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const userColorMap = useMemo(() => {
        const map = new Map<string, string>();
        users.forEach((u, i) => map.set(u.id, USER_PALETTE[i % USER_PALETTE.length]));
        return map;
    }, [users]);

    const activeTasks = useMemo(() => tasks.filter(t => !t.archived && !t.deletedAt), [tasks]);

    const filteredTasks = useMemo(() => {
        if (filterUser === 'all') return activeTasks;
        return activeTasks.filter(t => t.assignedTo.includes(filterUser) || t.createdBy === filterUser);
    }, [activeTasks, filterUser]);

    // ── KPIs ─────────────────────────────────────────────────────────────

    const kpis = useMemo(() => ({
        overdue: activeTasks.filter(t => t.status !== 'done' && t.due && t.due < todayStr).length,
        inProgress: activeTasks.filter(t => t.status === 'doing' || t.status === 'review').length,
        upcomingWeek: activeTasks.filter(t => t.status !== 'done' && t.due && t.due >= todayStr && t.due <= in7daysStr).length,
        done7d: activeTasks.filter(t => t.status === 'done' && t.completedAt && t.completedAt >= Date.now() - 7 * 86400000).length,
    }), [activeTasks, todayStr, in7daysStr]);

    // ── Projets ───────────────────────────────────────────────────────────

    const projectsData = useMemo(() => {
        type Entry = {
            counts: Record<string, number>;
            members: Set<string>;
            nextDue: string | null;
            hasOverdue: boolean;
            total: number;
            taskList: typeof filteredTasks;
        };
        const map = new Map<string, Entry>();

        filteredTasks.forEach(t => {
            if (!map.has(t.project)) {
                map.set(t.project, { counts: { todo: 0, doing: 0, review: 0, done: 0 }, members: new Set(), nextDue: null, hasOverdue: false, total: 0, taskList: [] });
            }
            const e = map.get(t.project)!;
            e.counts[t.status] = (e.counts[t.status] ?? 0) + 1;
            e.total++;
            e.taskList.push(t);
            t.assignedTo.forEach(uid => { if (uid && uid !== 'unassigned') e.members.add(uid); });
            if (t.status !== 'done' && t.due) {
                if (!e.nextDue || t.due < e.nextDue) e.nextDue = t.due;
                if (t.due < todayStr) e.hasOverdue = true;
            }
        });

        return Array.from(map.entries())
            .map(([project, d]) => ({ project, ...d, members: Array.from(d.members) }))
            .sort((a, b) => {
                if (a.hasOverdue !== b.hasOverdue) return a.hasOverdue ? -1 : 1;
                if (a.nextDue && b.nextDue) return a.nextDue.localeCompare(b.nextDue);
                return a.nextDue ? -1 : b.nextDue ? 1 : a.project.localeCompare(b.project);
            });
    }, [filteredTasks, todayStr]);

    // ── Charge équipe ─────────────────────────────────────────────────────

    const workloadData = useMemo(() => {
        return users
            .filter(u => u.id !== 'unassigned')
            .map(u => {
                const myTasks = activeTasks.filter(t => t.assignedTo.includes(u.id) && t.status !== 'done');
                const doingTasks = myTasks.filter(t => t.status === 'doing' || t.status === 'review');
                return { user: u, doingTasks, todoCount: myTasks.filter(t => t.status === 'todo').length };
            })
            .filter(d => d.doingTasks.length > 0 || d.todoCount > 0)
            .sort((a, b) => b.doingTasks.length - a.doingTasks.length);
    }, [activeTasks, users]);

    // ── Timeline 14 jours ─────────────────────────────────────────────────

    const timelineDays = useMemo(() => {
        return Array.from({ length: 14 }, (_, i) => {
            const d = new Date(Date.now() + i * 86400000);
            const iso = d.toISOString().slice(0, 10);
            return { iso, d, dayTasks: filteredTasks.filter(t => t.due === iso && t.status !== 'done') };
        });
    }, [filteredTasks]);

    // ── Retards ───────────────────────────────────────────────────────────

    const overdueTasks = useMemo(
        () => filteredTasks.filter(t => t.status !== 'done' && t.due && t.due < todayStr),
        [filteredTasks, todayStr]
    );

    // ── Sous-composants réutilisables ─────────────────────────────────────

    const EquipePanel = () => (
        <div className="px-3 pb-4 space-y-2">
            {workloadData.length === 0 ? (
                <p className="text-sm text-theme-muted py-2">Aucune tâche assignée</p>
            ) : (
                workloadData.map(({ user, doingTasks, todoCount }) => {
                    const color = userColorMap.get(user.id) ?? '#888';
                    const total = doingTasks.length + todoCount;
                    const loadPct = Math.min((total / 8) * 100, 100);
                    const loadColor = total >= 7 ? '#ef4444' : total >= 5 ? '#f59e0b' : color;
                    const isExpanded = expandedUser === user.id;
                    const allTasks = activeTasks
                        .filter(t => t.assignedTo.includes(user.id) && t.status !== 'done')
                        .sort((a, b) => (a.due ?? 'z').localeCompare(b.due ?? 'z'));
                    // Grouper par projet
                    const tasksByProject = (isExpanded ? allTasks : doingTasks).reduce<Record<string, typeof allTasks>>((acc, t) => {
                        (acc[t.project] ??= []).push(t);
                        return acc;
                    }, {});

                    return (
                        <div key={user.id} className="rounded-lg overflow-hidden">
                            {/* En-tête cliquable */}
                            <button
                                onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                                className="w-full flex items-center gap-2.5 py-2 hover:bg-white/[0.03] transition-colors group rounded-lg"
                            >
                                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                    style={{ backgroundColor: `${color}25`, color, border: `1.5px solid ${color}44` }}>
                                    {user.name.charAt(0)}
                                </div>
                                <span className="text-sm font-medium text-theme-primary truncate flex-1 text-left">{user.name.split(' ')[0]}</span>
                                <span className="text-xs tabular-nums flex-shrink-0" style={{ color: STATUS_COLOR.doing }}>
                                    {doingTasks.length}
                                    {todoCount > 0 && <span className="text-theme-muted opacity-50"> +{todoCount}</span>}
                                </span>
                                <span className="text-[10px] text-white/0 group-hover:text-white/65 transition-colors w-3 flex-shrink-0">
                                    {isExpanded ? '▲' : '▼'}
                                </span>
                            </button>
                            {/* Barre de charge */}
                            <div className="h-1 rounded-full bg-white/5 overflow-hidden ml-10 mb-1.5">
                                <div className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${loadPct}%`, backgroundColor: loadColor }} />
                            </div>
                            {/* Tâches groupées par projet */}
                            <div className="ml-10 space-y-1.5 border-l-2 pl-3 mb-1" style={{ borderColor: `${color}30` }}>
                                {Object.entries(tasksByProject).map(([proj, projTasks]) => {
                                    const pc = getProjectColor(proj, projectColors);
                                    return projTasks.map(t => {
                                        const isLate = t.due && t.due < todayStr;
                                        return (
                                            <button key={t.id} onClick={() => openTask(t.id)}
                                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left ${pc.bg} ${pc.border} border hover:opacity-90`}
                                                title={proj}>
                                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLOR[t.status] }} />
                                                <span className={`text-xs truncate flex-1 ${pc.text}`}>{t.title}</span>
                                                {t.due && (
                                                    <span className={`text-[11px] tabular-nums flex-shrink-0 ${isLate ? 'text-red-400 font-medium' : pc.text + ' opacity-60'}`}>
                                                        {isLate && '⚠ '}{fmtDate(t.due)}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    });
                                })}
                                {!isExpanded && todoCount > 0 && (
                                    <button onClick={() => setExpandedUser(user.id)}
                                        className="text-[11px] text-white/50 pl-2 hover:text-white/85 transition-colors">
                                        +{todoCount} à faire
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );

    const TimelinePanel = () => (
        <div className="px-2 pb-4 space-y-1">
            {timelineDays.map(({ iso, d, dayTasks }) => {
                const isToday = iso === todayStr;
                const label = isToday ? "Aujourd'hui" : d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
                const isExpanded = expandedDays.has(iso);
                const visibleTasks = isExpanded ? dayTasks : dayTasks.slice(0, 4);
                const hiddenCount = dayTasks.length - 4;

                return (
                    <div key={iso}
                        className={`rounded-lg px-2.5 py-2 ${isToday ? 'ring-1 ring-white/10' : ''}`}
                        style={isToday ? { backgroundColor: `${primary}12` } : {}}>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-xs tabular-nums flex-shrink-0 ${isToday ? 'font-semibold' : 'text-white/60'}`}
                                style={isToday ? { color: primary } : {}}>
                                {label}
                            </span>
                            {dayTasks.length > 0 && (
                                <span className="text-[11px] tabular-nums text-white/45 ml-auto">
                                    {dayTasks.length}
                                </span>
                            )}
                        </div>
                        {dayTasks.length > 0 ? (
                            <div className="space-y-1">
                                {visibleTasks.map(t => {
                                    const pc = getProjectColor(t.project, projectColors);
                                    return (
                                        <button key={t.id} onClick={() => openTask(t.id)}
                                            className={`w-full text-left text-xs rounded px-2 py-1 truncate transition-opacity hover:brightness-110 ${pc.bg} ${pc.text} border ${pc.border}`}
                                            title={`${t.title} — ${t.project}`}>
                                            {t.title}
                                        </button>
                                    );
                                })}
                                {hiddenCount > 0 && (
                                    <button
                                        onClick={() => setExpandedDays(prev => {
                                            const next = new Set(prev);
                                            if (isExpanded) next.delete(iso); else next.add(iso);
                                            return next;
                                        })}
                                        className="text-[11px] text-white/50 pl-1 hover:text-white/85 transition-colors"
                                    >
                                        {isExpanded ? '▲ Réduire' : `+${hiddenCount} autres`}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="h-px bg-white/[0.04]" />
                        )}
                    </div>
                );
            })}
        </div>
    );

    const ProjetsPanel = () => (
        <div>
            {projectsData.length === 0 ? (
                <p className="px-4 text-sm text-theme-muted py-4">Aucun projet actif</p>
            ) : (
                projectsData.map(({ project, counts, members, nextDue, hasOverdue, total, taskList }) => {
                    const pc = getProjectColor(project, projectColors);
                    const donePct = total > 0 ? Math.round((counts.done / total) * 100) : 0;
                    const isExpanded = expandedProject === project;
                    const activeTsk = (counts.doing ?? 0) + (counts.review ?? 0);

                    return (
                        <div key={project} className="border-b border-white/[0.04]">
                            <button
                                onClick={() => setExpandedProject(isExpanded ? null : project)}
                                className="w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 hover:bg-white/[0.04] transition-colors group text-left"
                            >
                                {/* Liseré couleur */}
                                <div className={`w-1 h-9 rounded-full flex-shrink-0 ${pc.bg}`} style={{ opacity: 0.9 }} />

                                {/* Bloc central : nom + barre */}
                                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                    {/* Ligne 1 : nom + stats */}
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-semibold truncate flex-1 min-w-0 ${hasOverdue ? 'text-red-300' : 'text-theme-primary'}`} title={project}>
                                            {project}
                                        </span>
                                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                                            {activeTsk > 0 && (
                                                <span className="hidden sm:block text-xs tabular-nums" style={{ color: STATUS_COLOR.doing }}>
                                                    {activeTsk} act.
                                                </span>
                                            )}
                                            <span className="text-xs tabular-nums text-white/60">{donePct}%</span>
                                            <span className={`text-xs tabular-nums flex-shrink-0 ${hasOverdue ? 'text-red-400 font-semibold' : 'text-white/55'}`}>
                                                {nextDue ? fmtDate(nextDue) : '—'}
                                            </span>
                                            {/* Avatars membres */}
                                            <div className="hidden sm:flex -space-x-1.5 flex-shrink-0">
                                                {members.slice(0, 3).map(uid => {
                                                    const u = users.find(x => x.id === uid);
                                                    const color = userColorMap.get(uid) ?? '#888';
                                                    return u ? (
                                                        <div key={uid}
                                                            className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold ring-1 ring-black/20"
                                                            style={{ backgroundColor: `${color}30`, color }}
                                                            title={u.name}>
                                                            {u.name.charAt(0)}
                                                        </div>
                                                    ) : null;
                                                })}
                                                {members.length > 3 && (
                                                    <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-theme-muted">
                                                        +{members.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Ligne 2 : barre de statuts avec compteurs incrustés */}
                                    <div className="flex h-7 rounded-md overflow-hidden gap-px bg-white/5">
                                        {(['todo', 'doing', 'review', 'done'] as const).map(s => {
                                            const w = total > 0 ? (counts[s] / total) * 100 : 0;
                                            const c = counts[s] ?? 0;
                                            return w > 0 ? (
                                                <div key={s}
                                                    className="flex items-center justify-center gap-1 min-w-0 overflow-hidden px-1"
                                                    style={{ width: `${w}%`, backgroundColor: STATUS_COLOR[s] + '55' }}
                                                    title={`${STATUS_LABEL[s]}: ${c}`}>
                                                    <span className="text-[10px] font-medium text-white/70 leading-none truncate hidden sm:block"
                                                        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
                                                        {STATUS_LABEL[s]}
                                                    </span>
                                                    <span className="text-sm font-bold tabular-nums text-white leading-none flex-shrink-0"
                                                        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
                                                        {c}
                                                    </span>
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                </div>

                                <span className="text-xs text-white/0 group-hover:text-white/65 transition-colors w-3 flex-shrink-0">
                                    {isExpanded ? '▲' : '▼'}
                                </span>
                            </button>

                            {/* Tâches dépliées */}
                            {isExpanded && (
                                <div className="px-3 sm:px-4 pb-3 border-l-2 ml-4 sm:ml-5 space-y-0.5" style={{ borderColor: `${primary}30` }}>
                                    {taskList
                                        .filter(t => t.status !== 'done')
                                        .sort((a, b) => (a.due ?? 'z').localeCompare(b.due ?? 'z'))
                                        .map(t => {
                                            const isLate = t.due && t.due < todayStr;
                                            return (
                                                <button key={t.id} onClick={() => openTask(t.id)}
                                                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors text-left group/t">
                                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLOR[t.status] }} />
                                                                                    <span className="text-sm text-white/85 truncate flex-1">{t.title}</span>
                                                    {t.due && (
                                                        <span className={`text-xs tabular-nums flex-shrink-0 ${isLate ? 'text-red-400 font-medium' : 'text-white/50'}`}>
                                                            {isLate && '⚠ '}{fmtDate(t.due)}
                                                        </span>
                                                    )}
                                                    {t.assignedTo.filter(id => id !== 'unassigned').slice(0, 2).map(uid => {
                                                        const u = users.find(x => x.id === uid);
                                                        const color = userColorMap.get(uid) ?? '#888';
                                                        return u ? (
                                                            <div key={uid}
                                                                className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                                                                style={{ backgroundColor: `${color}30`, color }}>
                                                                {u.name.charAt(0)}
                                                            </div>
                                                        ) : null;
                                                    })}
                                                </button>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <style>{`
                @keyframes slideUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
                .su { animation: slideUp 0.25s ease both; }
            `}</style>

            <div className="flex-1 flex flex-col overflow-hidden w-full max-w-[2400px] mx-auto">

            {/* ── Bandeau KPIs + filtres ── */}
            <div className="su flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/[0.07] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5">
                {/* KPIs */}
                <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto flex-shrink-0">
                    {kpis.overdue > 0 && (
                        <div className="flex items-center gap-1.5 text-red-400 flex-shrink-0">
                            <AlertTriangle className="h-3 w-3" />
                            <span className="text-base sm:text-lg font-bold tabular-nums leading-none">{kpis.overdue}</span>
                            <span className="text-[11px] opacity-60">retard{kpis.overdue > 1 ? 's' : ''}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 flex-shrink-0" style={{ color: STATUS_COLOR.doing }}>
                        <Clock className="h-3 w-3" />
                        <span className="text-base sm:text-lg font-bold tabular-nums leading-none">{kpis.inProgress}</span>
                        <span className="text-[11px] opacity-60">en cours</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-400 flex-shrink-0">
                        <span className="text-base sm:text-lg font-bold tabular-nums leading-none">{kpis.upcomingWeek}</span>
                        <span className="text-[11px] opacity-60">échéances 7j</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0" style={{ color: STATUS_COLOR.done }}>
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="text-base sm:text-lg font-bold tabular-nums leading-none">{kpis.done7d}</span>
                        <span className="text-[11px] opacity-60">terminées 7j</span>
                    </div>
                </div>

                <div className="flex-1 hidden sm:block" />

                {/* Filtre utilisateur */}
                <div className="flex items-center gap-1 flex-wrap">
                    <button
                        onClick={() => setFilterUser('all')}
                        className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                        style={filterUser === 'all'
                            ? { backgroundColor: `${primary}30`, color: primary }
                            : { color: 'rgba(255,255,255,0.6)' }}
                    >
                        Tous
                    </button>
                    {users.filter(u => u.id !== 'unassigned').map(u => {
                        const color = userColorMap.get(u.id) ?? '#888';
                        const active = filterUser === u.id;
                        return (
                            <button
                                key={u.id}
                                onClick={() => setFilterUser(active ? 'all' : u.id)}
                                className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                                style={active
                                    ? { backgroundColor: `${color}30`, color }
                                    : { color: 'rgba(255,255,255,0.6)' }}
                            >
                                {u.id === currentUser ? 'Moi' : u.name.split(' ')[0]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Retards inline */}
            {overdueTasks.length > 0 && (
                <div className="su flex-shrink-0 bg-red-950/30 border-b border-red-500/20" style={{ animationDelay: '0.04s' }}>
                    {/* En-tête cliquable — pills overflow-hidden pour remplir toute la largeur */}
                    <button
                        onClick={() => setOverdueExpanded(v => !v)}
                        className="w-full flex items-center gap-2 px-3 sm:px-4 py-1.5 hover:bg-red-500/10 transition-colors overflow-hidden"
                    >
                        <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-red-400 flex-shrink-0 mr-1">
                            {overdueTasks.length} retard{overdueTasks.length > 1 ? 's' : ''}
                        </span>
                        {/* Pills qui remplissent l'espace disponible — overflow caché */}
                        <div className="flex items-center gap-1 flex-1 overflow-hidden min-w-0">
                            {overdueTasks.map(t => (
                                <span key={t.id} className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-1.5 py-0.5 whitespace-nowrap shrink-0">
                                    {t.title}
                                </span>
                            ))}
                        </div>
                        <span className="text-red-400/60 text-[10px] flex-shrink-0">{overdueExpanded ? '▲' : '▼'}</span>
                    </button>
                    {/* Groupé par projet, déroulé */}
                    {overdueExpanded && (() => {
                        const byProject = overdueTasks.reduce<Record<string, typeof overdueTasks>>((acc, t) => {
                            (acc[t.project] ??= []).push(t);
                            return acc;
                        }, {});
                        return (
                            <div className="flex flex-wrap gap-x-4 gap-y-1.5 pb-2 px-3 sm:px-4 pt-1">
                                {Object.entries(byProject).map(([proj, tasks]) => {
                                    const pc = getProjectColor(proj, projectColors);
                                    return (
                                        <div key={proj} className="flex items-center gap-1 flex-wrap">
                                            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${pc.bg} ${pc.text} flex-shrink-0`}>
                                                {proj}
                                            </span>
                                            {tasks.map(t => {
                                                const daysLate = Math.floor((new Date().getTime() - new Date(t.due!).getTime()) / 86400000);
                                                return (
                                                    <button key={t.id} onClick={() => openTask(t.id)}
                                                        className="flex items-center gap-1 text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded px-1.5 py-0.5 transition-colors">
                                                        <span className="truncate max-w-[160px]">{t.title}</span>
                                                        <span className="text-[10px] text-red-400/60 tabular-nums flex-shrink-0">{daysLate}j</span>
                                                        {t.assignedTo.filter(id => id !== 'unassigned').slice(0, 2).map(uid => {
                                                            const u = users.find(x => x.id === uid);
                                                            const color = userColorMap.get(uid) ?? '#888';
                                                            return u ? (
                                                                <div key={uid}
                                                                    className="h-3.5 w-3.5 rounded-full flex items-center justify-center text-[7px] font-bold flex-shrink-0"
                                                                    style={{ backgroundColor: `${color}40`, color, border: `1px solid ${color}60` }}
                                                                    title={u.name}>
                                                                    {u.name.charAt(0)}
                                                                </div>
                                                            ) : null;
                                                        })}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ── Onglets mobile (< lg) ── */}
            <div className="lg:hidden flex-shrink-0 flex border-b border-white/[0.07]">
                {([
                    { id: 'projets' as MobileTab, label: 'Projets', icon: FolderKanban, count: projectsData.length },
                    { id: 'equipe' as MobileTab, label: 'Équipe', icon: Users, count: workloadData.length },
                    { id: 'timeline' as MobileTab, label: '14 jours', icon: CalendarDays, count: null },
                ]).map(tab => {
                    const isActive = mobileTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setMobileTab(tab.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all relative"
                            style={isActive ? { color: primary } : { color: 'rgba(255,255,255,0.6)' }}
                        >
                            <tab.icon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{tab.label}</span>
                            {tab.count !== null && tab.count > 0 && (
                                <span className="text-[9px] tabular-nums opacity-50">({tab.count})</span>
                            )}
                            {isActive && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                                    style={{ backgroundColor: primary }} />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Corps ── */}
            <div className="flex flex-1 overflow-hidden px-3 sm:px-4">

                {/* ── COL GAUCHE : Équipe (desktop uniquement) ── */}
                <div
                    className="su hidden lg:flex flex-col border-r border-white/[0.07] flex-shrink-0 transition-all duration-300 overflow-hidden"
                    style={{ animationDelay: '0.06s', width: equipeCollapsed ? '32px' : 'clamp(180px, 20%, 520px)' }}
                >
                    {equipeCollapsed ? (
                        <button
                            onClick={toggleEquipe}
                            className="flex-1 flex flex-col items-center justify-center gap-2 py-4 hover:bg-white/5 transition-colors group"
                            title="Afficher Équipe"
                        >
                            <Users className="h-3.5 w-3.5 text-white/40 group-hover:text-white/75" />
                            <ChevronRight className="h-3 w-3 text-white/40 group-hover:text-white/75" />
                        </button>
                    ) : (
                        <div className="flex flex-col overflow-y-auto w-full h-full">
                            <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-widest text-white/65">Équipe</p>
                                <button onClick={toggleEquipe} className="p-0.5 rounded hover:bg-white/10 transition-colors" title="Réduire">
                                    <ChevronLeft className="h-3.5 w-3.5 text-white/45" />
                                </button>
                            </div>
                            <EquipePanel />
                        </div>
                    )}
                </div>

                {/* ── COL CENTRE : Projets (desktop) / Vue active (mobile) ── */}
                <div className="su overflow-y-auto flex-1 min-w-0" style={{ animationDelay: '0.1s' }}>

                    {/* Mobile : onglet équipe */}
                    {mobileTab === 'equipe' && (
                        <div className="lg:hidden pt-3">
                            <EquipePanel />
                        </div>
                    )}

                    {/* Mobile : onglet timeline */}
                    {mobileTab === 'timeline' && (
                        <div className="lg:hidden pt-3">
                            <TimelinePanel />
                        </div>
                    )}

                    {/* Projets : toujours visible sur desktop, visible sur mobile si onglet actif */}
                    <div className={mobileTab !== 'projets' ? 'hidden lg:block' : undefined}>
                        <div className="px-3 sm:px-4 pt-3 pb-1 flex items-center gap-2">
                            <p className="text-xs font-semibold uppercase tracking-widest text-white/65">
                                Projets <span className="tabular-nums opacity-50">({projectsData.length})</span>
                            </p>
                            <div className="flex items-center gap-2 ml-auto">
                                {(['todo', 'doing', 'review', 'done'] as const).map(s => (
                                    <div key={s} className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[s] }} />
                                        <span className="text-xs text-white/55 hidden xl:block">{STATUS_LABEL[s]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <ProjetsPanel />
                    </div>
                </div>

                {/* ── COL DROITE : Timeline (desktop uniquement) ── */}
                <div
                    className="su hidden xl:flex flex-col border-l border-white/[0.07] flex-shrink-0 transition-all duration-300 overflow-hidden"
                    style={{ animationDelay: '0.14s', width: timelineCollapsed ? '32px' : 'clamp(180px, 20%, 520px)' }}
                >
                    {timelineCollapsed ? (
                        <button
                            onClick={toggleTimeline}
                            className="flex-1 flex flex-col items-center justify-center gap-2 py-4 hover:bg-white/5 transition-colors group"
                            title="Afficher 14 jours"
                        >
                            <CalendarDays className="h-3.5 w-3.5 text-white/40 group-hover:text-white/75" />
                            <ChevronLeft className="h-3 w-3 text-white/40 group-hover:text-white/75" />
                        </button>
                    ) : (
                        <div className="flex flex-col overflow-y-auto w-full h-full">
                            <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-widest text-white/65">14 jours</p>
                                <button onClick={toggleTimeline} className="p-0.5 rounded hover:bg-white/10 transition-colors" title="Réduire">
                                    <ChevronRight className="h-3.5 w-3.5 text-white/45" />
                                </button>
                            </div>
                            <TimelinePanel />
                        </div>
                    )}
                </div>

            </div>{/* fin corps */}

            </div>{/* fin conteneur centré */}
        </div>
    );
}
