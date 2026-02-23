import { useMemo } from 'react';
import { CheckCircle2, Clock, AlertTriangle, Layers, TrendingUp, Users, BarChart3, Star } from 'lucide-react';
import useStore from '../store/useStore';
import { useTheme } from '../hooks/useTheme';
import { getProjectColor } from '../utils';

// ── Constants ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
    todo: 'À faire', doing: 'En cours', review: 'En revue', done: 'Terminé',
};
const STATUS_COLOR: Record<string, string> = {
    todo:   '#3b82f6',
    doing:  '#22d3ee',
    review: '#eab308',
    done:   '#22c55e',
};

const USER_PALETTE = [
    '#22d3ee', '#a78bfa', '#34d399', '#f59e0b',
    '#f87171', '#60a5fa', '#fb923c', '#e879f9',
    '#818cf8', '#2dd4bf',
];

// ── Helpers ────────────────────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function isoWeekLabel(date: Date): string {
    const mon = startOfWeek(date);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${fmt(mon)} – ${fmt(sun)}`;
}

// ── Component ──────────────────────────────────────────────────────────────

export function DashboardView() {
    const { tasks, users, projectColors, currentUser } = useStore();
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;

    // Active tasks only (not archived, not deleted)
    const activeTasks = useMemo(
        () => tasks.filter(t => !t.archived && !t.deletedAt),
        [tasks]
    );

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const todayStr = new Date().toISOString().slice(0, 10);

    // ── KPI metrics ───────────────────────────────────────────────────────

    const totalActive = activeTasks.length;

    const doneThisWeek = useMemo(
        () => activeTasks.filter(t => t.status === 'done' && t.completedAt && t.completedAt >= sevenDaysAgo).length,
        [activeTasks, sevenDaysAgo]
    );

    const inProgress = useMemo(
        () => activeTasks.filter(t => t.status === 'doing' || t.status === 'review').length,
        [activeTasks]
    );

    const overdue = useMemo(
        () => activeTasks.filter(t => t.due && t.due < todayStr && t.status !== 'done').length,
        [activeTasks, todayStr]
    );

    const favorites = useMemo(
        () => activeTasks.filter(t => t.favorite && t.status !== 'done').length,
        [activeTasks]
    );

    // ── Tasks by status ────────────────────────────────────────────────────

    const byStatus = useMemo(() => {
        const counts: Record<string, number> = { todo: 0, doing: 0, review: 0, done: 0 };
        activeTasks.forEach(t => { counts[t.status] = (counts[t.status] ?? 0) + 1; });
        const total = activeTasks.length || 1;
        return Object.entries(counts).map(([status, count]) => ({
            status,
            count,
            pct: Math.round((count / total) * 100),
        }));
    }, [activeTasks]);

    // ── Tasks by project ───────────────────────────────────────────────────

    const byProject = useMemo(() => {
        const map = new Map<string, { total: number; done: number }>();
        activeTasks.forEach(t => {
            const entry = map.get(t.project) ?? { total: 0, done: 0 };
            entry.total++;
            if (t.status === 'done') entry.done++;
            map.set(t.project, entry);
        });
        return Array.from(map.entries())
            .map(([project, { total, done }]) => ({
                project,
                total,
                done,
                pct: total > 0 ? Math.round((done / total) * 100) : 0,
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 8); // Top 8 projects
    }, [activeTasks]);

    // ── Tasks by user ──────────────────────────────────────────────────────

    const byUser = useMemo(() => {
        const map = new Map<string, { total: number; done: number }>();
        activeTasks.forEach(t => {
            t.assignedTo.forEach(uid => {
                if (!uid || uid === 'unassigned') return;
                const entry = map.get(uid) ?? { total: 0, done: 0 };
                entry.total++;
                if (t.status === 'done') entry.done++;
                map.set(uid, entry);
            });
        });
        return Array.from(map.entries())
            .map(([userId, { total, done }]) => {
                const user = users.find(u => u.id === userId);
                return {
                    userId,
                    name: user?.name ?? userId,
                    total,
                    done,
                    pct: total > 0 ? Math.round((done / total) * 100) : 0,
                };
            })
            .sort((a, b) => b.total - a.total);
    }, [activeTasks, users]);

    // ── Completion trend (last 4 weeks) ────────────────────────────────────

    const weeklyTrend = useMemo(() => {
        const weeks: { label: string; start: number; end: number }[] = [];
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        for (let i = 3; i >= 0; i--) {
            const refDate = new Date(today);
            refDate.setDate(today.getDate() - i * 7);
            const mon = startOfWeek(refDate);
            const sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);
            sun.setHours(23, 59, 59, 999);
            weeks.push({
                label: isoWeekLabel(mon),
                start: mon.getTime(),
                end: sun.getTime(),
            });
        }
        return weeks.map(w => ({
            label: w.label,
            count: activeTasks.filter(
                t => t.status === 'done' && t.completedAt && t.completedAt >= w.start && t.completedAt <= w.end
            ).length,
        }));
    }, [activeTasks]);

    const maxTrendCount = Math.max(...weeklyTrend.map(w => w.count), 1);

    // ── Priority breakdown ─────────────────────────────────────────────────

    const byPriority = useMemo(() => {
        const counts = { high: 0, med: 0, low: 0 };
        activeTasks.filter(t => t.status !== 'done').forEach(t => {
            counts[t.priority]++;
        });
        return [
            { label: 'Haute', key: 'high', count: counts.high, color: '#ef4444' },
            { label: 'Moy.', key: 'med', count: counts.med, color: '#f59e0b' },
            { label: 'Basse', key: 'low', count: counts.low, color: '#22c55e' },
        ];
    }, [activeTasks]);

    const cardBase = "rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-1";
    const sectionTitle = "text-xs font-semibold uppercase tracking-widest mb-3";

    return (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* ── KPI Cards ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Total actives */}
                <div className={cardBase}>
                    <div className="flex items-center gap-2 mb-1">
                        <Layers className="h-4 w-4 opacity-60" style={{ color: primaryColor }} />
                        <span className="text-xs text-theme-muted">Actives</span>
                    </div>
                    <span className="text-3xl font-bold text-theme-primary">{totalActive}</span>
                    <span className="text-xs text-theme-muted">tâches en cours</span>
                </div>

                {/* En cours */}
                <div className={cardBase}>
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4" style={{ color: STATUS_COLOR.doing }} />
                        <span className="text-xs text-theme-muted">En cours</span>
                    </div>
                    <span className="text-3xl font-bold" style={{ color: STATUS_COLOR.doing }}>{inProgress}</span>
                    <span className="text-xs text-theme-muted">doing + revue</span>
                </div>

                {/* Terminées cette semaine */}
                <div className={cardBase}>
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4" style={{ color: STATUS_COLOR.done }} />
                        <span className="text-xs text-theme-muted">Cette semaine</span>
                    </div>
                    <span className="text-3xl font-bold" style={{ color: STATUS_COLOR.done }}>{doneThisWeek}</span>
                    <span className="text-xs text-theme-muted">terminées (7j)</span>
                </div>

                {/* En retard */}
                <div className={cardBase}>
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4" style={{ color: overdue > 0 ? '#ef4444' : 'rgba(255,255,255,0.3)' }} />
                        <span className="text-xs text-theme-muted">En retard</span>
                    </div>
                    <span className="text-3xl font-bold" style={{ color: overdue > 0 ? '#ef4444' : 'rgba(255,255,255,0.5)' }}>{overdue}</span>
                    <span className="text-xs text-theme-muted">échéances dépassées</span>
                </div>

                {/* Favoris */}
                <div className={cardBase}>
                    <div className="flex items-center gap-2 mb-1">
                        <Star className="h-4 w-4" style={{ color: '#f59e0b' }} />
                        <span className="text-xs text-theme-muted">Favoris</span>
                    </div>
                    <span className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{favorites}</span>
                    <span className="text-xs text-theme-muted">tâches prioritaires</span>
                </div>
            </div>

            {/* ── Row 2: Status + Priority + Trend ────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                {/* Status breakdown */}
                <div className={cardBase}>
                    <p className={sectionTitle} style={{ color: primaryColor }}>Par statut</p>
                    <div className="space-y-2 flex-1">
                        {byStatus.map(({ status, count, pct }) => (
                            <div key={status}>
                                <div className="flex justify-between text-xs mb-0.5">
                                    <span className="text-theme-secondary">{STATUS_LABEL[status]}</span>
                                    <span className="text-theme-muted">{count} ({pct}%)</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${pct}%`, backgroundColor: STATUS_COLOR[status] }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Priority breakdown */}
                <div className={cardBase}>
                    <p className={sectionTitle} style={{ color: primaryColor }}>Par priorité</p>
                    <div className="flex flex-col gap-3 flex-1 justify-center">
                        {byPriority.map(({ label, count, color }) => (
                            <div key={label} className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                <span className="text-xs text-theme-secondary w-10">{label}</span>
                                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{
                                            width: `${activeTasks.filter(t => t.status !== 'done').length > 0
                                                ? Math.round((count / activeTasks.filter(t => t.status !== 'done').length) * 100)
                                                : 0}%`,
                                            backgroundColor: color,
                                        }}
                                    />
                                </div>
                                <span className="text-xs text-theme-muted w-4 text-right">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Weekly completion trend */}
                <div className={cardBase}>
                    <p className={sectionTitle} style={{ color: primaryColor }}>
                        <TrendingUp className="inline h-3.5 w-3.5 mr-1" />
                        Tendance (4 semaines)
                    </p>
                    <div className="flex items-end gap-2 flex-1 min-h-[80px]">
                        {weeklyTrend.map((w, i) => {
                            const barH = maxTrendCount > 0 ? Math.max((w.count / maxTrendCount) * 80, w.count > 0 ? 8 : 2) : 2;
                            const isCurrentWeek = i === weeklyTrend.length - 1;
                            return (
                                <div key={w.label} className="flex flex-col items-center gap-1 flex-1" title={`${w.label}: ${w.count} terminées`}>
                                    <span className="text-xs font-semibold text-theme-secondary">{w.count}</span>
                                    <div
                                        className="w-full rounded-t transition-all duration-700"
                                        style={{
                                            height: `${barH}px`,
                                            backgroundColor: isCurrentWeek ? primaryColor : `${primaryColor}55`,
                                        }}
                                    />
                                    <span className="text-[9px] text-theme-muted text-center leading-tight" style={{ fontSize: '9px' }}>
                                        {w.label.split(' – ')[0]}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Row 3: Projects + Users ──────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                {/* By project */}
                <div className={`${cardBase} min-h-[200px]`}>
                    <p className={sectionTitle} style={{ color: primaryColor }}>
                        <BarChart3 className="inline h-3.5 w-3.5 mr-1" />
                        Par projet
                    </p>
                    {byProject.length === 0 ? (
                        <p className="text-xs text-theme-muted">Aucun projet actif</p>
                    ) : (
                        <div className="space-y-2.5 overflow-y-auto flex-1">
                            {byProject.map(({ project, total, done, pct }) => {
                                const pc = getProjectColor(project, projectColors);
                                return (
                                    <div key={project}>
                                        <div className="flex justify-between text-xs mb-0.5">
                                            <span
                                                className="font-medium truncate max-w-[160px]"
                                                style={{ color: pc.text }}
                                                title={project}
                                            >
                                                {project}
                                            </span>
                                            <span className="text-theme-muted flex-shrink-0 ml-2">
                                                {done}/{total} ({pct}%)
                                            </span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{ width: `${pct}%`, backgroundColor: pc.text }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* By user */}
                <div className={`${cardBase} min-h-[200px]`}>
                    <p className={sectionTitle} style={{ color: primaryColor }}>
                        <Users className="inline h-3.5 w-3.5 mr-1" />
                        Par utilisateur
                    </p>
                    {byUser.length === 0 ? (
                        <p className="text-xs text-theme-muted">Aucune tâche assignée</p>
                    ) : (
                        <div className="space-y-2.5 overflow-y-auto flex-1">
                            {byUser.map(({ userId, name, total, done, pct }, idx) => {
                                const color = USER_PALETTE[idx % USER_PALETTE.length];
                                const isMe = userId === currentUser;
                                return (
                                    <div key={userId}>
                                        <div className="flex items-center justify-between text-xs mb-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <div
                                                    className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                                                    style={{ backgroundColor: `${color}33`, color }}
                                                >
                                                    {name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className={`font-medium ${isMe ? 'underline underline-offset-2' : ''}`} style={{ color }}>
                                                    {name}
                                                </span>
                                            </div>
                                            <span className="text-theme-muted">
                                                {done}/{total} ({pct}%)
                                            </span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{ width: `${pct}%`, backgroundColor: color }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
