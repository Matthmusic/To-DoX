import { useMemo, useState } from "react";
import {
    FolderPlus,
    Users,
    Printer,
    Trash2,
    Archive,
    Upload,
    Download,
    HardDrive,
    List,
    Settings,
    ChevronDown,
    Plus,
} from "lucide-react";
import ToDoXLogo from "../assets/To Do X.svg";
import { QuickAddPremium } from "./QuickAddPremium";
import { CircularProgressBadge } from "./CircularProgressBadge";
import { DropdownMenu, DropdownItem } from ".";
import useStore from "../store/useStore";

interface KanbanHeaderPremiumProps {
    filterProject: string;
    onProjectClick: (projectName: string) => void;
    onArchiveProject: (projectName: string) => void;
    onOpenWeeklyReport: () => void;
    onOpenStorage: () => void;
    onOpenUsers: () => void;
    onOpenArchive: () => void;
    onOpenDirPanel: () => void;
    onOpenProjectsList: () => void;
    onOpenTaskArchive: () => void;
    onExport: () => void;
    onImport: () => void;
}

/**
 * Header Premium avec design "Floating Command Bar"
 * Row 1: Logo + Projets actifs en circular badges + Menu actions
 * Row 2: QuickAdd Premium avec auto-détection #projet @user
 */
