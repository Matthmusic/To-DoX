import { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, MousePointerClick } from 'lucide-react';
import type { User } from '../../types';
import type { ViewMode } from './timeline.utils';
import { STATUS_LABEL, STATUS_COLOR, STATUS_BORDER, MONTH_SHORT, getUserColor } from './timeline.utils';

const MODES: { key: ViewMode; label: string }[] = [
    { key: '1week',   label: '1 sem.' },
    { key: '2weeks',  label: '2 sem.' },
    { key: 'rolling', label: '↻ Auj.' },
    { key: '1month',  label: '1 mois' },
    { key: '2months', label: '2 mois' },
];
const BTN_W = 68;

interface GanttToolbarProps {
    viewMode: ViewMode;
    switchView: (mode: ViewMode) => void;
    setOffset: React.Dispatch<React.SetStateAction<number>>;
    periodLabel: string;
    days: Date[];
    showMonthPicker: boolean;
    setShowMonthPicker: React.Dispatch<React.SetStateAction<boolean>>;
    pickerYear: number;
    setPickerYear: React.Dispatch<React.SetStateAction<number>>;
    handleMonthPickerSelect: (year: number, month: number) => void;
    primaryColor: string;
    selectedUserId?: string;
    users: User[];
}

export function GanttToolbar({
    viewMode, switchView, setOffset, periodLabel, days,
    showMonthPicker, setShowMonthPicker, pickerYear, setPickerYear,
    handleMonthPickerSelect, primaryColor, selectedUserId, users,
}: GanttToolbarProps) {
    const monthPickerRef = useRef<HTMLDivElement>(null);

    // Ferme le month picker sur clic extérieur
    useEffect(() => {
        if (!showMonthPicker) return;
        const handleOutside = (e: MouseEvent) => {
            if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
                setShowMonthPicker(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [showMonthPicker, setShowMonthPicker]);
    const activeIdx = MODES.findIndex(m => m.key === viewMode);

    const bigStep = viewMode === '2months' ? 2 : viewMode === '1month' ? 3 : 4;

    return (
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">

            {/* Sélecteur de vue — sliding pill */}
            <div className="relative flex p-[3px] rounded-xl bg-white/5 border border-white/[0.12]" style={{ width: MODES.length * BTN_W + 6 }}>
                <div
                    className="absolute top-[3px] bottom-[3px] left-[3px] rounded-lg pointer-events-none transition-transform duration-200 ease-[cubic-bezier(0.34,1.2,0.64,1)]"
                    style={{
                        width: BTN_W,
                        transform: `translateX(${activeIdx * BTN_W}px)`,
                        backgroundColor: `${primaryColor}1e`,
                        boxShadow: `inset 0 0 0 1px ${primaryColor}40, 0 1px 3px rgba(0,0,0,0.3)`,
                    }}
                />
                {MODES.map(m => (
                    <button
                        key={m.key}
                        onClick={() => switchView(m.key)}
                        className={`relative z-10 flex items-center justify-center py-[7px] text-xs font-semibold transition-colors duration-150 ${
                            viewMode === m.key ? '' : 'text-white/35 hover:text-white/55'
                        }`}
                        style={{ width: BTN_W, color: viewMode === m.key ? primaryColor : undefined }}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            {/* Pod de navigation unifié */}
            <div className="flex items-center rounded-xl bg-white/5 border border-white/[0.12] divide-x divide-white/[0.08]">

                {/* Saut arrière rapide */}
                <button
                    onClick={() => setOffset(o => o - bigStep)}
                    title={`− ${bigStep} périodes`}
                    className="px-2 py-[7px] hover:bg-white/10 text-white/22 hover:text-white/65 transition-colors rounded-l-xl"
                >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                </button>

                <button
                    onClick={() => setOffset(o => o - 1)}
                    className="px-2.5 py-[7px] hover:bg-white/10 text-white/45 hover:text-white transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>

                {/* Période — click pour ouvrir le month picker */}
                <div className="relative">
                    <button
                        onClick={() => {
                            setPickerYear(days[0]?.getFullYear() ?? new Date().getFullYear());
                            setShowMonthPicker(p => !p);
                        }}
                        className="flex items-center gap-1 px-4 py-[7px] min-w-[180px] justify-center hover:bg-white/5 transition-colors group"
                    >
                        <span className="text-sm font-bold text-white/85 group-hover:text-white transition-colors select-none">
                            {periodLabel}
                        </span>
                        <ChevronDown className={`h-3 w-3 text-white/30 transition-transform duration-200 ${showMonthPicker ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Month picker dropdown */}
                    {showMonthPicker && (
                        <div
                            ref={monthPickerRef}
                            className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-white/15 shadow-2xl p-3"
                            style={{ width: 236, backgroundColor: 'var(--bg-secondary)' }}
                            onMouseDown={e => e.stopPropagation()}
                        >
                            {/* Navigation année */}
                            <div className="flex items-center justify-between mb-2.5 px-1">
                                <button
                                    onClick={() => setPickerYear(y => y - 1)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                <span className="text-sm font-bold text-white/75">{pickerYear}</span>
                                <button
                                    onClick={() => setPickerYear(y => y + 1)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            {/* Grille des mois */}
                            <div className="grid grid-cols-3 gap-1">
                                {MONTH_SHORT.map((m, idx) => {
                                    const todayD = new Date();
                                    const isThisMonth = pickerYear === todayD.getFullYear() && idx === todayD.getMonth();
                                    const isActive = !!days[0] && pickerYear === days[0].getFullYear() && idx === days[0].getMonth();
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => handleMonthPickerSelect(pickerYear, idx)}
                                            className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                                                isActive
                                                    ? ''
                                                    : isThisMonth
                                                        ? 'text-white/60 ring-1 ring-inset ring-white/20 hover:ring-white/30 hover:text-white/80'
                                                        : 'text-white/35 hover:text-white/70 hover:bg-white/[0.06]'
                                            }`}
                                            style={isActive ? {
                                                backgroundColor: `${primaryColor}28`,
                                                color: primaryColor,
                                                boxShadow: `inset 0 0 0 1px ${primaryColor}48`,
                                            } : {}}
                                        >
                                            {m}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => setOffset(o => o + 1)}
                    className="px-2.5 py-[7px] hover:bg-white/10 text-white/45 hover:text-white transition-colors"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>

                {/* Saut avant rapide */}
                <button
                    onClick={() => setOffset(o => o + bigStep)}
                    title={`+ ${bigStep} périodes`}
                    className="px-2 py-[7px] hover:bg-white/10 text-white/22 hover:text-white/65 transition-colors rounded-r-xl"
                >
                    <ChevronsRight className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Aujourd'hui */}
            <button
                onClick={() => { setOffset(0); setShowMonthPicker(false); }}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all"
                style={{ borderColor: `${primaryColor}40`, backgroundColor: `${primaryColor}12`, color: primaryColor }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${primaryColor}28`)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = `${primaryColor}12`)}
            >
                Aujourd'hui
            </button>

            {/* User en cours de visualisation */}
            {(() => {
                const viewedUser = selectedUserId ? users.find(u => u.id === selectedUserId) : null;
                if (!viewedUser) return null;
                return (
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Vue</span>
                        <span className="text-sm font-bold" style={{ color: getUserColor(viewedUser.id) }}>
                            {viewedUser.name.split(' ')[0]}
                        </span>
                    </div>
                );
            })()}

            <span className="hidden xl:flex items-center gap-1.5 text-[10px] text-white/20 font-medium ml-1">
                <MousePointerClick className="h-3 w-3" />
                Cliquer pour planifier · Ctrl+clic multi-sélection
            </span>

            {/* Légende */}
            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                {(Object.entries(STATUS_LABEL) as [string, string][]).map(([status, label]) => (
                    <span key={status} className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-lg border"
                        style={{ borderColor: `${STATUS_BORDER[status]}40`, backgroundColor: `${STATUS_COLOR[status]}18`, color: STATUS_BORDER[status] }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_BORDER[status] }} />
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
}
