import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, CalendarDays, Calendar, X } from 'lucide-react';
import type { Task } from '../types';
import useStore from '../store/useStore';
import { useTheme } from '../hooks/useTheme';
import { TaskCard } from './TaskCard';

interface TimelineViewProps {
    filteredTasks: Task[];
    onTaskClick: (task: Task, x: number, y: number) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
    todo:   'rgba(59,130,246,0.7)',
    doing:  'rgba(34,211,238,0.7)',
    review: 'rgba(234,179,8,0.7)',
    done:   'rgba(34,197,94,0.5)',
};
const STATUS_BORDER: Record<string, string> = {
    todo:   '#3b82f6',
    doing:  '#22d3ee',
    review: '#eab308',
    done:   '#22c55e',
};
const STATUS_LABEL: Record<string, string> = {
    todo: 'À faire', doing: 'En cours', review: 'Revue', done: 'Terminé',
};
const PRIORITY_COLOR: Record<string, string> = {
    high: '#ef4444',
    med:  '#f59e0b',
    low:  '#22c55e',
};
const PROJECT_PALETTE = [
    '#22d3ee', '#a78bfa', '#34d399', '#f59e0b',
    '#f87171', '#60a5fa', '#fb923c', '#e879f9',
    '#818cf8', '#2dd4bf',
];
const MONTH_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTH_SHORT = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
const DAY_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

type ViewMode = '4weeks' | 'month';

// ── Helpers ───────────────────────────────────────────────────────────────

function toISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getMondayOf(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d;
}

function formatShortDate(iso: string): string {
    const [, m, d] = iso.split('-');
    return `${parseInt(d)} ${MONTH_SHORT[parseInt(m) - 1]}`;
}

// Layout constants
const SIDE_W = 380;
const COL_W: Record<ViewMode, number> = { '4weeks': 110, month: 52 };

// Row types for flat rendering
type ProjectRow = { type: 'project'; project: string; color: string; count: number };
type TaskRow    = { type: 'task'; task: Task; project: string; isLast: boolean };
type FlatRow    = ProjectRow | TaskRow;

/**
 * Vue Timeline — une ligne par tâche, en cascade sous le projet.
 * Due date = marqueur coloré dans la colonne du jour correspondant.
 */
