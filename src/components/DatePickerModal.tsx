import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

function toISODate(date: Date): string {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function fromISODate(value: string): Date {
    if (!value) return new Date();
    return new Date(`${value}T00:00:00`);
}

const MONTHS = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

interface CalendarProps {
    value: string;
    onSelect: (isoDate: string) => void;
    onClose: () => void;
    showCloseButton?: boolean;
    selectedClassName?: string;
}

/** Contenu partagé du calendrier (sans wrapper/overlay) */
export function CalendarContent({ value, onSelect, onClose, showCloseButton = false, selectedClassName }: CalendarProps) {
    const [viewDate, setViewDate] = useState(() => fromISODate(value));

    useEffect(() => {
        setViewDate(fromISODate(value));
    }, [value]);

    const monthMeta = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstOfMonth = new Date(year, month, 1);
        const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday start
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        return { year, month, startOffset, daysInMonth };
    }, [viewDate]);

    const monthLabel = `${MONTHS[monthMeta.month]} ${monthMeta.year}`;

    return (
        <>
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="rounded-lg border border-white/10 bg-white/5 p-1 text-slate-200 transition hover:bg-white/10"
                        onClick={() => setViewDate(new Date(monthMeta.year, monthMeta.month - 1, 1))}
                        title="Mois précédent"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="text-sm font-semibold">{monthLabel}</div>
                    <button
                        type="button"
                        className="rounded-lg border border-white/10 bg-white/5 p-1 text-slate-200 transition hover:bg-white/10"
                        onClick={() => setViewDate(new Date(monthMeta.year, monthMeta.month + 1, 1))}
                        title="Mois suivant"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
                {showCloseButton && (
                    <button
                        type="button"
                        className="rounded-lg border border-white/10 bg-white/5 p-1 text-slate-300 transition hover:bg-white/10 hover:text-white"
                        onClick={onClose}
                        title="Fermer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-300">
                <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1">
                {Array.from({ length: monthMeta.startOffset }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-8" />
                ))}
                {Array.from({ length: monthMeta.daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const iso = `${monthMeta.year}-${pad2(monthMeta.month + 1)}-${pad2(day)}`;
                    const isSelected = iso === value;
                    return (
                        <button
                            key={iso}
                            type="button"
                            className={`h-8 rounded-xl border text-sm transition ${
                                isSelected
                                    ? (selectedClassName ?? "border-cyan-300/60 bg-cyan-300/20 text-cyan-100")
                                    : "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                            }`}
                            onClick={() => { onSelect(iso); onClose(); }}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>

            <div className="mt-3 flex items-center justify-between">
                <button
                    type="button"
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                    onClick={() => { onSelect(toISODate(new Date())); onClose(); }}
                >
                    Aujourd'hui
                </button>
                <div className="text-xs text-slate-400">{value}</div>
            </div>
        </>
    );
}

// ── DatePickerDropdown ───────────────────────────────────────────────────────
// Calendrier en dropdown inline (pas de portal, pas d'overlay).
// À utiliser dans un conteneur `position: relative`.

interface DatePickerDropdownProps {
    isOpen: boolean;
    value: string;
    onSelect: (isoDate: string) => void;
    onClose: () => void;
    /** Alignement horizontal du dropdown (défaut: left) */
    align?: 'left' | 'right';
}

export function DatePickerDropdown({ isOpen, value, onSelect, onClose, align = 'left' }: DatePickerDropdownProps) {
    if (!isOpen) return null;
    return (
        <div
            className={`absolute top-full z-[200] mt-1 w-[300px] rounded-2xl border border-white/20 bg-[#161b2e] p-3 text-slate-100 shadow-2xl ${align === 'right' ? 'right-0' : 'left-0'}`}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <CalendarContent value={value} onSelect={onSelect} onClose={onClose} />
        </div>
    );
}

// ── DatePickerModal ──────────────────────────────────────────────────────────
// Modale plein écran via portal (gardée pour compatibilité).

interface DatePickerModalProps {
    isOpen: boolean;
    value: string;
    onSelect: (isoDate: string) => void;
    onClose: () => void;
}

export function DatePickerModal({ isOpen, value, onSelect, onClose }: DatePickerModalProps) {
    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-[360px] rounded-2xl border border-white/20 bg-white/5 p-4 text-slate-100 shadow-2xl backdrop-blur-xl">
                <CalendarContent value={value} onSelect={onSelect} onClose={onClose} showCloseButton />
            </div>
        </div>,
        document.body
    );
}