export function KanbanHeaderPremium({
    filterProject,
    onProjectClick,
    onOpenWeeklyReport,
    onOpenStorage,
    onOpenUsers,
    onOpenArchive,
    onOpenDirPanel,
    onOpenProjectsList,
    onOpenTaskArchive,
    onExport,
    onImport,
}: KanbanHeaderPremiumProps) {
    const { tasks, projectColors, currentUser } = useStore();
    const [showQuickAdd, setShowQuickAdd] = useState(false);

    // Statistiques des projets (FILTRÉES par utilisateur courant)
    const projectStats = useMemo(() => {
        const map = new Map<string, { total: number; done: number; completedAt: number | null; pct: number }>();
        for (const t of tasks) {
            if (t.archived || !t.project) continue;

            // FILTRE: Afficher les projets avec des tâches assignées à toi OU créées par toi
            if (currentUser && currentUser !== "unassigned") {
                const isAssigned = t.assignedTo.includes(currentUser);
                const isCreator = t.createdBy === currentUser;
                if (!isAssigned && !isCreator) continue;
            }

            const key = t.project;
            const obj = map.get(key) || { total: 0, done: 0, completedAt: null, pct: 0 };
            obj.total += 1;
            if (t.status === "done") {
                obj.done += 1;
                if (!obj.completedAt || t.updatedAt > obj.completedAt) {
                    obj.completedAt = t.updatedAt;
                }
            }
            map.set(key, obj);
        }
        return [...map.entries()]
            .map(([project, v]) => ({
                project,
                total: v.total,
                done: v.done,
                pct: v.total ? Math.round((v.done / v.total) * 100) : 0,
                completedAt: v.total && v.done === v.total ? v.completedAt : null,
            }))
            .sort((a, b) => b.total - a.total);
    }, [tasks, currentUser]);


    return (
        <header className="kanban-header relative z-10 flex flex-col gap-2 px-4 sm:px-6 py-2 sm:py-3 backdrop-blur-md border-b border-white/5">
            {/* Row 1: Command Strip */}
            <div className="relative flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 sm:px-6 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
                {/* Logo - Ultra Compact */}
                <div className="group flex items-center gap-2 sm:gap-3">
                    <div className="relative flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center transition-all duration-300 hover:scale-110 hover:rotate-3">
                        <img
                            src={ToDoXLogo}
                            alt="Logo"
                            className="h-8 w-8 sm:h-10 sm:w-10 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)] transition-transform duration-300 group-hover:rotate-[-3deg] brightness-0 invert"
                            style={{ filter: 'brightness(0) saturate(100%) invert(66%) sepia(73%) saturate(2234%) hue-rotate(157deg) brightness(95%) contrast(101%)' }}
                        />
                        {/* Rotating glow on hover */}
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-50 group-hover:animate-spin-slow" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="header-title text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-500 bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient-x">
                            TO DO X
                        </h1>
                        <p className="text-[9px] sm:text-[10px] font-black text-cyan-400/70 tracking-[0.2em]">
                            COMMAND CENTER
                        </p>
                    </div>
                </div>

                {/* Toggle QuickAdd Button */}
                <button
                    onClick={() => setShowQuickAdd(!showQuickAdd)}
                    className="flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                    title={showQuickAdd ? "Masquer la création rapide" : "Afficher la création rapide"}
                >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Nouvelle tâche</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showQuickAdd ? 'rotate-180' : ''}`} />
                </button>

                {/* Projects - Circular Progress Badges */}
                <div className="relative flex-1 overflow-hidden">
                    {/* Scrollable container with fade mask */}
                    <div
                        className="flex items-center gap-3 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-cyan-400/30 scroll-smooth pb-1 px-4"
                        style={{
                            maskImage: 'linear-gradient(to right, transparent 0%, black 20px, black calc(100% - 20px), transparent 100%)',
                            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 20px, black calc(100% - 20px), transparent 100%)'
                        }}
                    >
                        {projectStats.map((stat) => (
                            <CircularProgressBadge
                                key={stat.project}
                                project={stat.project}
                                percentage={stat.pct}
                                total={stat.total}
                                done={stat.done}
                                isSelected={filterProject === stat.project}
                                onClick={() => onProjectClick(stat.project)}
                                projectColors={projectColors}
                            />
                        ))}
                    </div>
                </div>

                {/* Actions Menu - Right Side */}
                <div className="flex items-center gap-2">
                    {/* Weekly Report - Highlighted */}
                    <button
                        onClick={onOpenWeeklyReport}
                        className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-slate-900 shadow-lg shadow-blue-500/30 transition-all hover:scale-105 hover:brightness-110"
                        title="Rapport hebdomadaire"
                    >
                        <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span>CR semaine</span>
                    </button>

                    {/* Quick Access Buttons */}
                    <button
                        onClick={onOpenStorage}
                        className="hidden md:flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-slate-300 transition-all hover:scale-105 hover:bg-white/10 hover:text-white"
                        title="Stockage"
                    >
                        <HardDrive className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={onOpenUsers}
                        className="hidden md:flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-slate-300 transition-all hover:scale-105 hover:bg-white/10 hover:text-white"
                        title="Utilisateurs"
                    >
                        <Users className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={onOpenArchive}
                        className="hidden md:flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200 transition-all hover:scale-105 hover:bg-amber-500/20"
                        title="Archives"
                    >
                        <Archive className="h-3.5 w-3.5" />
                    </button>

                    {/* More Menu */}
                    <DropdownMenu
                        icon={Settings}
                        label=""
                        className="rounded-xl border border-white/10 bg-[#0b1124] px-2.5 py-2 hover:bg-white/10 transition-all"
                    >
                        <DropdownItem icon={Printer} label="CR Semaine" onClick={onOpenWeeklyReport} />
                        <DropdownItem icon={HardDrive} label="Stockage" onClick={onOpenStorage} />
                        <DropdownItem icon={Users} label="Utilisateurs" onClick={onOpenUsers} />
                        <DropdownItem icon={Archive} label="Archives" onClick={onOpenArchive} />
                        <div className="my-1 h-px bg-white/10" />
                        <DropdownItem icon={FolderPlus} label="Dossiers projets" onClick={onOpenDirPanel} />
                        <DropdownItem icon={List} label="Gérer projets" onClick={onOpenProjectsList} />
                        <DropdownItem icon={Trash2} label="Corbeille tâches" onClick={onOpenTaskArchive} />
                        <div className="my-1 h-px bg-white/10" />
                        <DropdownItem icon={Download} label="Export JSON" onClick={onExport} />
                        <DropdownItem icon={Upload} label="Import JSON" onClick={onImport} />
                    </DropdownMenu>
                </div>
            </div>

            {/* Row 2: QuickAdd Premium - Collapsible */}
            <div
                className={`mx-auto w-full px-2 sm:px-0 sm:w-[95%] lg:w-[90%] xl:w-[85%] 2xl:w-[80%] overflow-visible transition-all duration-300 ${
                    showQuickAdd ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
                <QuickAddPremium />
            </div>
        </header>
    );
}
