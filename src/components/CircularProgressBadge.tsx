import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { getProjectColor } from "../utils";
import { PROJECT_COLORS } from "../constants";
import { confirmModal } from "../utils/confirm";

// Renommage de projet désactivé côté UI (review finale de branche, régression C3) :
// renameProject reste 100% local dans le store (non convertie en appel réseau, voir son
// commentaire dans useStore.ts) -- le poll 10s de fetchTasks/fetchProjects annulerait donc
// silencieusement un renommage déclenché ici.
const RENAME_DISABLED_MESSAGE = "Renommage de projet indisponible pour le moment — sera restauré dans une prochaine mise à jour.";

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
    const menuRef = useRef<HTMLDivElement>(null);
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

    // Fermer le menu si clic ailleurs
    useEffect(() => {
        if (!menuPos) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuPos(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuPos]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuPos({ x: e.clientX, y: e.clientY });
    }, []);

    const handlePickColor = useCallback((idx: number) => {
        onColorChange?.(idx);
        setMenuPos(null);
    }, [onColorChange]);

    const handleGlowContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
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
                className={`group relative flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-all duration-300 ${colors.border} ${colors.bg} ${
                    isSelected
                        ? `${colors.ring} ring-2 brightness-125 ${colors.glow}`
                        : "hover:brightness-110 ring-1 ring-[rgba(var(--overlay-rgb),0.05)]"
                }`}
                title={`${cleanProjectName}: ${done}/${total} tâches (${percentage}%) — Clic droit pour options`}
                aria-label={`${cleanProjectName}: ${done}/${total} tâches (${percentage}%) — Clic droit pour options`}
            >
                {/* Circular Progress Indicator */}
                <div className="relative flex h-8 w-8 items-center justify-center flex-shrink-0">
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
                            className="text-[rgba(var(--overlay-rgb),0.1)]"
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
                <div className="flex flex-col items-start justify-center min-w-0 max-w-[140px]">
                    <span className={`text-[11px] font-semibold leading-tight transition-colors line-clamp-2 ${colors.text} group-hover:text-[rgb(var(--overlay-rgb))]`}>
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
                    className="fixed z-[9999] rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-theme-secondary backdrop-blur-md shadow-2xl p-2"
                    style={{ left: menuPos.x, top: menuPos.y + 6, transform: 'translateX(-50%)' }}
                    onContextMenu={e => e.preventDefault()}
                >
                    <p className="text-[10px] text-[rgba(var(--overlay-rgb),0.5)] uppercase tracking-widest px-1 pb-1.5">Couleur du projet</p>
                    <div className="grid grid-cols-3 gap-1.5">
                        {COLOR_PREVIEWS.map((hex, idx) => (
                            <button
                                key={idx}
                                onClick={() => handlePickColor(idx)}
                                className="w-8 h-8 rounded-lg transition-all hover:scale-110 hover:ring-2 ring-[rgba(var(--overlay-rgb),0.4)]"
                                style={{
                                    backgroundColor: hex + '33',
                                    border: `2px solid ${hex}66`,
                                    outline: currentColorIndex === idx ? `2px solid ${hex}` : 'none',
                                    outlineOffset: '2px',
                                }}
                                title={`Couleur ${idx + 1}`}
                                aria-label={`Couleur ${idx + 1}`}
                            >
                                <span className="block w-3 h-3 rounded-full mx-auto" style={{ backgroundColor: hex }} />
                            </button>
                        ))}
                    </div>

                    {(canRename || canArchiveFromMenu) && (
                        <div className="my-2 h-px bg-[rgba(var(--overlay-rgb),0.1)]" />
                    )}

                    {canRename && (
                        <button
                            type="button"
                            disabled
                            title={RENAME_DISABLED_MESSAGE}
                            aria-label={RENAME_DISABLED_MESSAGE}
                            className="w-full rounded-lg border border-[rgba(var(--overlay-rgb),0.1)] bg-[rgba(var(--overlay-rgb),0.05)] px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 opacity-50 cursor-not-allowed mb-1.5"
                        >
                            Renommer ce projet
                        </button>
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
