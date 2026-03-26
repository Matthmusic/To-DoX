import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Task } from '../../types';
import type { ActiveCell } from './timeline.utils';
import { formatShortDate, getUserColor, getUserInitials } from './timeline.utils';

interface GanttCellPopoverProps {
    activeCell: ActiveCell;
    filteredTasks: Task[];
    users: { id: string; name: string }[];
    onClose: () => void;
    onSetGanttUsers: (taskId: string, date: string, userIds: string[]) => void;
    onRemoveGanttDay: (taskId: string, date: string) => void;
}

export function GanttCellPopover({
    activeCell, filteredTasks, users, onClose, onSetGanttUsers, onRemoveGanttDay,
}: GanttCellPopoverProps) {
    const task = filteredTasks.find(t => t.id === activeCell.taskId);
    const panelRef = useRef<HTMLDivElement>(null);

    // Ferme sur mousedown hors du panel, et sur contextmenu hors du panel
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
