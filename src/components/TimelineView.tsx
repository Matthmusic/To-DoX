import { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, CalendarDays, Calendar, X, MousePointerClick } from 'lucide-react';
import type { Task, GanttDay, User } from '../types';
import useStore from '../store/useStore';
import { useTheme } from '../hooks/useTheme';
import { TaskCard } from './TaskCard';

interface TimelineViewProps {
    filteredTasks: Task[];
    onTaskClick: (task: Task, x: number, y: number) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
    todo:   'rgba(59,130,246,0.65)',
    doing:  'rgba(34,211,238,0.65)',
    review: 'rgba(234,179,8,0.65)',
    done:   'rgba(34,197,94,0.45)',
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
// Doit correspondre EXACTEMENT à l'ordre de PROJECT_COLORS dans constants.ts
// pour que les couleurs soient cohérentes entre le Kanban et la Timeline
const PROJECT_PALETTE = [
    '#60a5fa', // [0] blue-400
    '#22d3ee', // [1] cyan-400
    '#34d399', // [2] emerald-400
    '#facc15', // [3] yellow-400
    '#fb923c', // [4] orange-400
    '#fb7185', // [5] rose-400
    '#c084fc', // [6] purple-400
    '#818cf8', // [7] indigo-400
    '#94a3b8', // [8] slate-400
];

// Palette séparée pour les avatars utilisateurs (plus vibrante)
const USER_PALETTE = [
    '#22d3ee', '#a78bfa', '#34d399', '#f59e0b',
    '#f87171', '#60a5fa', '#fb923c', '#e879f9',
    '#818cf8', '#2dd4bf',
];
const MONTH_FR    = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTH_SHORT = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
const DAY_SHORT   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

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

function getUserColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash) + userId.charCodeAt(i);
        hash |= 0;
    }
    return USER_PALETTE[Math.abs(hash) % USER_PALETTE.length];
}

function getUserInitials(user: User): string {
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return user.name.substring(0, 2).toUpperCase();
}

/** ISO week number (01–53) */
function getWeekNumber(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return String(Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)).padStart(2, '0');
}

/** Gradient backgrounds for Gantt bars — brighter leading edge suggests progress direction */
const STATUS_GRADIENT: Record<string, string> = {
    todo:   'linear-gradient(90deg, rgba(96,165,250,0.85) 0%, rgba(59,130,246,0.52) 100%)',
    doing:  'linear-gradient(90deg, rgba(103,232,249,0.85) 0%, rgba(34,211,238,0.52) 100%)',
    review: 'linear-gradient(90deg, rgba(253,224,71,0.85)  0%, rgba(234,179,8,0.52)  100%)',
    done:   'linear-gradient(90deg, rgba(74,222,128,0.55)  0%, rgba(34,197,94,0.32)  100%)',
};

// Layout constants
const SIDE_W = 380;
const COL_W: Record<ViewMode, number> = { '4weeks': 110, month: 52 };

// Row types for flat rendering
type ProjectRow = {
    type: 'project';
    project: string;
    color: string;
    count: number;
    barStartIdx: number;
    barEndIdx: number;
    barLeftCapped: boolean;
    barRightCapped: boolean;
};
type TaskRow = { type: 'task'; task: Task; project: string; isLast: boolean };
type FlatRow = ProjectRow | TaskRow;

// Active cell popover state
interface ActiveCell {
    taskId: string;
    date: string;
    rect: DOMRect;
}

// Drag-to-range state
interface DragState {
    taskId: string;
    startDate: string;
    currentDate: string;
    /** toujours 'add' — la suppression se fait via le popover */
    mode: 'add';
    /** userIds hérités de la cellule source (si elle était planifiée) */
    sourceUserIds?: string[];
    startRect: DOMRect;
    /** Ctrl enfoncé au mousedown → sélection multiple */
    ctrlKey: boolean;
}

// ── GanttCellPopover ──────────────────────────────────────────────────────

interface GanttCellPopoverProps {
    activeCell: ActiveCell;
    filteredTasks: Task[];
    users: User[];
    onClose: () => void;
    onSetGanttUsers: (taskId: string, date: string, userIds: string[]) => void;
    onRemoveGanttDay: (taskId: string, date: string) => void;
}

