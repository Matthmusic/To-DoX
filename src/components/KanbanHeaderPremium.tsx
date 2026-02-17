import { useMemo, useState, useEffect, useRef } from "react";
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
    HelpCircle,
    Bell,
    Palette,
    LayoutGrid,
    CalendarDays,
} from "lucide-react";
import ToDoXLogo from "../assets/To Do X.svg";
import { QuickAddPremium } from "./QuickAddPremium";
import { CircularProgressBadge } from "./CircularProgressBadge";
import { DropdownMenu, DropdownItem } from ".";
import { SearchInput } from "./SearchInput";
import useStore from "../store/useStore";
import { useTheme } from "../hooks/useTheme";

interface KanbanHeaderPremiumProps {
    filterProject: string;
    onProjectClick: (projectName: string) => void;
    onArchiveProject: (projectName: string) => void;
    onOpenWeeklyReport: () => void;
    onOpenStorage: () => void;
    onOpenUsers: () => void;
    onOpenArchive: () => void;
    onOpenNotifications: () => void;
    onOpenThemes: () => void;
    onOpenDirPanel: () => void;
    onOpenProjectsList: () => void;
    onOpenTaskArchive: () => void;
    onExport: () => void;
    onImport: () => void;
    onOpenHelp: () => void;
    // Vue active
    activeView: 'kanban' | 'timeline';
    onViewChange: (view: 'kanban' | 'timeline') => void;
    // Recherche
    filterSearch: string;
    onSearchChange: (value: string) => void;
    searchInputRef?: React.RefObject<{ focus: () => void } | null>;
    showSearch: boolean;
    // QuickAdd
    quickAddRef?: React.RefObject<{ focus: () => void } | null>;
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
    onOpenNotifications,
    onOpenThemes,
    onOpenDirPanel,
    onOpenProjectsList,
    onOpenTaskArchive,
    onExport,
    onImport,
    onOpenHelp,
    activeView,
    onViewChange,
    filterSearch,
    onSearchChange,
    searchInputRef,
    showSearch,
    quickAddRef,
}: KanbanHeaderPremiumProps) {
    const { tasks, projectColors, currentUser } = useStore();
    const { activeTheme } = useTheme();
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const quickAddContainerRef = useRef<HTMLDivElement>(null);
    const toggleButtonRef = useRef<HTMLButtonElement>(null);

    // Couleurs du thème actif pour le header
    const primaryColor = activeTheme.palette.primary;
    const secondaryColor = activeTheme.palette.secondary;

    // Fermer QuickAdd lors d'un clic à l'extérieur
    useEffect(() => {
        if (!showQuickAdd) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            // Ne pas fermer si on clique sur le bouton toggle ou sur le QuickAdd lui-même
            if (
                toggleButtonRef.current?.contains(target) ||
                quickAddContainerRef.current?.contains(target)
            ) {
                return;
            }

            setShowQuickAdd(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showQuickAdd]);

    // Focus automatique sur l'input QuickAdd quand il s'ouvre
    useEffect(() => {
        if (showQuickAdd) {
            // Petit délai pour laisser l'animation se terminer
            setTimeout(() => {
                quickAddRef?.current?.focus();
            }, 100);
        }
    }, [showQuickAdd, quickAddRef]);

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
        <header
            className="kanban-header relative z-10 flex flex-col gap-2 px-4 sm:px-6 py-2 sm:py-3 border-b-2 border-theme-primary"
        >
            {/* Row 1: Command Strip */}
            <div
                className="relative flex items-center justify-between gap-4 rounded-3xl border-2 px-4 sm:px-6 py-2"
                style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    borderColor: `${primaryColor}30`,
                    boxShadow: `0 0 0 1px ${primaryColor}33, 0 0 20px ${primaryColor}26, 0 4px 12px -2px rgba(0, 0, 0, 0.4)`
                }}
            >
                {/* Logo - Ultra Compact */}
                <div className="group flex items-center gap-2 sm:gap-3">
                    <div className="relative flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center transition-all duration-300 hover:scale-110 hover:rotate-3">
                        {/* Logo avec couleur dynamique */}
                        <div
                            className="h-8 w-8 sm:h-10 sm:w-10 transition-transform duration-300 group-hover:rotate-[-3deg]"
                            style={{
                                WebkitMaskImage: `url(${ToDoXLogo})`,
                                maskImage: `url(${ToDoXLogo})`,
                                WebkitMaskSize: 'contain',
                                maskSize: 'contain',
                                WebkitMaskRepeat: 'no-repeat',
                                maskRepeat: 'no-repeat',
                                WebkitMaskPosition: 'center',
                                maskPosition: 'center',
                                backgroundColor: primaryColor,
                                filter: `drop-shadow(0 0 8px ${primaryColor}99)`
                            }}
                        />
                        {/* Rotating glow on hover */}
                        <div
                            className="absolute inset-0 rounded-xl opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-50 group-hover:animate-spin-slow"
                            style={{
                                background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor}, ${primaryColor})`
                            }}
                        />
                    </div>
                    <div className="flex flex-col">
                        <h1
                            className="header-title text-xl sm:text-2xl font-black tracking-tight bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient-x"
                            style={{
                                backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor}, ${primaryColor})`
                            }}
                        >
                            TO DO X
                        </h1>
                        <p
                            className="text-[9px] sm:text-[10px] font-black tracking-[0.2em]"
                            style={{ color: `${primaryColor}b3` }}
                        >
                            COMMAND CENTER
                        </p>
                    </div>
                </div>

                {/* Toggle QuickAdd Button */}
                <button
                    ref={toggleButtonRef}
                    onClick={() => setShowQuickAdd(!showQuickAdd)}
                    className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 animate-glow-pulse"
                    style={{
                        borderColor: `${primaryColor}30`,
                        backgroundColor: `${primaryColor}10`,
                        color: `${primaryColor}e6`,
                        ['--focus-ring-color' as any]: `${primaryColor}80`,
                        boxShadow: `0 0 15px ${primaryColor}40, 0 0 30px ${primaryColor}20`
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${primaryColor}33`}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${primaryColor}10`}
                    title={showQuickAdd ? "Masquer la création rapide" : "Afficher la création rapide"}
                >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Nouvelle tâche</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showQuickAdd ? 'rotate-180' : ''}`} />
                </button>
                <style>{`
                    @keyframes glow-pulse {
                        0%, 100% {
                            box-shadow: 0 0 15px ${primaryColor}40, 0 0 30px ${primaryColor}20;
                        }
                        50% {
                            box-shadow: 0 0 20px ${primaryColor}60, 0 0 40px ${primaryColor}30, 0 0 60px ${primaryColor}15;
                        }
                    }
                    .animate-glow-pulse {
                        animation: glow-pulse 3s ease-in-out infinite;
                    }
                `}</style>

                {/* Search Input - Compact (appear on Ctrl+F) */}
                {showSearch && (
                    <div className="hidden md:block w-64">
                        <SearchInput
                            ref={searchInputRef}
                            value={filterSearch}
                            onChange={onSearchChange}
                            placeholder="Rechercher... (Esc pour fermer)"
                        />
                    </div>
                )}

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
                        className="flex items-center gap-2 rounded-2xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-lg transition-all hover:scale-105 hover:brightness-110"
                        style={{
                            backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
                            boxShadow: `0 10px 15px -3px ${primaryColor}30, 0 4px 6px -4px ${primaryColor}30`
                        }}
                        title="Rapport hebdomadaire"
                    >
                        <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span>CR semaine</span>
                    </button>

                    {/* Quick Access Buttons */}
                    <button
                        onClick={onOpenStorage}
                        className="hidden md:flex items-center gap-1.5 rounded-xl border border-theme-primary bg-white/5 px-2.5 py-2 text-xs text-theme-secondary transition-all hover:scale-105 hover:bg-white/10 hover:text-theme-primary"
                        title="Stockage"
                    >
                        <HardDrive className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={onOpenUsers}
                        className="hidden md:flex items-center gap-1.5 rounded-xl border border-theme-primary bg-white/5 px-2.5 py-2 text-xs text-theme-secondary transition-all hover:scale-105 hover:bg-white/10 hover:text-theme-primary"
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
                        className="rounded-xl border border-theme-primary bg-theme-secondary/60 px-2.5 py-2 hover:bg-theme-secondary/80 transition-all text-theme-primary"
                    >
                        <DropdownItem icon={Printer} label="CR Semaine" onClick={onOpenWeeklyReport} />
                        <DropdownItem icon={HardDrive} label="Stockage" onClick={onOpenStorage} />
                        <DropdownItem icon={Users} label="Utilisateurs" onClick={onOpenUsers} />
                        <DropdownItem icon={Bell} label="Notifications" onClick={onOpenNotifications} />
                        <DropdownItem icon={Palette} label="Thèmes" onClick={onOpenThemes} />
                        <DropdownItem icon={Archive} label="Archives" onClick={onOpenArchive} />
                        <div className="my-1 h-px bg-theme-primary" />
                        <DropdownItem icon={FolderPlus} label="Dossiers projets" onClick={onOpenDirPanel} />
                        <DropdownItem icon={List} label="Gérer projets" onClick={onOpenProjectsList} />
                        <DropdownItem icon={Trash2} label="Corbeille tâches" onClick={onOpenTaskArchive} />
                        <div className="my-1 h-px bg-theme-primary" />
                        <DropdownItem icon={Download} label="Export JSON" onClick={onExport} />
                        <DropdownItem icon={Upload} label="Import JSON" onClick={onImport} />
                    </DropdownMenu>

                    {/* View Toggle (Kanban / Timeline) */}
                    <div className="flex rounded-xl overflow-hidden border border-white/10">
                        <button
                            onClick={() => onViewChange('kanban')}
                            className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold transition-colors"
                            style={activeView === 'kanban'
                                ? { backgroundColor: `${primaryColor}25`, color: primaryColor }
                                : { color: 'rgba(255,255,255,0.35)' }
                            }
                            title="Vue Kanban"
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">Kanban</span>
                        </button>
                        <button
                            onClick={() => onViewChange('timeline')}
                            className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold transition-colors"
                            style={activeView === 'timeline'
                                ? { backgroundColor: `${primaryColor}25`, color: primaryColor }
                                : { color: 'rgba(255,255,255,0.35)' }
                            }
                            title="Vue Timeline"
                        >
                            <CalendarDays className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">Timeline</span>
                        </button>
                    </div>

                    {/* Help Button */}
                    <button
                        onClick={onOpenHelp}
                        className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs transition-all hover:scale-105"
                        style={{
                            borderColor: `${primaryColor}33`,
                            backgroundColor: `${primaryColor}10`,
                            color: `${primaryColor}cc`
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${primaryColor}33`}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${primaryColor}10`}
                        title="Aide (F1)"
                    >
                        <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Row 2: QuickAdd Premium - Collapsible */}
            <div
                ref={quickAddContainerRef}
                className={`mx-auto w-full px-2 sm:px-0 sm:w-[95%] lg:w-[90%] xl:w-[85%] 2xl:w-[80%] overflow-visible transition-all duration-300 ${
                    showQuickAdd ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
                <QuickAddPremium ref={quickAddRef} />
            </div>
        </header>
    );
}
