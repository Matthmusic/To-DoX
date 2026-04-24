import { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, X, Monitor, ExternalLink } from 'lucide-react';
import type { Task, GanttDay, User, OutlookEvent } from '../types';
import useStore from '../store/useStore';
import { PROJECT_HEX_COLORS } from '../constants';
import { useTheme } from '../hooks/useTheme';
import { TaskCard } from './TaskCard';
import {
    STATUS_COLOR, STATUS_BORDER, SIDE_W, MIN_COL_W, MONTH_SHORT, DAY_SHORT,
    toISO, getMondayOf, formatShortDate, addDaysIso, getUserColor, getUserInitials, getWeekNumber,
    MONTH_FR, PRIORITY_COLOR,
    type ViewMode, type FlatRow, type ActiveCell, type DragState,
} from './timeline/timeline.utils';
import { GanttCellPopover } from './timeline/GanttCellPopover';
import { GanttToolbar } from './timeline/GanttToolbar';
import { OutlookCalendarSection } from './timeline/OutlookCalendarSection';

interface TimelineViewProps {
    filteredTasks: Task[];
    onTaskClick: (task: Task, x: number, y: number) => void;
    icsExportPath?: string | null;
    selectedUserId?: string;
    onRefreshOutlook?: () => void;
    readOnly?: boolean;
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
export function TimelineView({ filteredTasks, onTaskClick, icsExportPath, selectedUserId, onRefreshOutlook, readOnly = false }: TimelineViewProps) {
    const { projectColors, updateTask, users, outlookConfig, outlookEvents } = useStore();
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;

    const [viewMode, setViewMode]         = useState<ViewMode>('2weeks');
    const [offset, setOffset]             = useState(0);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [activeCell, setActiveCell]     = useState<ActiveCell | null>(null);
    // Sélection multi-cellules : Set de clés "taskId:date"
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [outlookCollapsedByUser, setOutlookCollapsedByUser] = useState<Record<string, boolean>>({});
    const outlookUserKey = selectedUserId ?? '__all__';
    const outlookCollapsed = outlookCollapsedByUser[outlookUserKey] ?? false;
    const toggleOutlookCollapsed = () => setOutlookCollapsedByUser(prev => ({ ...prev, [outlookUserKey]: !prev[outlookUserKey] }));
    const [hoveredOutlookEvent, setHoveredOutlookEvent] = useState<{ ev: OutlookEvent; rect: DOMRect } | null>(null);
    const [showMonthPicker, setShowMonthPicker]         = useState(false);
    const [pickerYear, setPickerYear]                   = useState(new Date().getFullYear());
    const gridContainerRef  = useRef<HTMLDivElement>(null);
    const [gridWidth, setGridWidth] = useState(0);

    // Mesure la largeur disponible pour la grille (pour les colonnes responsives)
    useLayoutEffect(() => {
        const el = gridContainerRef.current;
        if (!el) return;
        setGridWidth(el.getBoundingClientRect().width);
        const ro = new ResizeObserver(entries => {
            setGridWidth(entries[0].contentRect.width);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const todayStr = useMemo(() => toISO(new Date()), []);

    // ── Day columns ───────────────────────────────────────────────────────
    const days = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (viewMode === '1week') {
            const start = getMondayOf(today);
            start.setDate(start.getDate() + offset * 7);
            return Array.from({ length: 7 }, (_, i) => {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                return d;
            });
        } else if (viewMode === '2weeks') {
            const start = getMondayOf(today);
            start.setDate(start.getDate() + offset * 14);
            return Array.from({ length: 14 }, (_, i) => {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                return d;
            });
        } else if (viewMode === 'rolling') {
            // Vue glissante : aujourd'hui en position 3/14
            const start = new Date(today);
            start.setDate(today.getDate() - 3 + offset * 14);
            return Array.from({ length: 14 }, (_, i) => {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                return d;
            });
        } else if (viewMode === '1month') {
            const ref = new Date(today.getFullYear(), today.getMonth() + offset, 1);
            const n   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
            return Array.from({ length: n }, (_, i) =>
                new Date(ref.getFullYear(), ref.getMonth(), i + 1)
            );
        } else { // '2months'
            const startRef = new Date(today.getFullYear(), today.getMonth() + offset * 2, 1);
            const endRef   = new Date(startRef.getFullYear(), startRef.getMonth() + 2, 0);
            const result: Date[] = [];
            const cursor = new Date(startRef);
            while (cursor <= endRef) {
                result.push(new Date(cursor));
                cursor.setDate(cursor.getDate() + 1);
            }
            return result;
        }
    }, [viewMode, offset]);

    const dayISOs    = useMemo(() => days.map(toISO), [days]);
    const rangeStart = dayISOs[0];
    const rangeEnd   = dayISOs[dayISOs.length - 1];

    const periodLabel = useMemo(() => {
        const s = days[0], e = days[days.length - 1];
        if (viewMode === '1week' || viewMode === '2weeks' || viewMode === 'rolling') {
            if (s.getMonth() === e.getMonth())
                return `${s.getDate()} – ${e.getDate()} ${MONTH_SHORT[s.getMonth()]} ${s.getFullYear()}`;
            return `${s.getDate()} ${MONTH_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTH_SHORT[e.getMonth()]} ${e.getFullYear()}`;
        }
        if (viewMode === '1month')
            return `${MONTH_FR[s.getMonth()]} ${s.getFullYear()}`;
        // 2months
        if (s.getFullYear() === e.getFullYear())
            return `${MONTH_SHORT[s.getMonth()]} – ${MONTH_SHORT[e.getMonth()]} ${e.getFullYear()}`;
        return `${MONTH_SHORT[s.getMonth()]} ${s.getFullYear()} – ${MONTH_SHORT[e.getMonth()]} ${e.getFullYear()}`;
    }, [viewMode, days]);

    // ── Helpers ───────────────────────────────────────────────────────────
    function getProjectColor(project: string): string {
        if (project in projectColors) {
            return PROJECT_HEX_COLORS[projectColors[project] % PROJECT_HEX_COLORS.length];
        }
        // Fallback hash identique à utils.ts getProjectColor
        let hash = 0;
        for (let i = 0; i < project.length; i++) {
            hash = project.charCodeAt(i) + ((hash << 5) - hash);
        }
        return PROJECT_HEX_COLORS[Math.abs(hash) % PROJECT_HEX_COLORS.length];
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

    // Navigation rapide via le month picker — bascule toujours en vue Mois
    const handleMonthPickerSelect = (year: number, month: number) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const newOffset = (year - today.getFullYear()) * 12 + (month - today.getMonth());
        setViewMode('1month');
        setOffset(newOffset);
        setShowMonthPicker(false);
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

    const compact = viewMode === '1month' || viewMode === '2months';
    // colW responsive : remplit l'espace dispo, avec plancher par mode
    const colW = useMemo(() => {
        const available = gridWidth - SIDE_W;
        const ideal = available > 0 && days.length > 0 ? available / days.length : 0;
        return Math.max(MIN_COL_W[viewMode], ideal);
    }, [gridWidth, days.length, viewMode]);

    function switchView(mode: ViewMode) { setViewMode(mode); setOffset(0); }

    // Indices des colonnes Lundi (pour overlay pleine hauteur)
    const mondayIndices = useMemo(
        () => days.map((d, i) => d.getDay() === 1 ? i : -1).filter(i => i !== -1),
        [days]
    );

    // Events Outlook visibles dans la fenêtre courante
    // Note : pour les réunions timed (ex: 14h-15h), ev.end === ev.start (même date ISO).
    // On calcule un effectiveEnd = start+1 jour dans ce cas pour que les barres s'affichent.
    const visibleOutlookEvents = useMemo((): OutlookEvent[] => {
        if (!outlookConfig.enabled || outlookEvents.length === 0) return [];
        return outlookEvents.filter(ev => {
            const effectiveEnd = ev.end > ev.start ? ev.end : addDaysIso(ev.start, 1);
            return ev.start <= rangeEnd && effectiveEnd > rangeStart;
        });
    }, [outlookEvents, outlookConfig.enabled, rangeStart, rangeEnd]);

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <>
        {/* ── MOBILE : vue non disponible ── */}
        <div className="md:hidden flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Monitor className="h-8 w-8 text-white/30" />
            </div>
            <div>
                <p className="text-base font-bold text-white/60">Vue Gantt</p>
                <p className="mt-1 text-sm text-white/30">
                    Cette vue nécessite un écran plus large.<br />
                    Utilisez le Kanban ou le Dashboard sur mobile.
                </p>
            </div>
            <div
                className="mt-1 rounded-xl border px-3 py-1.5 text-xs font-semibold text-white/50"
                style={{ borderColor: `${primaryColor}30`, backgroundColor: `${primaryColor}08` }}
            >
                ≥ 768px requis
            </div>
        </div>

        {/* ── DESKTOP GANTT (≥ md) ── */}
        <div className="hidden md:flex flex-col h-full gap-3 p-4 overflow-hidden">

            {/* ── Toolbar ─────────────────────────────────────────────── */}
            <GanttToolbar
                viewMode={viewMode}
                switchView={switchView}
                setOffset={setOffset}
                periodLabel={periodLabel}
                days={days}
                showMonthPicker={showMonthPicker}
                setShowMonthPicker={setShowMonthPicker}
                pickerYear={pickerYear}
                setPickerYear={setPickerYear}
                handleMonthPickerSelect={handleMonthPickerSelect}
                primaryColor={primaryColor}
                selectedUserId={selectedUserId}
                users={users}
            />

            {/* ── Grid ────────────────────────────────────────────────── */}
            <div ref={gridContainerRef} className="flex-1 overflow-auto rounded-2xl border border-white/10 bg-theme-secondary"
                onClick={e => { if (e.target === e.currentTarget) setSelectedCells(new Set()); }}>
                <div style={{ minWidth: `${SIDE_W + colW * days.length}px` }} className="relative">

                    {/* ── Overlays pleine hauteur : séparateurs de semaine (lundi) ── */}
                    {mondayIndices.map(i => (
                        <div key={i} className="absolute top-0 bottom-0 pointer-events-none z-[1]"
                            style={{ left: SIDE_W + i * colW }}>
                            <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-white/25" />
                            <div className="absolute top-0 bottom-0 left-[3px] w-[1px] bg-white/10" />
                        </div>
                    ))}

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
                                        ${isSat ? 'border-r border-r-white/10' : ''}`}
                                    style={{ width: colW, minWidth: colW, paddingBottom: '8px', paddingTop: '10px' }}>

                                    {/* Today top accent bar */}
                                    {isToday && (
                                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-cyan-400 rounded-b" />
                                    )}

                                    {/* Double barre séparateur de semaine (lundi) */}
                                    {isMonday && day.getDate() !== 1 && (
                                        <div className="absolute inset-y-0 left-0 pointer-events-none z-10">
                                            <div className="absolute inset-y-0 left-0 w-[1px] bg-white/35" />
                                            <div className="absolute inset-y-0 left-[3px] w-[1px] bg-white/12" />
                                        </div>
                                    )}
                                    {/* Double trait début de mois */}
                                    {day.getDate() === 1 && (
                                        <div className="absolute inset-y-0 left-0 pointer-events-none z-10">
                                            <div className="absolute inset-y-0 left-0 w-[1px] bg-white/40" />
                                            <div className="absolute inset-y-0 left-[3px] w-[1px] bg-white/20" />
                                        </div>
                                    )}

                                    {/* Week number — Mondays only, non-compact mode */}
                                    {isMonday && !compact && (
                                        <span className="absolute top-[4px] left-0 right-0 flex items-center justify-center">
                                            <span style={{
                                                fontSize: '9px', fontWeight: 800,
                                                letterSpacing: '0.06em', textTransform: 'uppercase',
                                                color: isToday ? 'rgba(34,211,238,0.85)' : 'rgba(255,255,255,0.45)',
                                                background: isToday ? 'rgba(34,211,238,0.10)' : 'rgba(255,255,255,0.06)',
                                                borderRadius: '3px',
                                                padding: '1px 4px',
                                            }}>
                                                S{getWeekNumber(day)}
                                            </span>
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

                    {/* ── Section Calendrier Outlook ── (masquée en consultation) */}
                    {!readOnly && outlookConfig.enabled && visibleOutlookEvents.length > 0 && (
                        <OutlookCalendarSection
                            visibleOutlookEvents={visibleOutlookEvents}
                            outlookCollapsed={outlookCollapsed}
                            toggleOutlookCollapsed={toggleOutlookCollapsed}
                            onRefreshOutlook={onRefreshOutlook}
                            days={days}
                            colW={colW}
                            rangeStart={rangeStart}
                            hoveredOutlookEventUid={hoveredOutlookEvent?.ev.uid ?? null}
                            onHoverEvent={(ev, rect) => setHoveredOutlookEvent({ ev, rect })}
                            onLeaveEvent={() => setHoveredOutlookEvent(null)}
                        />
                    )}

                    {/* ── Séparateur Outlook / To-DoX ── */}
                    {((!readOnly && outlookConfig.enabled && visibleOutlookEvents.length > 0 && flatRows.length > 0) || (icsExportPath && window.electronAPI?.isElectron && flatRows.length > 0)) ? (
                        <div className="flex sticky left-0 z-10 border-b-2 border-indigo-500/40">
                            <div
                                className="sticky left-0 z-10 px-4 py-1 flex items-center gap-2"
                                style={{ width: SIDE_W, minWidth: SIDE_W, backgroundColor: 'rgba(99,102,241,0.06)' }}
                            >
                                <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-400/60">
                                    Calendrier To-DoX
                                </span>
                                {icsExportPath && window.electronAPI?.isElectron && (
                                    <button
                                        onClick={e => {
                                            e.stopPropagation();
                                            const fileUrl = `file:///${icsExportPath.replace(/\\/g, '/')}`;
                                            window.electronAPI?.openExternalUrl(fileUrl);
                                        }}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 text-[10px] font-medium transition"
                                        title="Envoyer le fichier .ics vers Outlook"
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        Envoyer vers Outlook
                                    </button>
                                )}
                            </div>
                            {days.map(day => (
                                <div key={toISO(day)} style={{ width: colW, minWidth: colW }} />
                            ))}
                        </div>
                    ) : null}

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

                                        const isMonthStart = days[colIdx]?.getDate() === 1;
                                        const isMondayCol  = days[colIdx]?.getDay() === 1;
                                        return (
                                            <div key={iso}
                                                className={`relative border-r border-white/5 last:border-r-0 flex items-center
                                                ${isToday ? 'bg-cyan-500/10' : ''}`}
                                                style={{ width: colW, minWidth: colW, height: '42px' }}>

                                                {/* Double barre séparateur de semaine (lundi) */}
                                                {isMondayCol && !isMonthStart && (
                                                    <div className="absolute inset-y-0 left-0 pointer-events-none z-10">
                                                        <div className="absolute inset-y-0 left-0 w-[1px] bg-white/18" />
                                                        <div className="absolute inset-y-0 left-[3px] w-[1px] bg-white/8" />
                                                    </div>
                                                )}
                                                {/* Double trait début de mois */}
                                                {isMonthStart && (
                                                    <div className="absolute inset-y-0 left-0 pointer-events-none z-10">
                                                        <div className="absolute inset-y-0 left-0 w-[1px] bg-white/30" />
                                                        <div className="absolute inset-y-0 left-[3px] w-[1px] bg-white/15" />
                                                    </div>
                                                )}

                                                {inBar ? (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                        height: compact ? '6px' : '11px',
                                                        left: isBarStart ? '5px' : '0',
                                                        right: isBarEnd ? '5px' : '0',
                                                        background: `${row.color}52`,
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
                                    onContextMenu={readOnly ? undefined : e => { e.preventDefault(); onTaskClick(task, e.clientX, e.clientY); }}
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
                                                cursor: readOnly ? 'default' : dragVisual?.taskId === task.id ? 'crosshair' : 'pointer',
                                            }}
                                            onMouseDown={readOnly ? undefined : e => handleCellMouseDown(e, task, iso)}
                                            onMouseEnter={readOnly ? undefined : () => handleCellMouseEnter(task, iso)}
                                            onContextMenu={readOnly ? undefined : e => { e.preventDefault(); setActiveCell({ taskId: task.id, date: iso, rect: e.currentTarget.getBoundingClientRect() }); }}
                                            title={isPlanned
                                                ? `Cliquer pour modifier${assignedUsers.length > 0 ? ` (${assignedUsers.map(u => u.name.split(' ')[0]).join(', ')})` : ''} · Glisser pour étendre`
                                                : 'Cliquer pour planifier · Glisser pour une plage'}
                                        >
                                            {/* Double barre séparateur de semaine (lundi) */}
                                            {days[colIdx]?.getDay() === 1 && days[colIdx]?.getDate() !== 1 && (
                                                <div className="absolute inset-y-0 left-0 pointer-events-none z-10">
                                                    <div className="absolute inset-y-0 left-0 w-[1px] bg-white/18" />
                                                    <div className="absolute inset-y-0 left-[3px] w-[1px] bg-white/8" />
                                                </div>
                                            )}
                                            {/* Double trait début de mois */}
                                            {days[colIdx]?.getDate() === 1 && (
                                                <div className="absolute inset-y-0 left-0 pointer-events-none z-10">
                                                    <div className="absolute inset-y-0 left-0 w-[1px] bg-white/30" />
                                                    <div className="absolute inset-y-0 left-[3px] w-[1px] bg-white/15" />
                                                </div>
                                            )}

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
                                                    background: STATUS_COLOR[task.status] ?? bg,
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
                                                    style={{ left: '6px' }}>
                                                    {assignedUsers.slice(0, 3).map((user, i) => (
                                                        <div
                                                            key={user.id}
                                                            className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ring-1 ring-black/40"
                                                            style={{
                                                                backgroundColor: getUserColor(user.id),
                                                                marginLeft: i === 0 ? 0 : '-5px',
                                                                zIndex: assignedUsers.length - i,
                                                            }}
                                                            title={user.name}>
                                                            {getUserInitials(user)}
                                                        </div>
                                                    ))}
                                                    {assignedUsers.length > 3 && (
                                                        <div
                                                            className="h-5 w-5 rounded-full flex items-center justify-center text-[7px] font-bold text-white ring-1 ring-black/40 bg-white/25"
                                                            style={{ marginLeft: '-5px' }}>
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

                                            {/* Vue 1 semaine : infos enrichies */}
                                            {viewMode === '1week' && isPlanned && isSegStart && (
                                                <div className="absolute top-1/2 -translate-y-1/2 right-2 z-10 pointer-events-none"
                                                    title={`Priorité : ${task.priority === 'high' ? 'haute' : task.priority === 'med' ? 'moyenne' : 'basse'}`}>
                                                    <div className="h-[5px] w-[5px] rounded-full"
                                                        style={{ backgroundColor: task.priority === 'high' ? '#f43f5e' : task.priority === 'med' ? '#fbbf24' : '#94a3b8' }} />
                                                </div>
                                            )}
                                            {viewMode === '1week' && isPlanned && isSegEnd && !isDue && (task.subtasks ?? []).length > 0 && (() => {
                                                const total = task.subtasks!.length;
                                                const done  = task.subtasks!.filter(s => s.completed).length;
                                                return (
                                                    <div className="absolute bottom-1 left-0 right-0 flex justify-center pointer-events-none">
                                                        <span className={`text-[8px] font-bold leading-none ${done === total ? 'text-emerald-400/80' : 'text-white/40'}`}>
                                                            {done}/{total}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                </div>
            </div>
        </div>

        {/* ── Tooltip Outlook event ────────────────────────────────────── */}
        {hoveredOutlookEvent && createPortal(
            (() => {
                const { ev, rect } = hoveredOutlookEvent;
                const TT_W = 240;
                const left = Math.min(Math.max(8, rect.left + rect.width / 2 - TT_W / 2), window.innerWidth - TT_W - 8);
                const above = rect.top - 120 > 0;
                const top = above ? rect.top - 8 : rect.bottom + 8;

                // Formater la plage de dates / heures
                const isSameDay = ev.start === ev.end || ev.end === addDaysIso(ev.start, 1);
                const dateLabel = (() => {
                    const [, sm, sd] = ev.start.split('-');
                    const startFmt = `${parseInt(sd)} ${MONTH_SHORT[parseInt(sm) - 1]}`;
                    if (isSameDay) {
                        if (!ev.allDay && ev.startTime) {
                            return `${startFmt} · ${ev.startTime}${ev.endTime && ev.endTime !== ev.startTime ? ` – ${ev.endTime}` : ''}`;
                        }
                        return startFmt;
                    }
                    const effEnd = ev.end > ev.start ? addDaysIso(ev.end, -1) : ev.start;
                    const [, em, ed] = effEnd.split('-');
                    return `${startFmt} – ${parseInt(ed)} ${MONTH_SHORT[parseInt(em) - 1]}`;
                })();

                return (
                    <div
                        className="fixed z-50 pointer-events-none"
                        style={{ left, top: above ? undefined : top, bottom: above ? window.innerHeight - rect.top + 8 : undefined, width: TT_W }}
                    >
                        <div className="rounded-xl border border-indigo-500/30 shadow-2xl overflow-hidden"
                            style={{ backgroundColor: 'rgba(30,27,75,0.97)', backdropFilter: 'blur(12px)' }}>
                            {/* Header */}
                            <div className="px-3 pt-2.5 pb-2 border-b border-indigo-500/20">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className="inline-block h-2 w-2 rounded-full bg-indigo-400 shrink-0" />
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                                        Calendrier Outlook
                                    </span>
                                    {!ev.allDay && (
                                        <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                                            Réunion
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm font-semibold text-white leading-snug">{ev.title}</p>
                            </div>
                            {/* Body */}
                            <div className="px-3 py-2 space-y-1.5">
                                <div className="flex items-center gap-2 text-xs text-indigo-200/80">
                                    <Calendar className="h-3.5 w-3.5 text-indigo-400/60 shrink-0" />
                                    <span>{dateLabel}</span>
                                </div>
                                {ev.location && (
                                    <div className="flex items-center gap-2 text-xs text-indigo-200/60">
                                        <span className="h-3.5 w-3.5 shrink-0 text-center text-indigo-400/50">📍</span>
                                        <span className="truncate">{ev.location}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Arrow */}
                        <div className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
                            style={{
                                [above ? 'bottom' : 'top']: '-5px',
                                borderLeft: '5px solid transparent',
                                borderRight: '5px solid transparent',
                                [above ? 'borderTop' : 'borderBottom']: '5px solid rgba(99,102,241,0.4)',
                            }}
                        />
                    </div>
                );
            })(),
            document.body
        )}

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