export function TimelineView({ filteredTasks, onTaskClick }: TimelineViewProps) {
    const { projectColors } = useStore();
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;

    const [viewMode, setViewMode]       = useState<ViewMode>('4weeks');
    const [offset, setOffset]           = useState(0);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const todayStr = useMemo(() => toISO(new Date()), []);

    // Generate day columns
    const days = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (viewMode === '4weeks') {
            const start = getMondayOf(today);
            start.setDate(start.getDate() - 7 + offset * 7);
            return Array.from({ length: 28 }, (_, i) => {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                return d;
            });
        } else {
            const ref = new Date(today.getFullYear(), today.getMonth() + offset, 1);
            const n = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
            return Array.from({ length: n }, (_, i) =>
                new Date(ref.getFullYear(), ref.getMonth(), i + 1)
            );
        }
    }, [viewMode, offset]);

    const dayISOs    = useMemo(() => days.map(toISO), [days]);
    const dayISOSet  = useMemo(() => new Set(dayISOs), [dayISOs]);
    const rangeStart = dayISOs[0];
    const rangeEnd   = dayISOs[dayISOs.length - 1];

    const periodLabel = useMemo(() => {
        const s = days[0], e = days[days.length - 1];
        if (viewMode === '4weeks') {
            return `${s.getDate()} ${MONTH_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTH_SHORT[e.getMonth()]} ${e.getFullYear()}`;
        }
        return `${MONTH_FR[s.getMonth()]} ${s.getFullYear()}`;
    }, [viewMode, days]);

    // Project color helper
    function getProjectColor(project: string): string {
        const idx = (projectColors[project] ?? 0) % PROJECT_PALETTE.length;
        return PROJECT_PALETTE[idx];
    }

    // Build flat rows: project header → task rows in order
    const flatRows = useMemo((): FlatRow[] => {
        // Group tasks by project, sorted
        const groups = new Map<string, Task[]>();
        for (const t of filteredTasks) {
            const proj = t.project || 'Sans projet';
            if (!groups.has(proj)) groups.set(proj, []);
            groups.get(proj)!.push(t);
        }

        // Sort tasks within each project by due date (null last), then title
        for (const [, tasks] of groups) {
            tasks.sort((a, b) => {
                if (!a.due && !b.due) return a.title.localeCompare(b.title);
                if (!a.due) return 1;
                if (!b.due) return -1;
                return a.due.localeCompare(b.due);
            });
        }

        const sortedProjects = [...groups.keys()].sort();
        const rows: FlatRow[] = [];

        for (const project of sortedProjects) {
            const tasks = groups.get(project)!;
            const color = getProjectColor(project);
            rows.push({ type: 'project', project, color, count: tasks.length });
            tasks.forEach((task, i) =>
                rows.push({ type: 'task', task, project, isLast: i === tasks.length - 1 })
            );
        }
        return rows;
    }, [filteredTasks, projectColors]);

    const compact = viewMode === 'month';
    const colW    = COL_W[viewMode];

    function switchView(mode: ViewMode) { setViewMode(mode); setOffset(0); }

    return (
        <>
        <div className="flex flex-col h-full gap-3 p-4 overflow-hidden">

            {/* ── Toolbar ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">

                <div className="flex rounded-xl overflow-hidden border border-white/10">
                    {(['4weeks', 'month'] as ViewMode[]).map(mode => (
                        <button
                            key={mode}
                            onClick={() => switchView(mode)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors"
                            style={viewMode === mode
                                ? { backgroundColor: `${primaryColor}25`, color: primaryColor }
                                : { color: 'rgba(255,255,255,0.4)' }
                            }
                        >
                            {mode === '4weeks'
                                ? <><CalendarDays className="h-3.5 w-3.5" />4 semaines</>
                                : <><Calendar className="h-3.5 w-3.5" />Mois</>
                            }
                        </button>
                    ))}
                </div>

                <button onClick={() => setOffset(o => o - 1)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-white/80 min-w-56 text-center select-none">
                    {periodLabel}
                </span>
                <button onClick={() => setOffset(o => o + 1)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                    <ChevronRight className="h-4 w-4" />
                </button>

                <button
                    onClick={() => setOffset(0)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors"
                    style={{ borderColor: `${primaryColor}33`, backgroundColor: `${primaryColor}10`, color: primaryColor }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${primaryColor}25`)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = `${primaryColor}10`)}
                >
                    Aujourd'hui
                </button>

                {/* Legend */}
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                    {(Object.entries(STATUS_LABEL) as [string, string][]).map(([status, label]) => (
                        <span key={status} className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded border"
                            style={{ borderColor: `${STATUS_BORDER[status]}50`, backgroundColor: `${STATUS_COLOR[status]}20`, color: STATUS_BORDER[status] }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_BORDER[status] }} />
                            {label}
                        </span>
                    ))}
                </div>
            </div>

            {/* ── Grid ────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto rounded-2xl border border-white/10 bg-theme-bg-secondary">
                <div style={{ minWidth: `${SIDE_W + colW * days.length}px` }}>

                    {/* ── Header row ── */}
                    <div className="flex sticky top-0 z-20 border-b border-white/10"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        {/* Corner */}
                        <div className="sticky left-0 z-30 px-4 py-2 border-r border-white/10
                            text-[10px] font-bold text-white/25 uppercase tracking-widest flex items-end"
                            style={{ width: SIDE_W, minWidth: SIDE_W, backgroundColor: 'var(--bg-secondary)' }}>
                            Projet / Tâche
                        </div>
                        {/* Day headers */}
                        {days.map(day => {
                            const iso = toISO(day);
                            const isToday = iso === todayStr;
                            const isMonday = day.getDay() === 1;
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                            return (
                                <div key={iso}
                                    className={`flex flex-col items-center justify-center py-2 border-r border-white/5 last:border-r-0
                                        ${isToday ? 'bg-cyan-500/15' : isWeekend ? 'bg-white/[0.02]' : ''}
                                        ${isMonday && !isToday ? 'border-l border-l-white/15' : ''}`}
                                    style={{ width: colW, minWidth: colW }}>
                                    {day.getDate() === 1 && (
                                        <span className="text-[8px] font-bold uppercase tracking-wider text-white/40 leading-none mb-0.5">
                                            {MONTH_SHORT[day.getMonth()]}
                                        </span>
                                    )}
                                    <span className={`text-[9px] font-bold uppercase tracking-wider leading-none
                                        ${isToday ? 'text-cyan-400' : isWeekend ? 'text-white/20' : 'text-white/30'}`}>
                                        {DAY_SHORT[day.getDay()]}
                                    </span>
                                    <span className={`text-sm font-bold leading-tight mt-0.5
                                        ${isToday ? 'text-cyan-300' : isWeekend ? 'text-white/30' : 'text-white/65'}`}>
                                        {day.getDate()}
                                    </span>
                                    {isToday && <span className="mt-0.5 h-1 w-1 rounded-full bg-cyan-400" />}
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Empty state ── */}
                    {flatRows.length === 0 && (
                        <div className="flex items-center justify-center h-40 text-white/25 text-sm">
                            Aucune tâche à afficher
                        </div>
                    )}

                    {/* ── Flat rows ── */}
                    {flatRows.map((row, rowIdx) => {

                        // ─ Project header ─
                        if (row.type === 'project') {
                            return (
                                <div key={`proj-${row.project}`}
                                    className="flex border-b border-white/10"
                                    style={{ backgroundColor: `${row.color}08` }}>
                                    {/* Label */}
                                    <div className="sticky left-0 z-10 px-4 py-2.5 border-r border-white/10
                                        flex items-center gap-2"
                                        style={{ width: SIDE_W, minWidth: SIDE_W, backgroundColor: `${row.color}10` }}>
                                        <div className="h-3 w-3 rounded flex-shrink-0"
                                            style={{ backgroundColor: row.color }} />
                                        <span className="text-xs font-black tracking-widest uppercase"
                                            style={{ color: row.color }}>
                                            {row.project}
                                        </span>
                                        <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                            style={{ backgroundColor: `${row.color}20`, color: row.color }}>
                                            {row.count}
                                        </span>
                                    </div>
                                    {/* Day cells (decorative line) */}
                                    {dayISOs.map(iso => {
                                        const isToday = iso === todayStr;
                                        return (
                                            <div key={iso}
                                                className={`border-r border-white/5 last:border-r-0 py-2.5 ${isToday ? 'bg-cyan-500/5' : ''}`}
                                                style={{ width: colW, minWidth: colW }}>
                                                <div className="h-px mx-2" style={{ backgroundColor: `${row.color}25` }} />
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        }

                        // ─ Task row ─
                        const { task, isLast } = row;
                        const isDueBefore  = task.due ? task.due < rangeStart : false;
                        const isDueAfter   = task.due ? task.due > rangeEnd   : false;
                        const isEven = rowIdx % 2 === 0;

                        return (
                            <div key={task.id}
                                className={`flex border-b ${isLast ? 'border-white/10' : 'border-white/[0.04]'} hover:bg-white/[0.03] transition-colors group cursor-pointer`}
                                style={isEven ? { backgroundColor: 'rgba(255,255,255,0.01)' } : {}}
                                onClick={() => setSelectedTask(task)}>

                                {/* Task label (sidebar) */}
                                <div
                                    className="sticky left-0 z-10 px-4 py-2 border-r border-white/10 flex items-center gap-2"
                                    style={{ width: SIDE_W, minWidth: SIDE_W, backgroundColor: 'var(--bg-secondary)' }}
                                >
                                    {/* Tree indent + connector */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
                                        <span className="text-white/15 text-xs">└</span>
                                        {/* Priority dot */}
                                        <span className="h-2 w-2 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} />
                                    </div>
                                    {/* Title */}
                                    <span className={`text-xs font-medium leading-snug truncate flex-1
                                        ${task.status === 'done' ? 'line-through text-white/35' : 'text-white/80'}
                                        group-hover:text-white/95 transition-colors`}
                                        title={task.title}>
                                        {task.title}
                                    </span>
                                    {/* Out-of-range indicator */}
                                    {isDueBefore && (
                                        <span className="text-[9px] text-orange-400/70 flex-shrink-0 font-semibold"
                                            title={`Échéance : ${formatShortDate(task.due!)}`}>
                                            ← {formatShortDate(task.due!)}
                                        </span>
                                    )}
                                    {isDueAfter && (
                                        <span className="text-[9px] text-blue-400/70 flex-shrink-0 font-semibold"
                                            title={`Échéance : ${formatShortDate(task.due!)}`}>
                                            {formatShortDate(task.due!)} →
                                        </span>
                                    )}
                                    {!task.due && (
                                        <span className="text-[9px] text-white/20 flex-shrink-0">—</span>
                                    )}
                                </div>

                                {/* Day cells */}
                                {dayISOs.map(iso => {
                                    const isToday = iso === todayStr;
                                    const isDue   = task.due === iso;
                                    const d = days[dayISOs.indexOf(iso)];
                                    const isWeekend = d?.getDay() === 0 || d?.getDay() === 6;

                                    return (
                                        <div key={iso}
                                            className={`flex items-center justify-center border-r border-white/5 last:border-r-0 min-h-[38px] px-1 py-1
                                                ${isToday ? 'bg-cyan-500/5' : isWeekend ? 'bg-white/[0.01]' : ''}`}
                                            style={{ width: colW, minWidth: colW }}>
                                            {isDue && (
                                                <DueMark task={task} compact={compact} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                </div>
            </div>
        </div>

        {/* ── Task Card Modal ─────────────────────────────────────────── */}
        {selectedTask && createPortal(
            <div
                className="fixed inset-0 z-50 flex items-center justify-center"
                onClick={() => setSelectedTask(null)}
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                {/* Card wrapper */}
                <div
                    className="relative z-10 w-full max-w-2xl px-4"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Close button */}
                    <button
                        onClick={() => setSelectedTask(null)}
                        className="absolute -top-3 -right-1 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    <TaskCard
                        task={selectedTask}
                        onDragStart={() => {}}
                        onClick={() => {}}
                        onContextMenu={(e, task) => {
                            setSelectedTask(null);
                            onTaskClick(task, e.clientX, e.clientY);
                        }}
                        onSetProjectDirectory={() => setSelectedTask(null)}
                    />
                </div>
            </div>,
            document.body
        )}
        </>
    );
}

// ── DueMark ───────────────────────────────────────────────────────────────

interface DueMarkProps {
    task: Task;
    compact: boolean;
}

function DueMark({ task, compact }: DueMarkProps) {
    const bg     = STATUS_COLOR[task.status]  ?? STATUS_COLOR.todo;
    const border = STATUS_BORDER[task.status] ?? STATUS_BORDER.todo;

    if (compact) {
        return (
            <div
                className="h-5 w-5 rounded-full hover:scale-125 transition-transform flex items-center justify-center"
                style={{ backgroundColor: bg, border: `2px solid ${border}` }}
                title={`${task.title} — ${STATUS_LABEL[task.status]}`}
            >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} />
            </div>
        );
    }

    return (
        <div
            className="w-full rounded-md hover:brightness-125 hover:scale-[1.03] transition-all flex items-center gap-1.5 px-2 py-1.5"
            style={{ backgroundColor: bg, border: `1px solid ${border}60` }}
            title={`${task.title} — ${STATUS_LABEL[task.status]}`}
        >
            <span className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} />
            <span className="text-[10px] font-bold text-white/90 truncate leading-none">
                {STATUS_LABEL[task.status]}
            </span>
        </div>
    );
}
