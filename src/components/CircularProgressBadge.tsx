import { useEffect, useState } from "react";
import { getProjectColor } from "../utils";

interface CircularProgressBadgeProps {
    project: string;
    percentage: number;
    total: number;
    done: number;
    isSelected: boolean;
    onClick: () => void;
    projectColors: Record<string, number>;
}

/**
 * Badge circulaire avec progress indicator pour les projets
 * Animation fluide du cercle de progression
 */
export function CircularProgressBadge({
    project,
    percentage,
    total,
    done,
    isSelected,
    onClick,
    projectColors
}: CircularProgressBadgeProps) {
    const [animatedPercentage, setAnimatedPercentage] = useState(0);
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

    // Calcul pour le cercle SVG (rayon 16, circonférence 100.53)
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`group relative flex items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border px-2 sm:px-3 py-1.5 sm:py-2 transition-all duration-300 ${colors.border} ${colors.bg} ${
                isSelected
                    ? `${colors.ring} ring-2 shadow-2xl brightness-125 scale-105 ${colors.glow}`
                    : "hover:brightness-110 hover:scale-102 ring-1 ring-white/5"
            }`}
            title={`${cleanProjectName}: ${done}/${total} tâches (${percentage}%)`}
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
            />
        </button>
    );
}