function GanttCellPopover({
    activeCell, filteredTasks, users, onClose, onSetGanttUsers, onRemoveGanttDay,
}: GanttCellPopoverProps) {
    const task = filteredTasks.find(t => t.id === activeCell.taskId);
    const panelRef = useRef<HTMLDivElement>(null);

    // Ferme sur mousedown hors du panel, et sur contextmenu hors du panel
    // (sans preventDefault sur contextmenu → les cellules reçoivent l'event)
    useEffect(() => {
        const handleOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleOutside, true);
        document.addEventListener('contextmenu', handleOutside, true);
        return () => {
            document.removeEventListener('mousedown', handleOutside, true);
            document.removeEventListener('contextmenu', handleOutside, true);
        };
    }, [onClose]);

    if (!task) return null;

    const ganttDays  = task.ganttDays ?? [];
    const ganttDay   = ganttDays.find(d => d.date === activeCell.date);
    const isPlanned  = !!ganttDay;
    const assigneeIds = ganttDay?.userIds ?? [];

    const POPOVER_W = 220;
    const { rect } = activeCell;
    const left  = Math.min(Math.max(8, rect.left), window.innerWidth - POPOVER_W - 8);
    const below = rect.bottom + 260 < window.innerHeight;
    const top   = below ? rect.bottom + 4 : rect.top - 264;

    // Propose only the task's assignees; fallback to all users
    const taskUsers = task.assignedTo.length > 0
        ? users.filter(u => task.assignedTo.includes(u.id))
        : users;

    const toggleUser = (userId: string) => {
        const isSelected = assigneeIds.includes(userId);
        const newIds = isSelected
            ? assigneeIds.filter(id => id !== userId)
            : [...assigneeIds, userId];
        onSetGanttUsers(activeCell.taskId, activeCell.date, newIds);
        // Ne pas fermer → multi-sélection
    };

    return createPortal(
        <>

            {/* Popover */}
            <div
                ref={panelRef}
                className="fixed z-50 rounded-xl border border-white/15 shadow-2xl overflow-hidden"
                style={{ left, top, width: POPOVER_W, backgroundColor: 'var(--bg-secondary)' }}
                onMouseDown={e => e.stopPropagation()}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
            >
                {/* Header */}
                <div className="px-3 pt-2.5 pb-2 border-b border-white/10">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                        {formatShortDate(activeCell.date)}
                    </p>
                    <p className="text-xs font-semibold text-white/70 truncate mt-0.5">
                        {task.title}
                    </p>
                    {assigneeIds.length > 0 && (
                        <p className="text-[10px] text-white/35 mt-0.5">
                            {assigneeIds.length} assigné{assigneeIds.length > 1 ? 's' : ''}
                        </p>
                    )}
                </div>

                {/* User picker — multi-select */}
                <div className="p-1.5 flex flex-col gap-0.5 max-h-52 overflow-y-auto">
                    {/* Aucun assigné (clear) */}
                    <button
                        onClick={() => { onSetGanttUsers(activeCell.taskId, activeCell.date, []); onClose(); }}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left w-full ${
                            isPlanned && assigneeIds.length === 0
                                ? 'bg-white/10 text-white/90'
                                : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
                        }`}
                    >
                        <div className="h-5 w-5 rounded-full border border-white/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-[8px] text-white/30">—</span>
                        </div>
                        <span className="truncate flex-1">Aucun assigné</span>
                        {isPlanned && assigneeIds.length === 0 && (
                            <span className="text-white/40 text-[10px]">✓</span>
                        )}
                    </button>

                    {/* Users — checkboxes */}
                    {taskUsers.map(user => {
                        const isSelected = assigneeIds.includes(user.id);
                        return (
                            <button
                                key={user.id}
                                onClick={() => toggleUser(user.id)}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left w-full ${
                                    isSelected
                                        ? 'bg-white/10 text-white/90'
                                        : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
                                }`}
                            >
                                <div
                                    className="h-5 w-5 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white"
                                    style={{ backgroundColor: getUserColor(user.id) }}
                                >
                                    {getUserInitials(user)}
                                </div>
                                <span className="truncate flex-1">{user.name.split(' ')[0]}</span>
                                {/* Checkbox visuel */}
                                <div className={`h-4 w-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                                    isSelected
                                        ? 'border-transparent bg-white/30'
                                        : 'border-white/20 bg-transparent'
                                }`}>
                                    {isSelected && (
                                        <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none" stroke="white" strokeWidth="2">
                                            <polyline points="1.5,5 4,7.5 8.5,2" />
                                        </svg>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Remove */}
                {isPlanned && (
                    <div className="px-1.5 pb-1.5 pt-1 border-t border-white/10">
                        <button
                            onClick={() => { onRemoveGanttDay(activeCell.taskId, activeCell.date); onClose(); }}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors w-full"
                        >
                            Retirer ce jour
                        </button>
                    </div>
                )}
            </div>
        </>,
        document.body
    );
}

