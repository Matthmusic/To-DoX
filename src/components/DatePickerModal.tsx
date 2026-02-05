import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface DatePickerModalProps {
    isOpen: boolean;
    value: string;
    onSelect: (isoDate: string) => void;
    onClose: () => void;
}

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

export function DatePickerModal({ isOpen, value, onSelect, onClose }: DatePickerModalProps) {
    const [viewDate, setViewDate] = useState(() => fromISODate(value));

    useEffect(() => {
        if (isOpen) {
            setViewDate(fromISODate(value));
        }
    }, [isOpen, value]);

    const monthMeta = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstOfMonth = new Date(year, month, 1);
        const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday start
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        return { year, month, startOffset, daysInMonth };
    }, [viewDate]);

    const monthLabel = useMemo(() => {
        const months = [
            "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
            "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre"
        ];
        return `${months[monthMeta.month]} ${monthMeta.year}`;
    }, [monthMeta.month, monthMeta.year]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="w-[360px] rounded-2xl border border-white/20 bg-white/5 p-4 text-slate-100 shadow-2xl backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="rounded-lg border border-white/10 bg-white/5 p-1 text-slate-200 transition hover:bg-white/10"
                            onClick={() => setViewDate(new Date(monthMeta.year, monthMeta.month - 1, 1))}
                            title="Mois precedent"
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
                    <button
                        type="button"
                        className="rounded-lg border border-white/10 bg-white/5 p-1 text-slate-300 transition hover:bg-white/10 hover:text-white"
                        onClick={onClose}
                        title="Fermer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-300">
                    <span>L</span>
                    <span>M</span>
                    <span>M</span>
                    <span>J</span>
                    <span>V</span>
                    <span>S</span>
                    <span>D</span>
                </div>

                <div className="mt-2 grid grid-cols-7 gap-1">
                    {Array.from({ length: monthMeta.startOffset }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-9" />
                    ))}
                    {Array.from({ length: monthMeta.daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const iso = `${monthMeta.year}-${pad2(monthMeta.month + 1)}-${pad2(day)}`;
                        const isSelected = iso === value;
                        return (
                            <button
                                key={iso}
                                type="button"
                                className={`h-9 rounded-xl border text-sm transition ${
                                    isSelected
                                        ? "border-cyan-300/60 bg-cyan-300/20 text-cyan-100"
                                        : "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                                }`}
                                onClick={() => {
                                    onSelect(iso);
                                    onClose();
                                }}
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
                        onClick={() => {
                            const today = toISODate(new Date());
                            onSelect(today);
                            onClose();
                        }}
                    >
                        Aujourd'hui
                    </button>
                    <div className="text-xs text-slate-400">{value}</div>
                </div>
            </div>
        </div>,
        document.body
    );
}
