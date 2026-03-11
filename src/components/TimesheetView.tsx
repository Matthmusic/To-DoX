import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Plus, X, Clock, CalendarDays, Info, GripVertical } from "lucide-react";
import useStore from "../store/useStore";
import { useTheme } from "../hooks/useTheme";
import { getProjectColor } from "../utils";

// ─── Utilitaires de dates ────────────────────────────────────────────────────

function getWeekDates(weekOffset: number): string[] {
    const today = new Date();
    const dow = today.getDay();
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday + weekOffset * 7);
    const dates: string[] = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
}

const DAY_LABELS = ["Lu", "Ma", "Me", "Je", "Ve"];

function formatWeekLabel(dates: string[]): string {
    const from = new Date(dates[0] + "T00:00:00");
    const to = new Date(dates[4] + "T00:00:00");
    const months = ["jan.", "fév.", "mar.", "avr.", "mai", "juin", "juil.", "août", "sep.", "oct.", "nov.", "déc."];
    if (from.getMonth() === to.getMonth()) {
        return `${from.getDate()}–${to.getDate()} ${months[from.getMonth()]} ${from.getFullYear()}`;
    }
    return `${from.getDate()} ${months[from.getMonth()]} – ${to.getDate()} ${months[to.getMonth()]} ${to.getFullYear()}`;
}

function getWeekNumber(dateStr: string): number {
    const d = new Date(dateStr + "T00:00:00");
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const diff = d.getTime() - startOfYear.getTime();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    return Math.ceil((diff / oneWeek + startOfYear.getDay() / 7));
}

function todayISO(): string {
    return new Date().toISOString().split("T")[0];
}

// ─── Valeurs du dropdown (0 à 16h, pas de 0.5h) ─────────────────────────────


function formatOption(h: number): string {
    if (h === 0) return "Effacer";
    const full = Math.floor(h);
    const half = h % 1 !== 0;
    return half ? `${full}h30` : `${full}h`;
}

function fmtHours(h: number): string {
    if (h === 0) return "";
    const full = Math.floor(h);
    const half = h % 1 !== 0;
    return half ? `${full}h30` : `${full}h`;
}

// ─── Dropdown heures (portal) ────────────────────────────────────────────────

interface HoursDropdownProps {
    anchorRect: DOMRect;
    currentHours: number;
    primaryColor: string;
    onSelect: (hours: number) => void;
    onClose: () => void;
}

function parseHoursInput(raw: string): number | null {
    const s = raw.trim().toLowerCase().replace(",", ".");
    // "7h30" → 7.5 / "7h15" → 7.25 / "7h" → 7
    const hm = s.match(/^(\d+(?:\.\d+)?)h(\d+)?$/);
    if (hm) {
        const h = parseFloat(hm[1]);
        const m = hm[2] ? parseInt(hm[2]) : 0;
        return h + m / 60;
    }
    // nombre décimal brut
    const n = parseFloat(s);
    if (!isNaN(n)) return n;
    return null;
}

