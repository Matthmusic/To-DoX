import { Calendar, ChevronDown, Lock, RefreshCw } from 'lucide-react';
import type { OutlookEvent } from '../../types';
import { SIDE_W, toISO, addDaysIso } from './timeline.utils';

interface OutlookCalendarSectionProps {
    visibleOutlookEvents: OutlookEvent[];
    outlookCollapsed: boolean;
    toggleOutlookCollapsed: () => void;
    onRefreshOutlook?: () => void;
    days: Date[];
    colW: number;
    rangeStart: string;
    hoveredOutlookEventUid: string | null;
    onHoverEvent: (ev: OutlookEvent, rect: DOMRect) => void;
    onLeaveEvent: () => void;
}

export function OutlookCalendarSection({
    visibleOutlookEvents, outlookCollapsed, toggleOutlookCollapsed, onRefreshOutlook,
    days, colW, rangeStart, hoveredOutlookEventUid, onHoverEvent, onLeaveEvent,
}: OutlookCalendarSectionProps) {
    return (
        <>
            {/* Header de section collapsible */}
            <div
                className="flex border-b border-indigo-500/30 cursor-pointer select-none"
                style={{ backgroundColor: 'rgba(99,102,241,0.10)' }}
                onClick={toggleOutlookCollapsed}
            >
                <div
                    className="sticky left-0 z-10 flex items-center gap-2 px-4 py-2 border-r border-indigo-500/20"
                    style={{ width: SIDE_W, minWidth: SIDE_W, backgroundColor: 'rgba(99,102,241,0.12)' }}
                >
                    <ChevronDown
                        className={`h-3.5 w-3.5 text-indigo-400 transition-transform ${outlookCollapsed ? '-rotate-90' : ''}`}
                    />
                    <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">
                        Calendrier Outlook
                    </span>
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                        {visibleOutlookEvents.length}
                    </span>
                    <div className="ml-auto flex items-center gap-1.5 shrink-0">
                        {onRefreshOutlook && (
                            <button
                                onClick={e => { e.stopPropagation(); onRefreshOutlook(); }}
                                className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 text-[10px] font-medium transition"
                                title="Recharger le calendrier Outlook"
                            >
                                <RefreshCw className="h-3 w-3" />
                                Actualiser
                            </button>
                        )}
                    </div>
                </div>
                {/* Cellules vides pour aligner les colonnes */}
                {days.map(day => (
                    <div
                        key={toISO(day)}
                        style={{ width: colW, minWidth: colW }}
                        className="border-r border-white/5 last:border-r-0"
                    />
                ))}
            </div>

            {/* Lignes d'events Outlook */}
            {!outlookCollapsed && visibleOutlookEvents.map(ev => (
                <div
                    key={ev.uid}
                    className="flex border-b border-white/5 group"
                    style={{ backgroundColor: 'rgba(99,102,241,0.06)' }}
                >
                    {/* Label left */}
                    <div
                        className="sticky left-0 z-10 flex items-center gap-2 px-4 py-2 border-r border-white/5 overflow-hidden"
                        style={{ width: SIDE_W, minWidth: SIDE_W, backgroundColor: 'rgba(99,102,241,0.08)' }}
                    >
                        <Lock className="h-3 w-3 text-indigo-400/60 shrink-0" />
                        {!ev.allDay && ev.startTime && (
                            <span className="shrink-0 text-[10px] font-bold text-indigo-400 tabular-nums">
                                {ev.startTime}{ev.endTime && ev.endTime !== ev.startTime ? `–${ev.endTime}` : ''}
                            </span>
                        )}
                        <span
                            className="text-xs text-indigo-200/80 truncate"
                            title={ev.location ? `${ev.title} — ${ev.location}` : ev.title}
                        >
                            {ev.title}
                        </span>
                        {ev.location && (
                            <span className="text-[10px] text-indigo-400/50 truncate hidden lg:block">
                                {ev.location}
                            </span>
                        )}
                    </div>

                    {/* Cellules Gantt */}
                    {days.map(day => {
                        const iso = toISO(day);
                        const effectiveEnd   = ev.end > ev.start ? ev.end : addDaysIso(ev.start, 1);
                        const isInEvent      = iso >= ev.start && iso < effectiveEnd;
                        const isStart        = iso === ev.start;
                        const isEnd          = iso === addDaysIso(effectiveEnd, -1);
                        const isFirstVisible = isInEvent && (isStart || iso === rangeStart);
                        return (
                            <div
                                key={iso}
                                className="relative border-r border-white/5 last:border-r-0"
                                style={{ width: colW, minWidth: colW, height: 34 }}
                                onMouseEnter={isInEvent ? e => onHoverEvent(ev, e.currentTarget.getBoundingClientRect()) : undefined}
                                onMouseLeave={isInEvent ? onLeaveEvent : undefined}
                            >
                                {isInEvent && (
                                    <div
                                        className="absolute inset-y-[6px] overflow-hidden flex items-center transition-colors"
                                        style={{
                                            left: isStart ? '4px' : '0',
                                            right: isEnd ? '4px' : '0',
                                            backgroundColor: hoveredOutlookEventUid === ev.uid ? 'rgba(99,102,241,0.55)' : 'rgba(99,102,241,0.35)',
                                            borderTop: '1px solid rgba(129,140,248,0.5)',
                                            borderBottom: '1px solid rgba(129,140,248,0.5)',
                                            borderLeft: isStart ? '2px solid rgba(129,140,248,0.8)' : 'none',
                                            borderRight: isEnd ? '2px solid rgba(129,140,248,0.8)' : 'none',
                                            borderRadius: isStart && isEnd ? '4px' : isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : '0',
                                        }}
                                    >
                                        {isFirstVisible && (
                                            <span className="px-1.5 text-[9px] font-semibold text-indigo-100 truncate leading-none select-none whitespace-nowrap">
                                                {!ev.allDay && ev.startTime ? `${ev.startTime} ` : ''}{ev.title}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </>
    );
}
