import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { getProjectColor } from "../utils";
import { PROJECT_COLORS } from "../constants";
import { confirmModal } from "../utils/confirm";

// Couleurs de prévisualisation pour chaque index
const COLOR_PREVIEWS = [
    '#60a5fa', // blue
    '#22d3ee', // cyan
    '#34d399', // emerald
    '#fbbf24', // yellow
    '#fb923c', // orange
    '#fb7185', // rose
    '#c084fc', // purple
    '#818cf8', // indigo
    '#94a3b8', // slate
];

interface CircularProgressBadgeProps {
    project: string;
    percentage: number;
    total: number;
    done: number;
    isSelected: boolean;
    onClick: () => void;
    onArchiveProject?: () => void;
    onRenameProject?: (newName: string) => void;
    projectColors: Record<string, number>;
    onColorChange?: (colorIndex: number) => void;
}

/**
 * Badge circulaire avec progress indicator pour les projets
 * Animation fluide du cercle de progression
 * Clic droit → picker de couleur de projet + renommer + archiver
 */
export function CircularProgressBadge({
    project,
    percentage,
    total,
    done,
    isSelected,
    onClick,
    onArchiveProject,
    onRenameProject,
    projectColors,
    onColorChange,
}: CircularProgressBadgeProps) {
    const [animatedPercentage, setAnimatedPercentage] = useState(0);
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
    const [renameMode, setRenameMode] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);
    const colors = getProjectColor(project, projectColors);

    // Retire la série de chiffres et le " - " du début (ex: "1234567 - PROJET" → "PROJET")
    const cleanProjectName = project.replace(/^\d+\s*-?\s*/, '');

    // Animation spring du pourcentage
    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimatedPercentage(percentage);
        }, 100);
        return () => clearTimeout(timer);
    }, [percentage]);

    // Focus l'input quand le mode renommage s'active
    useEffect(() => {
        if (renameMode) {
            setTimeout(() => renameInputRef.current?.focus(), 50);
        }
    }, [renameMode]);

    // Fermer le menu si clic ailleurs
    useEffect(() => {
        if (!menuPos) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuPos(null);
                setRenameMode(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuPos]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setRenameMode(false);
        setMenuPos({ x: e.clientX, y: e.clientY });
    }, []);

    const handlePickColor = useCallback((idx: number) => {
        onColorChange?.(idx);
        setMenuPos(null);
    }, [onColorChange]);

    const handleGlowContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setRenameMode(false);
        setMenuPos({ x: e.clientX, y: e.clientY });
    }, []);

    const handleArchiveClick = useCallback(async () => {
        if (!onArchiveProject) return;
        const confirmed = await confirmModal(`Archiver le projet "${cleanProjectName}" ?`);
        if (confirmed) {
            onArchiveProject();
            setMenuPos(null);
        }
    }, [onArchiveProject, cleanProjectName]);

    const handleRenameOpen = useCallback(() => {
        setRenameValue(cleanProjectName);
        setRenameMode(true);
    }, [cleanProjectName]);

    const handleRenameConfirm = useCallback(() => {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed.toUpperCase() !== project.toUpperCase()) {
            onRenameProject?.(trimmed);
        }
        setMenuPos(null);
        setRenameMode(false);
    }, [renameValue, project, onRenameProject]);

    const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleRenameConfirm();
        if (e.key === 'Escape') { setRenameMode(false); setMenuPos(null); }
    }, [handleRenameConfirm]);

    // Calcul pour le cercle SVG (rayon 16, circonférence 100.53)
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;

    const currentColorIndex = project in projectColors ? projectColors[project] % PROJECT_COLORS.length : -1;
    const canArchiveFromMenu = !!onArchiveProject;
    const canRename = !!onRenameProject;

    return (
        <>
            <button
                type="button"
                onClick={onClick}
                onContextMenu={handleContextMenu}
                className={`group relative flex items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border px-2 sm:px-3 py-1.5 sm:py-2 transition-all duration-300 ${colors.border} ${colors.bg} ${
                    isSelected
                        ? `${colors.ring} ring-2 shadow-2xl brightness-125 scale-105 ${colors.glow}`
                        : "hover:brightness-110 hover:scale-102 ring-1 ring-white/5"
                }`}
                title={`${cleanProjectName}: ${done}/${total} tâches (${percentage}%) — Clic droit pour options`}
            >
                {/* Circular Progress Indicator */}
                <div className="relative flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center flex-shrink-0">
                    <svg
                        className="absolute inset-0 -rotate-90 transform"
                        width="100%"
                        height="100%"
                        viewBox="0 0 40 40"
                    >
                        {/* Background circle */}
                        <circle
                            cx="20"
                            cy="20"
                            r={radius}
                            stroke="currentColor"
                            strokeWidth="3"
                            fill="none"
                            className="text-white/10"
                        />
                        {/* Progress circle */}
                        <circle
                            cx="20"
                            cy="20"
                            r={radius}
                            stroke="currentColor"
                            strokeWidth="3"
                            fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className={`transition-all duration-1000 ease-out ${
                                percentage === 100
                                    ? "text-emerald-400"
                                    : percentage < 30
                                        ? "text-rose-400"
                                        : "text-cyan-400"
                            } ${isSelected ? "drop-shadow-[0_0_6px_currentColor]" : ""}`}
                        />
                    </svg>
                    {/* Percentage text */}
                    <span className={`text-[10px] sm:text-xs font-black tabular-nums ${
                        percentage === 100
                            ? "text-emerald-400"
                            : percentage < 30
                                ? "text-rose-400"
                                : "text-cyan-400"
                    }`}>
                        {percentage}
                    </span>
                </div>

                {/* Project name */}
                <div className="hidden sm:flex flex-col items-start justify-center min-w-0 max-w-[120px]">
                    <span className={`text-[10px] font-black uppercase tracking-wide leading-tight transition-colors line-clamp-2 ${colors.text} group-hover:text-white`}>
                        {cleanProjectName}
                    </span>
                </div>

                {/* Glow effect on hover */}
                <div
                    className={`absolute inset-0 rounded-xl sm:rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${
                        percentage === 100
                            ? "bg-emerald-400/5"
                            : percentage < 30
                                ? "bg-rose-400/5"
                                : "bg-cyan-400/5"
                    } blur-xl`}
                    onContextMenu={handleGlowContextMenu}
                />
            </button>

            {/* Context menu portal */}
            {menuPos && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[9999] rounded-xl border border-white/15 bg-[#1a1a2e]/95 backdrop-blur-md shadow-2xl p-2"
                    style={{ left: menuPos.x, top: menuPos.y + 6, transform: 'translateX(-50%)' }}
                    onContextMenu={e => e.preventDefault()}
                >
                    <p className="text-[10px] text-white/50 uppercase tracking-widest px-1 pb-1.5">Couleur du projet</p>
                    <div className="grid grid-cols-3 gap-1.5">
                        {COLOR_PREVIEWS.map((hex, idx) => (
                            <button
                                key={idx}
                                onClick={() => handlePickColor(idx)}
                                className="w-8 h-8 rounded-lg transition-all hover:scale-110 hover:ring-2 ring-white/40"
                                style={{
                                    backgroundColor: hex + '33',
                                    border: `2px solid ${hex}66`,
                                    outline: currentColorIndex === idx ? `2px solid ${hex}` : 'none',
                                    outlineOffset: '2px',
                                }}
                                title={`Couleur ${idx + 1}`}
                            >
                                <span className="block w-3 h-3 rounded-full mx-auto" style={{ backgroundColor: hex }} />
                            </button>
                        ))}
                    </div>

                    {(canRename || canArchiveFromMenu) && (
                        <div className="my-2 h-px bg-white/10" />
                    )}

                    {canRename && !renameMode && (
                        <button
                            type="button"
                            onClick={handleRenameOpen}
                            className="w-full rounded-lg border border-sky-400/30 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-sky-200 transition-colors hover:bg-sky-500/20 mb-1.5"
                        >
                            Renommer ce projet
                        </button>
                    )}

                    {canRename && renameMode && (
                        <div className="flex gap-1 mb-1.5">
                            <input
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={handleRenameKeyDown}
                                className="flex-1 rounded-lg border border-sky-400/40 bg-sky-500/10 px-2 py-1 text-[11px] text-white placeholder-white/30 outline-none focus:border-sky-400/70 min-w-0"
                                placeholder="Nouveau nom..."
                                maxLength={80}
                            />
                            <button
                                type="button"
                                onClick={handleRenameConfirm}
                                className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-2 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-500/35 transition-colors"
                            >
                                OK
                            </button>
                        </div>
                    )}

                    {canArchiveFromMenu && (
                        <button
                            type="button"
                            onClick={handleArchiveClick}
                            className="w-full rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-200 transition-colors hover:bg-rose-500/20"
                        >
                            Archiver ce projet
                        </button>
                    )}
                </div>,
                document.body
            )}
        </>
    );
}