// ── Main component ─────────────────────────────────────────────────────────

/**
 * Vue Gantt — barres de travail planifiées par tâche, regroupées par projet.
 *
 * - Cliquer sur une cellule de jour (ligne tâche) → choisir l'assigné ou retirer
 * - Cliquer sur le titre de la tâche (colonne gauche) → ouvrir la fiche tâche
 * - La ligne projet affiche une barre allant du premier jour planifié (ou première
 *   échéance) jusqu'à la dernière échéance des tâches du projet.
 */
export function TimelineView({ filteredTasks, onTaskClick }: TimelineViewProps) {
    const { projectColors, updateTask, users } = useStore();
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;

    const [viewMode, setViewMode]         = useState<ViewMode>('4weeks');
    const [offset, setOffset]             = useState(0);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [activeCell, setActiveCell]     = useState<ActiveCell | null>(null);
    // Sélection multi-cellules : Set de clés "taskId:date"
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

    const todayStr = useMemo(() => toISO(new Date()), []);

    // ── Day columns ───────────────────────────────────────────────────────
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
            const n   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
            return Array.from({ length: n }, (_, i) =>
                new Date(ref.getFullYear(), ref.getMonth(), i + 1)
            );
        }
    }, [viewMode, offset]);

    const dayISOs    = useMemo(() => days.map(toISO), [days]);
    const rangeStart = dayISOs[0];
    const rangeEnd   = dayISOs[dayISOs.length - 1];

    const periodLabel = useMemo(() => {
        const s = days[0], e = days[days.length - 1];
        if (viewMode === '4weeks')
            return `${s.getDate()} ${MONTH_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTH_SHORT[e.getMonth()]} ${e.getFullYear()}`;
        return `${MONTH_FR[s.getMonth()]} ${s.getFullYear()}`;
    }, [viewMode, days]);

    // ── Helpers ───────────────────────────────────────────────────────────
    function getProjectColor(project: string): string {
        if (project in projectColors) {
            return PROJECT_PALETTE[projectColors[project] % PROJECT_PALETTE.length];
        }
        // Fallback hash identique à utils.ts getProjectColor
        let hash = 0;
        for (let i = 0; i < project.length; i++) {
            hash = project.charCodeAt(i) + ((hash << 5) - hash);
        }
        return PROJECT_PALETTE[Math.abs(hash) % PROJECT_PALETTE.length];
    }

    // ── Gantt day store actions ───────────────────────────────────────────
    // Applique une affectation à une cellule (helper interne)
    const applyGanttUsers = (taskId: string, date: string, userIds: string[]) => {
        const task = useStore.getState().tasks.find(t => t.id === taskId);
        if (!task) return;
        const current  = task.ganttDays ?? [];
        const existing = current.find(d => d.date === date);
        const newUserIds = userIds.length > 0 ? userIds : undefined;
        let next: GanttDay[];
        if (existing) {
            next = current.map(d => d.date === date ? { ...d, userIds: newUserIds } : d);
        } else {
            next = [...current, { date, userIds: newUserIds }].sort((a, b) => a.date.localeCompare(b.date));
        }
        updateTask(taskId, { ganttDays: next });
    };

    // Si la cellule cliquée fait partie d'une multi-sélection → applique à toutes
    const setGanttUsers = (taskId: string, date: string, userIds: string[]) => {
        const key = `${taskId}:${date}`;
        if (selectedCells.has(key) && selectedCells.size > 1) {
            selectedCells.forEach(k => {
                const colonIdx = k.indexOf(':');
                applyGanttUsers(k.slice(0, colonIdx), k.slice(colonIdx + 1), userIds);
            });
        } else {
            applyGanttUsers(taskId, date, userIds);
        }
    };

    const removeGanttDay = (taskId: string, date: string) => {
        const task = useStore.getState().tasks.find(t => t.id === taskId);
        if (!task) return;
        updateTask(taskId, { ganttDays: (task.ganttDays ?? []).filter(d => d.date !== date) });
    };

    // ── Drag-to-range ─────────────────────────────────────────────────────
    const dragRef      = useRef<DragState | null>(null);
    const [dragVisual, setDragVisual] = useState<DragState | null>(null);

    // Always-fresh refs so the stable mouseup effect can read current values
    const filteredTasksRef = useRef(filteredTasks);
    filteredTasksRef.current = filteredTasks;
    const dayISOsRef = useRef(dayISOs);
    dayISOsRef.current = dayISOs;

    // Global mouseup: commit drag or open single-cell popover
    useEffect(() => {
        const handleMouseUp = () => {
            const drag = dragRef.current;
            if (!drag) return;

            if (drag.startDate === drag.currentDate) {
                // No movement → single click → sélection (+ Ctrl = multi)
                const key = `${drag.taskId}:${drag.startDate}`;
                setSelectedCells(prev => {
                    const next = drag.ctrlKey ? new Set(prev) : new Set<string>();
                    if (next.has(key)) next.delete(key); else next.add(key);
                    return next;
                });
            } else {
                // Range drag → plan or remove (lecture depuis le store, pas depuis filteredTasksRef stale)
                const task = useStore.getState().tasks.find(t => t.id === drag.taskId);
                if (task) {
                    const [minDate, maxDate] = drag.startDate < drag.currentDate
                        ? [drag.startDate, drag.currentDate]
                        : [drag.currentDate, drag.startDate];
                    const dates = dayISOsRef.current.filter(iso => iso >= minDate && iso <= maxDate);

                    const current = task.ganttDays ?? [];
                    const newEntries: GanttDay[] = dates
                        .filter(d => !current.some(g => g.date === d))
                        .map(d => ({ date: d, userIds: drag.sourceUserIds }));
                    const updated = [...current, ...newEntries]
                        .sort((a, b) => a.date.localeCompare(b.date));
                    updateTask(drag.taskId, { ganttDays: updated });
                }
            }

            dragRef.current = null;
            setDragVisual(null);
        };

        document.addEventListener('mouseup', handleMouseUp);
        return () => document.removeEventListener('mouseup', handleMouseUp);
    }, []); // Stable — reads only refs, never stale

    // Suppr / Delete → retire tous les jours gantt sélectionnés
    const selectedCellsRef = useRef(selectedCells);
    selectedCellsRef.current = selectedCells;
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Delete' && e.key !== 'Backspace') return;
            const cells = selectedCellsRef.current;
            if (cells.size === 0) return;
            // Ne pas intercepter si le focus est dans un input
            const tag = (document.activeElement as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            e.preventDefault();
            cells.forEach(key => {
                const [taskId, date] = key.split(':');
                removeGanttDay(taskId, date);
            });
            setSelectedCells(new Set());
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleCellMouseDown = (e: React.MouseEvent<HTMLDivElement>, task: Task, iso: string) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const sourceDay = (task.ganttDays ?? []).find(d => d.date === iso);
        const state: DragState = {
            taskId: task.id,
            startDate: iso,
            currentDate: iso,
            mode: 'add',
            sourceUserIds: sourceDay?.userIds,
            startRect: e.currentTarget.getBoundingClientRect(),
            ctrlKey: e.ctrlKey || e.metaKey,
        };
        dragRef.current = state;
        setDragVisual(state);
    };

    const handleCellMouseEnter = (task: Task, iso: string) => {
        const drag = dragRef.current;
        if (!drag || drag.taskId !== task.id || drag.currentDate === iso) return;
        const updated = { ...drag, currentDate: iso };
        dragRef.current = updated;
        setDragVisual(updated);
    };

    // ── Flat rows with project bars ───────────────────────────────────────
    const flatRows = useMemo((): FlatRow[] => {
        const groups = new Map<string, Task[]>();
        for (const t of filteredTasks) {
            const proj = t.project || 'Sans projet';
            if (!groups.has(proj)) groups.set(proj, []);
            groups.get(proj)!.push(t);
        }

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

            const allGanttDates = tasks.flatMap(t => (t.ganttDays ?? []).map(d => d.date));
            const allDues       = tasks.map(t => t.due).filter((d): d is string => d !== null);
            let barStartIdx     = -1;
            let barEndIdx       = -1;
            let barLeftCapped   = true;
            let barRightCapped  = true;

            if (allDues.length > 0) {
                const allDates  = [...allGanttDates, ...allDues].sort();
                const spanStart = allDates[0];
                const spanEnd   = [...allDues].sort().at(-1)!;

                if (spanEnd >= rangeStart && spanStart <= rangeEnd) {
                    barLeftCapped  = spanStart >= rangeStart;
                    barRightCapped = spanEnd   <= rangeEnd;
                    const cs = spanStart < rangeStart ? rangeStart : spanStart;
                    const ce = spanEnd   > rangeEnd   ? rangeEnd   : spanEnd;
                    barStartIdx = dayISOs.indexOf(cs);
                    barEndIdx   = dayISOs.indexOf(ce);
                }
            }

            rows.push({ type: 'project', project, color, count: tasks.length, barStartIdx, barEndIdx, barLeftCapped, barRightCapped });
            tasks.forEach((task, i) =>
                rows.push({ type: 'task', task, project, isLast: i === tasks.length - 1 })
            );
        }
        return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredTasks, projectColors, dayISOs]);

    const compact = viewMode === 'month';
    const colW    = COL_W[viewMode];

    function switchView(mode: ViewMode) { setViewMode(mode); setOffset(0); }

    // ── Render ────────────────────────────────────────────────────────────
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

                <span className="hidden lg:flex items-center gap-1.5 text-[10px] text-white/25 font-medium ml-1">
                    <MousePointerClick className="h-3 w-3" />
                    Cliquer sur un jour pour planifier / assigner
                </span>

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
            <div className="flex-1 overflow-auto rounded-2xl border border-white/10 bg-theme-bg-secondary"
                onClick={e => { if (e.target === e.currentTarget) setSelectedCells(new Set()); }}>
                <div style={{ minWidth: `${SIDE_W + colW * days.length}px` }}>

                    {/* ── Header row ── */}
                    <div className="flex sticky top-0 z-20 border-b border-white/10"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        <div className="sticky left-0 z-30 px-4 py-2 border-r border-white/10
                            text-[10px] font-bold text-white/25 uppercase tracking-widest flex items-end"
                            style={{ width: SIDE_W, minWidth: SIDE_W, backgroundColor: 'var(--bg-secondary)' }}>
                            Projet / Tâche
                        </div>
                        {days.map(day => {
                            const iso       = toISO(day);
                            const isToday   = iso === todayStr;
                            const isMonday  = day.getDay() === 1;
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                            const isSat     = day.getDay() === 6;
                            return (
                                <div key={iso}
                                    className={`relative flex flex-col items-center justify-end border-r border-white/5 last:border-r-0
                                        ${isToday   ? 'bg-cyan-500/20'  : ''}
                                        ${isWeekend ? 'bg-black/[0.22]' : ''}
                                        ${isMonday && !isToday ? 'border-l border-l-white/20' : ''}
                                        ${isSat ? 'border-r border-r-white/10' : ''}`}
                                    style={{ width: colW, minWidth: colW, paddingBottom: '8px', paddingTop: '10px' }}>

                                    {/* Today top accent bar */}
                                    {isToday && (
                                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-cyan-400 rounded-b" />
                                    )}

                                    {/* Week number — Mondays only, 4weeks mode */}
                                    {isMonday && !compact && (
                                        <span className="absolute top-[5px] left-0 right-0 text-center"
                                            style={{
                                                fontSize: '7px', fontWeight: 700,
                                                letterSpacing: '0.08em', textTransform: 'uppercase',
                                                color: isToday ? 'rgba(34,211,238,0.55)' : 'rgba(255,255,255,0.16)',
                                            }}>
                                            S{getWeekNumber(day)}
                                        </span>
                                    )}

                                    {/* Month label on 1st */}
                                    {day.getDate() === 1 && (
                                        <span className="text-[8px] font-bold uppercase tracking-wider text-white/45 leading-none mb-1">
                                            {MONTH_SHORT[day.getMonth()]}
                                        </span>
                                    )}

                                    {/* Day name */}
                                    <span className={`text-[9px] font-bold uppercase tracking-wider leading-none mb-1
                                        ${isToday ? 'text-cyan-400' : isWeekend ? 'text-white/20' : 'text-white/35'}`}>
                                        {DAY_SHORT[day.getDay()]}
                                    </span>

                                    {/* Day number — circle for today */}
                                    {isToday ? (
                                        <div className="h-[22px] w-[22px] rounded-full bg-cyan-400 flex items-center justify-center">
                                            <span className="text-[11px] font-black text-black leading-none">
                                                {day.getDate()}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className={`font-bold leading-none
                                            ${compact ? 'text-xs' : 'text-sm'}
                                            ${isWeekend ? 'text-white/25' : 'text-white/70'}`}>
                                            {day.getDate()}
                                        </span>
                                    )}
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

                    {/* ── Rows ── */}
                    {flatRows.map((row, rowIdx) => {

                        // ── Project header ────────────────────────────
                        if (row.type === 'project') {
                            return (
                                <div key={`proj-${row.project}`}
                                    className="group flex border-b border-white/10 transition-colors"
                                    style={{ backgroundColor: `${row.color}18` }}>

                                    <div className="sticky left-0 z-10 px-4 py-2.5 border-r border-white/10 flex items-center gap-2 overflow-hidden"
                                        style={{ width: SIDE_W, minWidth: SIDE_W, backgroundColor: `${row.color}30`, borderLeft: `3px solid ${row.color}` }}>
                                        {/* Glow hover dynamique couleur projet */}
                                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none blur-xl rounded-xl"
                                            style={{ backgroundColor: `${row.color}60` }} />
                                        <div className="h-3 w-3 rounded flex-shrink-0 relative"
                                            style={{ backgroundColor: row.color }} />
                                        <span className="text-xs font-black tracking-widest uppercase relative"
                                            style={{ color: row.color }}>
                                            {row.project}
                                        </span>
                                        <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full relative"
                                            style={{ backgroundColor: `${row.color}20`, color: row.color }}>
                                            {row.count}
                                        </span>
                                    </div>

                                    {dayISOs.map((iso, colIdx) => {
                                        const isToday    = iso === todayStr;
                                        const inBar      = row.barStartIdx !== -1 && colIdx >= row.barStartIdx && colIdx <= row.barEndIdx;
                                        const isBarStart = colIdx === row.barStartIdx;
                                        const isBarEnd   = colIdx === row.barEndIdx;

                                        return (
                                            <div key={iso}
                                                className={`relative border-r border-white/5 last:border-r-0 flex items-center
                                                ${isToday ? 'bg-cyan-500/10' : ''}`}
                                                style={{ width: colW, minWidth: colW, height: '42px' }}>

                                                {inBar ? (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                        height: compact ? '6px' : '11px',
                                                        left: isBarStart ? '5px' : '0',
                                                        right: isBarEnd ? '5px' : '0',
                                                        background: `linear-gradient(90deg, ${row.color}80 0%, ${row.color}42 100%)`,
                                                        borderTop:    `1px solid ${row.color}80`,
                                                        borderBottom: `1px solid ${row.color}80`,
                                                        borderLeft:   isBarStart ? `1px solid ${row.color}80` : 'none',
                                                        borderRight:  isBarEnd   ? `1px solid ${row.color}80` : 'none',
                                                        borderRadius: (isBarStart && isBarEnd) ? '5px'
                                                            : isBarStart && row.barLeftCapped  ? '5px 0 0 5px'
                                                            : isBarEnd   && row.barRightCapped ? '0 5px 5px 0'
                                                            : '0',
                                                    }} />
                                                ) : (
                                                    <div className="h-px w-full mx-2" style={{ backgroundColor: `${row.color}22` }} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        }

                        // ── Task row ──────────────────────────────────
                        const { task, isLast } = row;
                        const isDueBefore  = task.due ? task.due < rangeStart : false;
                        const isDueAfter   = task.due ? task.due > rangeEnd   : false;
                        const isEven       = rowIdx % 2 === 0;
                        const ganttDays    = task.ganttDays ?? [];

                        // Distinct assigned users for sidebar badge
                        const assigneeIds = [...new Set(
                            ganttDays.flatMap(d => d.userIds ?? [])
                        )];
                        const assigneeUsers = assigneeIds
                            .map(id => users.find(u => u.id === id))
                            .filter((u): u is User => !!u);

                        return (
                            <div key={task.id}
                                className={`flex border-b ${isLast ? 'border-white/10' : 'border-white/[0.05]'} transition-colors`}
                                style={isEven ? { backgroundColor: 'rgba(255,255,255,0.025)' } : {}}>

                                {/* Task label — click opens task modal */}
                                <div
                                    className="sticky left-0 z-10 px-4 py-2 border-r border-white/10
                                        flex items-center gap-2 cursor-pointer group/label
                                        hover:bg-white/[0.04] transition-colors"
                                    style={{ width: SIDE_W, minWidth: SIDE_W, backgroundColor: 'var(--bg-secondary)' }}
                                    onClick={() => setSelectedTask(task)}
                                    onContextMenu={e => { e.preventDefault(); onTaskClick(task, e.clientX, e.clientY); }}
                                >
                                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
                                        <span className="text-white/15 text-xs">└</span>
                                        <span className="h-2 w-2 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} />
                                    </div>

                                    <span className={`text-xs font-medium leading-snug truncate flex-1
                                        ${task.status === 'done' ? 'line-through text-white/35' : 'text-white/80'}
                                        group-hover/label:text-white/95 transition-colors`}
                                        title={task.title}>
                                        {task.title}
                                    </span>

                                    {/* Planned days + assignee avatars */}
                                    {ganttDays.length > 0 && (
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <span className="text-[9px] font-bold"
                                                style={{ color: STATUS_BORDER[task.status] }}>
                                                {ganttDays.length}j
                                            </span>
                                            {assigneeUsers.slice(0, 2).map(u => (
                                                <div key={u.id}
                                                    className="h-3.5 w-3.5 rounded-full flex items-center justify-center text-[6px] font-bold text-white"
                                                    style={{ backgroundColor: getUserColor(u.id) }}
                                                    title={u.name}>
                                                    {getUserInitials(u)}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Out-of-range indicators */}
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

                                {/* Day cells — mousedown+drag to range-plan, click to open picker */}
                                {dayISOs.map((iso, colIdx) => {
                                    const isToday    = iso === todayStr;
                                    const isDue      = task.due === iso;
                                    const isWeekend  = days[colIdx]?.getDay() === 0 || days[colIdx]?.getDay() === 6;
                                    const isSelected = selectedCells.has(`${task.id}:${iso}`);

                                    const ganttDayObj   = ganttDays.find(d => d.date === iso);
                                    const isPlanned     = !!ganttDayObj;
                                    const cellUserIds   = ganttDayObj?.userIds ?? [];
                                    const assignedUsers = cellUserIds
                                        .map(id => users.find(u => u.id === id))
                                        .filter((u): u is User => !!u);

                                    const isPrevPlanned = colIdx > 0 && ganttDays.some(d => d.date === dayISOs[colIdx - 1]);
                                    const isNextPlanned = colIdx < dayISOs.length - 1 && ganttDays.some(d => d.date === dayISOs[colIdx + 1]);
                                    const isSegStart    = isPlanned && !isPrevPlanned;
                                    const isSegEnd      = isPlanned && !isNextPlanned;

                                    // Drag visual state for this cell
                                    let isDragPreview = false, isDragPreviewStart = false, isDragPreviewEnd = false;
                                    let isDragAdd = false;
                                    if (dragVisual?.taskId === task.id && dragVisual.startDate !== dragVisual.currentDate) {
                                        const [minD, maxD] = dragVisual.startDate < dragVisual.currentDate
                                            ? [dragVisual.startDate, dragVisual.currentDate]
                                            : [dragVisual.currentDate, dragVisual.startDate];
                                        isDragPreview      = iso >= minD && iso <= maxD;
                                        isDragPreviewStart = iso === minD;
                                        isDragPreviewEnd   = iso === maxD;
                                        isDragAdd          = isDragPreview;
                                    }

                                    const bg  = STATUS_COLOR[task.status];
                                    const bdr = STATUS_BORDER[task.status];

                                    const barRadius = (s: boolean, e: boolean) =>
                                        (s && e) ? '6px' : s ? '6px 0 0 6px' : e ? '0 6px 6px 0' : '0';

                                    return (
                                        <div
                                            key={iso}
                                            className={`group/gcell relative border-r border-white/5 last:border-r-0 min-h-[48px] select-none
                                                ${isToday   ? 'bg-cyan-500/10'  : ''}
                                                ${isWeekend ? 'bg-black/[0.18]' : ''}
                                                ${isSelected ? 'ring-1 ring-inset ring-white/20' : ''}`}
                                            style={{
                                                width: colW, minWidth: colW,
                                                cursor: dragVisual?.taskId === task.id ? 'crosshair' : 'pointer',
                                            }}
                                            onMouseDown={e => handleCellMouseDown(e, task, iso)}
                                            onMouseEnter={() => handleCellMouseEnter(task, iso)}
                                            onContextMenu={e => { e.preventDefault(); setActiveCell({ taskId: task.id, date: iso, rect: e.currentTarget.getBoundingClientRect() }); }}
                                            title={isPlanned
                                                ? `Cliquer pour modifier${assignedUsers.length > 0 ? ` (${assignedUsers.map(u => u.name.split(' ')[0]).join(', ')})` : ''} · Glisser pour étendre`
                                                : 'Cliquer pour planifier · Glisser pour une plage'}
                                        >
                                            {/* Hover ghost (empty, non-drag) */}
                                            {!isPlanned && !isDragAdd && (
                                                <div className="absolute inset-y-2 inset-x-0.5 rounded opacity-0 group-hover/gcell:opacity-100 transition-opacity pointer-events-none"
                                                    style={{ backgroundColor: `${bg}18` }} />
                                            )}

                                            {/* Gantt bar segment */}
                                            {isPlanned && (
                                                <div className="pointer-events-none" style={{
                                                    position: 'absolute',
                                                    top:    compact ? '9px' : '5px',
                                                    bottom: compact ? '9px' : '5px',
                                                    left:   isSegStart ? '4px' : '0',
                                                    right:  isSegEnd   ? '4px' : '0',
                                                    background: STATUS_GRADIENT[task.status] ?? bg,
                                                    borderTop:    `1px solid ${bdr}65`,
                                                    borderBottom: `1px solid ${bdr}65`,
                                                    borderLeft:   isSegStart ? `1px solid ${bdr}65` : 'none',
                                                    borderRight:  isSegEnd   ? `1px solid ${bdr}65` : 'none',
                                                    borderRadius: barRadius(isSegStart, isSegEnd),
                                                }} />
                                            )}

                                            {/* Hover darken on planned cell */}
                                            {isPlanned && (
                                                <div className="absolute opacity-0 group-hover/gcell:opacity-100 transition-opacity pointer-events-none bg-black/20"
                                                    style={{
                                                        top:    compact ? '9px' : '7px',
                                                        bottom: compact ? '9px' : '7px',
                                                        left:   isSegStart ? '4px' : '0',
                                                        right:  isSegEnd   ? '4px' : '0',
                                                        borderRadius: barRadius(isSegStart, isSegEnd),
                                                    }} />
                                            )}

                                            {/* Drag ADD preview bar */}
                                            {isDragAdd && !isPlanned && (
                                                <div className="pointer-events-none" style={{
                                                    position: 'absolute',
                                                    top:    compact ? '9px' : '7px',
                                                    bottom: compact ? '9px' : '7px',
                                                    left:   isDragPreviewStart ? '4px' : '0',
                                                    right:  isDragPreviewEnd   ? '4px' : '0',
                                                    backgroundColor: `${bg}45`,
                                                    border: `1px dashed ${bdr}70`,
                                                    borderLeft:   isDragPreviewStart ? undefined : 'none',
                                                    borderRight:  isDragPreviewEnd   ? undefined : 'none',
                                                    borderRadius: barRadius(isDragPreviewStart, isDragPreviewEnd),
                                                }} />
                                            )}


                                            {/* Assignee avatars on bar (chaque cellule planifiée) */}
                                            {isPlanned && assignedUsers.length > 0 && !compact && (
                                                <div className="absolute top-1/2 -translate-y-1/2 z-10 flex pointer-events-none"
                                                    style={{ left: '8px' }}>
                                                    {assignedUsers.slice(0, 3).map((user, i) => (
                                                        <div
                                                            key={user.id}
                                                            className="h-4 w-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white ring-1 ring-black/40"
                                                            style={{
                                                                backgroundColor: getUserColor(user.id),
                                                                marginLeft: i === 0 ? 0 : '-4px',
                                                                zIndex: assignedUsers.length - i,
                                                            }}
                                                            title={user.name}>
                                                            {getUserInitials(user)}
                                                        </div>
                                                    ))}
                                                    {assignedUsers.length > 3 && (
                                                        <div
                                                            className="h-4 w-4 rounded-full flex items-center justify-center text-[6px] font-bold text-white ring-1 ring-black/40 bg-white/25"
                                                            style={{ marginLeft: '-4px' }}>
                                                            +{assignedUsers.length - 3}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Due date dot */}
                                            {isDue && (
                                                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
                                                    title={`Échéance : ${formatShortDate(task.due!)}`}>
                                                    <div
                                                        className={`rounded-full ring-1 ring-black/40 ${compact ? 'h-1.5 w-1.5' : 'h-2 w-2'}`}
                                                        style={{ backgroundColor: bdr }} />
                                                </div>
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

        {/* ── Gantt cell popover ───────────────────────────────────────── */}
        {activeCell && (
            <GanttCellPopover
                activeCell={activeCell}
                filteredTasks={filteredTasks}
                users={users}
                onClose={() => setActiveCell(null)}
                onSetGanttUsers={setGanttUsers}
                onRemoveGanttDay={removeGanttDay}
            />
        )}

        {/* ── Task Card Modal ──────────────────────────────────────────── */}
        {selectedTask && createPortal(
            <div
                className="fixed inset-0 z-50 flex items-center justify-center"
                onClick={() => setSelectedTask(null)}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div
                    className="relative z-10 w-full max-w-2xl px-4"
                    onClick={e => e.stopPropagation()}
                >
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