function HoursDropdown({ anchorRect, currentHours, primaryColor, onSelect, onClose }: HoursDropdownProps) {
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputVal, setInputVal] = useState("");
    const [inputError, setInputError] = useState(false);

    const DROPDOWN_W = 320;
    const DROPDOWN_H = 420; // hauteur approx. (sans scroll)

    // Position : en dessous si possible, sinon au-dessus
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const top = spaceBelow >= DROPDOWN_H
        ? anchorRect.bottom + 6
        : anchorRect.top - DROPDOWN_H - 6;
    let left = anchorRect.left + anchorRect.width / 2 - DROPDOWN_W / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - DROPDOWN_W - 8));

    // Fermer au clic extérieur ou Escape
    useEffect(() => {
        const handleDown = (e: MouseEvent) => {
            if (!dropdownRef.current?.contains(e.target as Node)) onClose();
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("mousedown", handleDown);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleDown);
            document.removeEventListener("keydown", handleKey);
        };
    }, [onClose]);

    // Focus automatique sur l'input
    useEffect(() => { inputRef.current?.focus(); }, []);

    function handleInputSubmit() {
        if (!inputVal.trim()) { onClose(); return; }
        const parsed = parseHoursInput(inputVal);
        if (parsed === null || parsed < 0 || parsed > 24) {
            setInputError(true);
            setTimeout(() => setInputError(false), 600);
            return;
        }
        // Arrondi au 0.25h le plus proche, clamped 0-16
        const rounded = Math.round(parsed * 4) / 4;
        onSelect(Math.min(16, Math.max(0, rounded)));
    }

    // Toutes les valeurs : 1, 1.5, 2, 2.5 … 16 en 4 colonnes
    const allValues: number[] = [];
    for (let h = 1; h <= 16; h++) {
        allValues.push(h);
        if (h < 16) allValues.push(h + 0.5);
    }

    function btnStyle(h: number) {
        const isActive = currentHours === h;
        if (isActive) return {
            backgroundColor: `${primaryColor}30`,
            color: primaryColor,
            borderColor: `${primaryColor}60`,
            fontWeight: 700 as const,
        };
        const isHalf = h % 1 !== 0;
        return {
            backgroundColor: "transparent",
            color: isHalf ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.8)",
            borderColor: "rgba(255,255,255,0.08)",
        };
    }

    return createPortal(
        <div
            ref={dropdownRef}
            style={{
                position: "fixed",
                top,
                left,
                width: DROPDOWN_W,
                zIndex: 99999,
                backgroundColor: "var(--bg-tertiary, #1a1f2e)",
                border: `1px solid ${primaryColor}35`,
                borderRadius: 16,
                boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px ${primaryColor}20`,
                overflow: "hidden",
            }}
        >
            {/* En-tête */}
            <div
                className="flex items-center justify-between px-3 py-2"
                style={{ borderBottom: `1px solid rgba(255,255,255,0.06)`, backgroundColor: `${primaryColor}10` }}
            >
                <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Heures pointées</span>
                {currentHours > 0 && (
                    <button
                        onClick={() => onSelect(0)}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-md transition-colors"
                        style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}
                    >
                        Effacer
                    </button>
                )}
            </div>

            {/* Saisie libre */}
            <div className="px-2 pt-2 pb-1">
                <div className="flex gap-1.5">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputVal}
                        onChange={e => { setInputVal(e.target.value); setInputError(false); }}
                        onKeyDown={e => {
                            if (e.key === "Enter") handleInputSubmit();
                            e.stopPropagation();
                        }}
                        placeholder="ex : 7h30 ou 7.5"
                        className="flex-1 rounded-lg border bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 outline-none transition-all"
                        style={{
                            borderColor: inputError ? "#f87171" : `${primaryColor}40`,
                            boxShadow: inputError ? "0 0 0 2px rgba(248,113,113,0.25)" : undefined,
                        }}
                    />
                    <button
                        onClick={handleInputSubmit}
                        className="rounded-lg px-3 py-1.5 text-xs font-bold transition-colors"
                        style={{ backgroundColor: `${primaryColor}25`, color: primaryColor, border: `1px solid ${primaryColor}40` }}
                    >
                        OK
                    </button>
                </div>
            </div>

            {/* Grille 4 colonnes — toutes les valeurs sans scroll */}
            <div className="p-2">
                <div className="grid grid-cols-4 gap-1">
                    {allValues.map(h => (
                        <button
                            key={h}
                            onClick={() => onSelect(h)}
                            className="rounded-lg border py-1.5 text-xs font-semibold transition-all hover:brightness-125"
                            style={btnStyle(h)}
                        >
                            {formatOption(h)}
                        </button>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function TimesheetView() {
    const { tasks, timeEntries, upsertTimeEntry, projectColors, currentUser, viewAsUser, users } = useStore();
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;
    const selectedViewUserId = viewAsUser ?? currentUser;
    const selectedViewFirstName = useMemo(() => {
        if (!selectedViewUserId) return "Aucun";
        const fullName = users.find(u => u.id === selectedViewUserId)?.name ?? selectedViewUserId;
        return fullName.trim().split(/\s+/)[0] || fullName;
    }, [users, selectedViewUserId]);
    const canEditTimesheet = !!currentUser && currentUser !== "unassigned" && selectedViewUserId === currentUser;
    const isReadOnlyView = !!selectedViewUserId && !canEditTimesheet;

    // ── Navigation semaine
    const [weekOffset, setWeekOffset] = useState(0);
    const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
    const weekLabel = useMemo(() => formatWeekLabel(weekDates), [weekDates]);
    const weekNum = useMemo(() => getWeekNumber(weekDates[0]), [weekDates]);
    const today = todayISO();

    // ── Projets "en cours" pour l'utilisateur courant
    const doingProjects = useMemo(() => {
        const seen = new Set<string>();
        for (const t of tasks) {
            if (t.archived || t.deletedAt) continue;
            if (t.status !== "doing") continue;
            if (selectedViewUserId) {
                if (!t.assignedTo.includes(selectedViewUserId) && t.createdBy !== selectedViewUserId) continue;
            }
            if (t.project) seen.add(t.project);
        }
        return [...seen].sort();
    }, [tasks, selectedViewUserId]);

    // ── Projets avec saisies cette semaine
    const projectsWithEntriesThisWeek = useMemo(() => {
        const seen = new Set<string>();
        for (const e of timeEntries) {
            if (selectedViewUserId && e.userId !== selectedViewUserId) continue;
            if (weekDates.includes(e.date)) seen.add(e.project);
        }
        return [...seen];
    }, [timeEntries, weekDates, selectedViewUserId]);

    // ── Liste ordonnée des projets visibles, indexée par semaine (weekDates[0])
    const [projectsByWeek, setProjectsByWeek] = useState<Record<string, string[]>>({});
    // ── Projets explicitement supprimés par l'user pour une semaine donnée
    const [dismissedByWeek, setDismissedByWeek] = useState<Record<string, string[]>>({});

    const weekKey = `${selectedViewUserId ?? "none"}::${weekDates[0]}`;

    // Sync : initialise la semaine si pas encore vue,
    // sinon ajoute uniquement les projets nouveaux (jamais vus ET non supprimés)
    useEffect(() => {
        const auto = [...new Set([...doingProjects, ...projectsWithEntriesThisWeek])];
        setProjectsByWeek(prev => {
            const current = prev[weekKey];
            const dismissed = new Set(dismissedByWeek[weekKey] ?? []);
            if (!current) {
                // Première visite → liste auto triée (hors supprimés)
                return { ...prev, [weekKey]: auto.filter(p => !dismissed.has(p)).sort() };
            }
            // Semaine connue → ajouter uniquement les nouveaux non-supprimés non-présents
            const existing = new Set(current);
            const toAdd = auto.filter(p => !existing.has(p) && !dismissed.has(p));
            if (toAdd.length === 0) return prev;
            return { ...prev, [weekKey]: [...current, ...toAdd] };
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekKey, doingProjects, projectsWithEntriesThisWeek]);

    const orderedProjects = projectsByWeek[weekKey] ?? [];

    function setOrderedProjects(updater: (prev: string[]) => string[]) {
        setProjectsByWeek(prev => ({
            ...prev,
            [weekKey]: updater(prev[weekKey] ?? []),
        }));
    }

    // Projets sur lesquels l'utilisateur est/était affecté (assigné ou créateur)
    const allProjectNames = useMemo(() => {
        const seen = new Set<string>();
        for (const t of tasks) {
            if (!t.archived && !t.deletedAt && t.project) {
                if (!selectedViewUserId || t.assignedTo.includes(selectedViewUserId) || t.createdBy === selectedViewUserId) {
                    seen.add(t.project);
                }
            }
        }
        return [...seen].sort();
    }, [tasks, selectedViewUserId]);

    // ── Drag-and-drop reorder des lignes
    const dragSrcIdxRef = useRef<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    function handleRowDragStart(idx: number) {
        if (!canEditTimesheet) return;
        dragSrcIdxRef.current = idx;
    }

    function handleRowDragOver(e: React.DragEvent, idx: number) {
        if (!canEditTimesheet) return;
        e.preventDefault();
        if (dragSrcIdxRef.current !== null) setDragOverIdx(idx);
    }

    function handleRowDrop(idx: number) {
        if (!canEditTimesheet) return;
        const src = dragSrcIdxRef.current;
        dragSrcIdxRef.current = null;
        setDragOverIdx(null);
        if (src === null || src === idx) return;
        setOrderedProjects(prev => {
            const arr = [...prev];
            const [removed] = arr.splice(src, 1);
            arr.splice(idx, 0, removed);
            return arr;
        });
    }

    function handleRowDragEnd() {
        dragSrcIdxRef.current = null;
        setDragOverIdx(null);
    }

    // ── Dropdown heures
    const [dropdownCell, setDropdownCell] = useState<{ project: string; date: string; rect: DOMRect } | null>(null);

    useEffect(() => {
        setDropdownCell(null);
    }, [weekKey, canEditTimesheet]);

    // ── Lookup entrées
    const entryMap = useMemo(() => {
        const map = new Map<string, number>();
        for (const e of timeEntries) {
            if (selectedViewUserId && e.userId !== selectedViewUserId) continue;
            map.set(`${e.project}|${e.date}`, e.hours);
        }
        return map;
    }, [timeEntries, selectedViewUserId]);

    function getHours(project: string, date: string): number {
        return entryMap.get(`${project}|${date}`) ?? 0;
    }

    // ── Totaux
    const dayTotals = useMemo(() =>
        weekDates.map(date => orderedProjects.reduce((sum, p) => sum + getHours(p, date), 0)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [weekDates, orderedProjects, entryMap]
    );

    const projectTotals = useMemo(() =>
        orderedProjects.map(p => weekDates.reduce((sum, date) => sum + getHours(p, date), 0)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [weekDates, orderedProjects, entryMap]
    );

    const grandTotal = useMemo(() => dayTotals.reduce((a, b) => a + b, 0), [dayTotals]);

    // ── Ouvrir dropdown
    function openDropdown(e: React.MouseEvent<HTMLButtonElement>, project: string, date: string) {
        if (!canEditTimesheet) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setDropdownCell({ project, date, rect });
    }

    function selectHours(hours: number) {
        if (!dropdownCell || !canEditTimesheet || !currentUser) return;
        upsertTimeEntry(dropdownCell.project, dropdownCell.date, hours, currentUser);
        setDropdownCell(null);
    }

    // ── Ajout de projet
    const [pickerAnchorRect, setPickerAnchorRect] = useState<DOMRect | null>(null);
    const [pickerSearch, setPickerSearch] = useState("");
    const pickerRef = useRef<HTMLDivElement>(null);
    const showProjectPicker = pickerAnchorRect !== null;

    useEffect(() => {
        if (!showProjectPicker) return;
        const handler = (e: MouseEvent) => {
            if (!pickerRef.current?.contains(e.target as Node)) {
                setPickerAnchorRect(null);
                setPickerSearch("");
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") { setPickerAnchorRect(null); setPickerSearch(""); }
        };
        document.addEventListener("mousedown", handler);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handler);
            document.removeEventListener("keydown", handleKey);
        };
    }, [showProjectPicker]);

    useEffect(() => {
        if (canEditTimesheet) return;
        setPickerAnchorRect(null);
        setPickerSearch("");
    }, [canEditTimesheet]);

    const pickerProjects = useMemo(() => {
        const q = pickerSearch.toLowerCase();
        const inView = new Set(orderedProjects);
        return allProjectNames
            .filter(p => !inView.has(p))
            .filter(p => !q || p.toLowerCase().includes(q));
    }, [allProjectNames, orderedProjects, pickerSearch]);

    function addProject(name: string) {
        if (!canEditTimesheet) return;
        setOrderedProjects(prev => [...prev, name]);
        setPickerAnchorRect(null);
        setPickerSearch("");
    }

    function removeProject(name: string) {
        if (!canEditTimesheet) return;
        setOrderedProjects(prev => prev.filter(p => p !== name));
        setDismissedByWeek(prev => ({
            ...prev,
            [weekKey]: [...new Set([...(prev[weekKey] ?? []), name])],
        }));
    }

    function clearAllProjects() {
        if (!canEditTimesheet) return;
        const all = projectsByWeek[weekKey] ?? [];
        setProjectsByWeek(prev => ({ ...prev, [weekKey]: [] }));
        setDismissedByWeek(prev => ({
            ...prev,
            [weekKey]: [...new Set([...(prev[weekKey] ?? []), ...all])],
        }));
    }

    // Couleur du total journalier :
    // - Vendredi : vert entre 4h et 7h (inclus)
    // - Sinon : bleu < 8h, vert = 8h, orange > 8h, rouge > 11h
    function dayTotalColor(h: number, dateIso: string): string {
        if (h === 0) return "rgba(255,255,255,0.2)";
        const dayOfWeek = new Date(`${dateIso}T00:00:00`).getDay(); // 5 = vendredi
        if (dayOfWeek === 5 && h >= 4 && h <= 7) return "#4ade80";  // vert
        if (h > 11) return "#f87171";   // rouge
        if (h > 8)  return "#fb923c";   // orange
        if (h === 8) return "#4ade80";  // vert
        return "#60a5fa";               // bleu (< 8h)
    }

    // Couleur du total semaine : bleu < 35h, vert = 35h, jaune > 35h et < 40h, rouge >= 40h
    function weekTotalColor(h: number): string {
        if (h === 0) return "rgba(255,255,255,0.2)";
        if (h >= 40) return "#f87171";         // rouge
        if (h > 35)  return "#facc15";         // jaune (35.5 -> 39.5)
        if (h === 35) return "#4ade80";        // vert
        return "#60a5fa";                      // bleu (< 35h)
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden w-[80%] max-[1400px]:w-[90%] max-[1200px]:w-full min-[2200px]:w-[70%] max-w-[2400px] mx-auto">

            {/* ── HEADER ──────────────────────────────────────────────────── */}
            <div
                className="flex items-center justify-between gap-4 px-6 py-3 border-b"
                style={{ borderColor: `${primaryColor}25` }}
            >
                <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 shrink-0" style={{ color: primaryColor }} />
                    <span className="font-bold text-white text-lg">Feuille de pointage</span>
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Vue</span>
                        <span
                            className="text-sm font-bold"
                            style={{ color: selectedViewUserId ? primaryColor : "rgba(255,255,255,0.45)" }}
                        >
                            {selectedViewFirstName}
                        </span>
                    </div>
                    <span className="text-base font-bold text-white/60 ml-1 tabular-nums">S{String(weekNum).padStart(2, "0")}</span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setWeekOffset(w => w - 1)}
                        className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>

                    <button
                        onClick={() => setWeekOffset(0)}
                        className="rounded-lg border px-3 py-1 text-xs font-semibold transition-colors w-44 text-center"
                        style={weekOffset === 0
                            ? { borderColor: `${primaryColor}60`, backgroundColor: `${primaryColor}20`, color: primaryColor }
                            : { borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }
                        }
                    >
                        {weekOffset === 0 ? "Cette semaine" : weekLabel}
                    </button>

                    <button
                        onClick={() => setWeekOffset(w => w + 1)}
                        className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-white/60 text-sm">Total semaine :</span>
                    <span
                        className="text-xl font-black tabular-nums"
                        style={{ color: weekTotalColor(grandTotal) }}
                    >
                        {grandTotal > 0 ? fmtHours(grandTotal) : "—"}
                    </span>
                </div>
            </div>

            {/* ── INFO si pas connecté ────────────────────────────────────── */}
            {!selectedViewUserId && (
                <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
                    <Info className="h-4 w-4 shrink-0" />
                    Connectez-vous pour saisir vos heures (menu utilisateur en haut à droite).
                </div>
            )}

            {/* ── TABLEAU ─────────────────────────────────────────────────── */}
            {isReadOnlyView && (
                <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
                    <Info className="h-4 w-4 shrink-0" />
                    Mode lecture seule : vous consultez la feuille de pointage de {selectedViewFirstName}.
                </div>
            )}

            <div className="flex-1 overflow-auto px-4 py-4">
                <div
                    className="rounded-2xl border overflow-hidden"
                    style={{ borderColor: `${primaryColor}20`, backgroundColor: "rgba(255,255,255,0.03)" }}
                >
                    <table className="w-full table-fixed border-collapse text-base">
                        <colgroup>
                            <col style={{ width: "16rem" }} />
                            {weekDates.map((date) => (
                                <col key={`col-${date}`} style={{ width: "4rem" }} />
                            ))}
                            <col style={{ width: "5rem" }} />
                        </colgroup>
                        {/* Entête colonnes */}
                        <thead>
                            <tr style={{ backgroundColor: `${primaryColor}12`, borderBottom: `1px solid ${primaryColor}25` }}>
                                <th className="py-3 px-4 text-left font-semibold text-white/75">
                                    <div className="flex items-center gap-2">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        Projet
                                        {orderedProjects.length > 0 && canEditTimesheet && (
                                            <button
                                                onClick={clearAllProjects}
                                                title="Tout supprimer"
                                                className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold transition-all shrink-0"
                                                style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)" }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(248,113,113,0.25)"; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(248,113,113,0.12)"; }}
                                            >
                                                <X className="h-3 w-3" />
                                                Tout vider
                                            </button>
                                        )}
                                    </div>
                                </th>
                                {weekDates.map((date, i) => {
                                    const d = new Date(date + "T00:00:00");
                                    const isToday = date === today;
                                    return (
                                        <th
                                            key={date}
                                            className="py-3 px-1 text-center font-semibold w-16"
                                            style={{ color: isToday ? primaryColor : "rgba(255,255,255,0.75)" }}
                                        >
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className="text-xs uppercase tracking-wider opacity-70">
                                                    {DAY_LABELS[i]}
                                                </span>
                                                <span
                                                    className="text-base font-black w-7 h-7 flex items-center justify-center rounded-full"
                                                    style={isToday ? { backgroundColor: `${primaryColor}30`, color: primaryColor } : {}}
                                                >
                                                    {d.getDate()}
                                                </span>
                                            </div>
                                        </th>
                                    );
                                })}
                                <th className="py-3 px-3 text-center font-semibold text-white/70 w-20">
                                    Total
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {orderedProjects.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-white/30 text-base">
                                        Aucun projet en cours cette semaine.<br />
                                        <span className="text-sm opacity-60">Les projets "En cours" apparaissent automatiquement.</span>
                                    </td>
                                </tr>
                            ) : (
                                orderedProjects.map((project, rowIdx) => {
                                    const colors = getProjectColor(project, projectColors);
                                    const rowTotal = projectTotals[rowIdx];
                                    const isDoing = doingProjects.includes(project);
                                    const isDragOver = dragOverIdx === rowIdx;

                                    return (
                                        <tr
                                            key={project}
                                            draggable={canEditTimesheet}
                                            onDragStart={() => handleRowDragStart(rowIdx)}
                                            onDragOver={e => handleRowDragOver(e, rowIdx)}
                                            onDrop={() => handleRowDrop(rowIdx)}
                                            onDragEnd={handleRowDragEnd}
                                            className="group transition-colors"
                                            style={{
                                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                                borderTop: isDragOver ? `2px solid ${primaryColor}` : undefined,
                                                cursor: canEditTimesheet ? "grab" : "default",
                                            }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.03)"; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                                        >
                                            {/* Nom du projet */}
                                            <td className="py-2 px-2">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <span className={`h-2 w-2 rounded-full shrink-0 ${colors.bg.replace('/15', '')} border ${colors.border}`} />
                                                    <span className={`text-sm font-bold ${colors.text} flex-1 min-w-0 truncate`} title={project}>
                                                        {project}
                                                    </span>
                                                    <div className="ml-auto flex items-center gap-1.5 shrink-0">
                                                        {isDoing && (
                                                            <span
                                                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                                                                style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                                                            >
                                                                EN COURS
                                                            </span>
                                                        )}
                                                        {canEditTimesheet && (
                                                            <button
                                                                onClick={() => removeProject(project)}
                                                                className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Cellules heures */}
                                            {weekDates.map(date => {
                                                const h = getHours(project, date);
                                                const isOpen = dropdownCell?.project === project && dropdownCell?.date === date;
                                                const isToday = date === today;

                                                return (
                                                    <td
                                                        key={date}
                                                        className="py-1.5 px-0.5 text-center"
                                                        style={isToday ? { backgroundColor: `${primaryColor}08` } : {}}
                                                    >
                                                        <button
                                                            onClick={e => openDropdown(e, project, date)}
                                                            disabled={!canEditTimesheet}
                                                            className="w-12 rounded-lg py-1.5 text-sm font-bold tabular-nums transition-all"
                                                            style={
                                                                isOpen
                                                                    ? {
                                                                        backgroundColor: `${primaryColor}25`,
                                                                        color: primaryColor,
                                                                        border: `1px solid ${primaryColor}`,
                                                                        boxShadow: `0 0 0 2px ${primaryColor}30`,
                                                                    }
                                                                    : h > 0
                                                                        ? {
                                                                            backgroundColor: `${primaryColor}18`,
                                                                            color: primaryColor,
                                                                            border: `1px solid ${primaryColor}30`,
                                                                        }
                                                                        : {
                                                                            backgroundColor: "transparent",
                                                                            color: "rgba(255,255,255,0.12)",
                                                                            border: "1px solid transparent",
                                                                        }
                                                            }
                                                            onMouseEnter={e => {
                                                                if (!canEditTimesheet || isOpen) return;
                                                                (e.currentTarget as HTMLElement).style.borderColor = `${primaryColor}50`;
                                                                (e.currentTarget as HTMLElement).style.backgroundColor = `${primaryColor}10`;
                                                                (e.currentTarget as HTMLElement).style.color = primaryColor;
                                                            }}
                                                            onMouseLeave={e => {
                                                                if (!canEditTimesheet || isOpen) return;
                                                                (e.currentTarget as HTMLElement).style.borderColor = h > 0 ? `${primaryColor}30` : "transparent";
                                                                (e.currentTarget as HTMLElement).style.backgroundColor = h > 0 ? `${primaryColor}18` : "transparent";
                                                                (e.currentTarget as HTMLElement).style.color = h > 0 ? primaryColor : "rgba(255,255,255,0.12)";
                                                            }}
                                                        >
                                                            {h > 0 ? fmtHours(h) : <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>}
                                                        </button>
                                                    </td>
                                                );
                                            })}

                                            {/* Total ligne */}
                                            <td className="py-2 px-2 text-center">
                                                <span
                                                    className="text-base font-black tabular-nums"
                                                    style={{ color: rowTotal > 0 ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.15)" }}
                                                >
                                                    {rowTotal > 0 ? fmtHours(rowTotal) : "—"}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}

                            {/* Ligne "Ajouter projet" — même gabarit qu'une ligne projet */}
                            <tr
                                className="group"
                                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.02)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                            >
                                <td className="py-2 px-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <Plus
                                            className="h-3.5 w-3.5 shrink-0"
                                            style={{ color: `${primaryColor}60` }}
                                        />
                                        <button
                                            onClick={e => {
                                                if (!canEditTimesheet) return;
                                                if (pickerAnchorRect) { setPickerAnchorRect(null); return; }
                                                setPickerAnchorRect(e.currentTarget.getBoundingClientRect());
                                                setPickerSearch("");
                                            }}
                                            disabled={!canEditTimesheet}
                                            className="flex-1 text-left text-sm font-semibold transition-colors min-w-0 truncate"
                                            style={{ color: canEditTimesheet ? `${primaryColor}70` : "rgba(255,255,255,0.35)" }}
                                            onMouseEnter={e => {
                                                if (!canEditTimesheet) return;
                                                (e.currentTarget as HTMLElement).style.color = primaryColor;
                                            }}
                                            onMouseLeave={e => {
                                                (e.currentTarget as HTMLElement).style.color = canEditTimesheet ? `${primaryColor}70` : "rgba(255,255,255,0.35)";
                                            }}
                                        >
                                            Ajouter un projet...
                                        </button>
                                    </div>
                                </td>
                                {weekDates.map(date => (
                                    <td key={date} className="py-1.5 px-0.5" />
                                ))}
                                <td className="py-2 px-2" />
                            </tr>

                            {/* Ligne TOTAL */}
                            <tr style={{ borderTop: `2px solid ${primaryColor}25`, backgroundColor: `${primaryColor}08` }}>
                                <td className="py-3 px-4">
                                    <span className="text-sm font-black text-white/50 uppercase tracking-wider">Total</span>
                                </td>
                                {dayTotals.map((total, i) => {
                                    const isToday = weekDates[i] === today;
                                    return (
                                        <td
                                            key={weekDates[i]}
                                            className="py-3 px-1 text-center"
                                            style={isToday ? { backgroundColor: `${primaryColor}12` } : {}}
                                        >
                                            <span
                                                className="text-base font-black tabular-nums"
                                                style={{ color: dayTotalColor(total, weekDates[i]) }}
                                            >
                                                {total > 0 ? fmtHours(total) : <span style={{ color: "rgba(255,255,255,0.12)" }}>—</span>}
                                            </span>
                                        </td>
                                    );
                                })}
                                <td className="py-3 px-4 text-center">
                                    <span
                                        className="text-base font-black tabular-nums"
                                        style={{ color: weekTotalColor(grandTotal) }}
                                    >
                                        {grandTotal > 0 ? fmtHours(grandTotal) : "—"}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Légende */}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-white/30 px-1">
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                        "EN COURS" = projet avec tâches actives assignées
                    </span>
                    <span>· Cliquez sur une cellule pour choisir les heures</span>
                    <span className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: "#60a5fa" }} /> &lt; 8h/j</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: "#4ade80" }} /> = 8h/j (ou Ve 4-7h)</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: "#fb923c" }} /> &gt; 8h/j</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: "#f87171" }} /> &gt; 11h/j</span>
                        <span className="mx-1 text-white/20">·</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: "#60a5fa" }} /> sem. &lt; 35h</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: "#4ade80" }} /> = 35h</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: "#facc15" }} /> &gt; 35h et &lt; 40h</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: "#f87171" }} /> &gt;= 40h</span>
                    </span>
                </div>
            </div>

            {/* ── DROPDOWN HEURES (portal) ─────────────────────────────────── */}
            {dropdownCell && (
                <HoursDropdown
                    anchorRect={dropdownCell.rect}
                    currentHours={getHours(dropdownCell.project, dropdownCell.date)}
                    primaryColor={primaryColor}
                    onSelect={selectHours}
                    onClose={() => setDropdownCell(null)}
                />
            )}

            {/* ── PICKER PROJET (portal) ────────────────────────────────────── */}
            {pickerAnchorRect && createPortal(
                <div
                    ref={pickerRef}
                    className="rounded-2xl overflow-hidden"
                    style={{
                        position: "fixed",
                        top: pickerAnchorRect.bottom + 6,
                        left: pickerAnchorRect.left,
                        width: Math.max(pickerAnchorRect.width, 240),
                        zIndex: 99999,
                        backgroundColor: "var(--bg-secondary)",
                        border: `2px solid ${primaryColor}35`,
                        borderRadius: 16,
                        boxShadow: `0 20px 70px rgba(0,0,0,0.6), 0 0 0 1px ${primaryColor}20`,
                        backdropFilter: "blur(40px) saturate(180%)",
                        WebkitBackdropFilter: "blur(40px) saturate(180%)",
                    }}
                >
                    {/* Gradient overlay vitre */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/[0.02] pointer-events-none" />
                    {/* Reflet lumineux en haut */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

                    <div className="relative z-10">
                        {/* Header */}
                        <div
                            className="flex items-center gap-2 px-3 py-2.5 border-b"
                            style={{ borderColor: `${primaryColor}25`, backgroundColor: `${primaryColor}10` }}
                        >
                            <Plus className="h-3.5 w-3.5 shrink-0" style={{ color: primaryColor }} />
                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                                Ajouter un projet
                            </span>
                        </div>

                        {/* Recherche */}
                        <div className="px-2.5 pt-2.5 pb-1.5">
                            <input
                                type="text"
                                value={pickerSearch}
                                onChange={e => setPickerSearch(e.target.value)}
                                onKeyDown={e => e.stopPropagation()}
                                placeholder="Rechercher un projet..."
                                className="w-full rounded-xl border bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none transition-all"
                                style={{ borderColor: `${primaryColor}30` }}
                                autoFocus
                            />
                        </div>

                        {/* Liste */}
                        <div className="max-h-52 overflow-y-auto pb-1.5">
                            {/* Saisie libre si le texte ne correspond à aucun projet existant */}
                            {pickerSearch.trim() && !orderedProjects.includes(pickerSearch.trim()) && !allProjectNames.some(p => p.toLowerCase() === pickerSearch.trim().toLowerCase()) && (
                                <button
                                    onClick={() => addProject(pickerSearch.trim())}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 transition-colors text-left border-b"
                                    style={{ borderColor: `${primaryColor}20` }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${primaryColor}15`; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                                >
                                    <Plus className="h-3 w-3 shrink-0" style={{ color: primaryColor }} />
                                    <span className="truncate font-semibold" style={{ color: primaryColor }}>
                                        Ajouter « {pickerSearch.trim()} »
                                    </span>
                                </button>
                            )}
                            {pickerProjects.length === 0 && !pickerSearch.trim() ? (
                                <div className="px-3 py-3 text-sm text-white/30 text-center italic">
                                    Aucun projet disponible
                                </div>
                            ) : (
                                pickerProjects.map(p => {
                                    const colors = getProjectColor(p, projectColors);
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => addProject(p)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 hover:bg-white/8 transition-colors text-left"
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${primaryColor}15`; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                                        >
                                            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${colors.bg.replace('/15', '')} border ${colors.border}`} />
                                            <span className="truncate font-medium">{p}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
