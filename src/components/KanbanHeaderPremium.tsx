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
    BellOff,
    Palette,
    LayoutGrid,
    CalendarDays,
    BarChart3,
    CheckCircle2,
    Clock,
    Menu,
    X,
    ShieldAlert,
    LayoutTemplate,
    Calendar,
} from "lucide-react";
import ToDoXLogo from "../assets/To Do X.svg";
import { QuickAddPremium } from "./QuickAddPremium";
import { CircularProgressBadge } from "./CircularProgressBadge";
import { DropdownMenu, DropdownItem, DropdownSection } from ".";
import { SearchInput } from "./SearchInput";
import useStore from "../store/useStore";
import { useTheme } from "../hooks/useTheme";

interface KanbanHeaderPremiumProps {
    filterProject: string;
    onProjectClick: (projectName: string) => void;
    onArchiveProject: (projectName: string) => void;
    onRenameProject: (oldName: string, newName: string) => void;
    onOpenWeeklyReport: () => void;
    onOpenStorage: () => void;
    onOpenUsers: () => void;
    onOpenArchive: () => void;
    onOpenNotifications: () => void;
    notificationsEnabled: boolean;
    onToggleNotifications: () => void;
    onOpenThemes: () => void;
    onOpenDirPanel: () => void;
    onOpenProjectsList: () => void;
    isAdmin: boolean;
    onOpenAdminProjects: () => void;
    onOpenTaskArchive: () => void;
    onExport: () => void;
    onImport: () => void;
    onOpenHelp: () => void;
    onOpenTemplates: () => void;
    onOpenOutlook: () => void;
    // Mentions non lues
    mentionCount: number;
    // Vue active
    activeView: 'kanban' | 'timeline' | 'dashboard' | 'terminées' | 'pointage';
    onViewChange: (view: 'kanban' | 'timeline' | 'dashboard' | 'terminées' | 'pointage') => void;
    // Recherche
    filterSearch: string;
    onSearchChange: (value: string) => void;
    searchInputRef?: React.RefObject<{ focus: () => void } | null>;
    showSearch: boolean;
    // QuickAdd
    quickAddRef?: React.RefObject<{ focus: () => void; prefillProject: (project: string) => void } | null>;
    /** Incrémenter pour ouvrir le panneau QuickAdd et focus l'input (Ctrl+N) */
    triggerOpenQuickAdd?: number;
    /** Ouvrir le QuickAdd avec un projet prérempli (clic droit sur en-tête projet) */
    triggerOpenWithProject?: { count: number; project: string };
}

/**
 * Header Premium avec design "Floating Command Bar"
 * Row 1: Logo + Projets actifs en circular badges + Menu actions
 * Row 2: QuickAdd Premium avec auto-détection #projet @user
 * Mobile: Barre compacte + burger menu
 */
export function KanbanHeaderPremium({
    filterProject,
    onProjectClick,
    onArchiveProject,
    onRenameProject,
    onOpenWeeklyReport,
    onOpenStorage,
    onOpenUsers,
    onOpenArchive,
    onOpenNotifications,
    notificationsEnabled,
    onToggleNotifications,
    onOpenThemes,
    onOpenDirPanel,
    onOpenProjectsList,
    isAdmin,
    onOpenAdminProjects,
    onOpenTaskArchive,
    onExport,
    onImport,
    onOpenHelp,
    onOpenTemplates,
    onOpenOutlook,
    mentionCount,
    activeView,
    onViewChange,
    filterSearch,
    onSearchChange,
    searchInputRef,
    showSearch,
    quickAddRef,
    triggerOpenQuickAdd,
    triggerOpenWithProject,
}: KanbanHeaderPremiumProps) {
    const { tasks, projectColors, currentUser, viewAsUser, setProjectColor } = useStore();
    const { activeTheme } = useTheme();
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [showBurgerMenu, setShowBurgerMenu] = useState(false);
    const quickAddContainerRef = useRef<HTMLDivElement>(null);
    const toggleButtonRef = useRef<HTMLButtonElement>(null);
    const mobileToggleButtonRef = useRef<HTMLButtonElement>(null);
    const burgerButtonRef = useRef<HTMLButtonElement>(null);
    const burgerMenuRef = useRef<HTMLDivElement>(null);

    // Couleurs du thème actif pour le header
    const primaryColor = activeTheme.palette.primary;
    const secondaryColor = activeTheme.palette.secondary;

    // Fermer QuickAdd lors d'un clic à l'extérieur
    useEffect(() => {
        if (!showQuickAdd) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                toggleButtonRef.current?.contains(target) ||
                mobileToggleButtonRef.current?.contains(target) ||
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
            setTimeout(() => {
                quickAddRef?.current?.focus();
            }, 100);
        }
    }, [showQuickAdd, quickAddRef]);

    // Ouvrir + focus via raccourci clavier Ctrl+N (triggerOpenQuickAdd s'incrémente)
    useEffect(() => {
        if (!triggerOpenQuickAdd) return;
        setShowQuickAdd(true);
        // Le focus est géré par l'effet showQuickAdd ci-dessus
    }, [triggerOpenQuickAdd]);

    // Ouvrir le QuickAdd avec un projet prérempli (clic droit sur en-tête projet)
    useEffect(() => {
        if (!triggerOpenWithProject?.count) return;
        setShowQuickAdd(true);
        setTimeout(() => {
            quickAddRef?.current?.prefillProject(triggerOpenWithProject.project);
        }, 120);
    }, [triggerOpenWithProject, quickAddRef]);

    // Fermer le burger menu lors d'un clic à l'extérieur
    useEffect(() => {
        if (!showBurgerMenu) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                burgerButtonRef.current?.contains(target) ||
                burgerMenuRef.current?.contains(target)
            ) {
                return;
            }
            setShowBurgerMenu(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showBurgerMenu]);

    // Helper : appelle une action et ferme le burger
    const burgerAction = (fn: () => void) => () => { fn(); setShowBurgerMenu(false); };

    // Statistiques des projets (FILTRÉES par utilisateur courant)
    const projectStats = useMemo(() => {
        const map = new Map<string, { total: number; done: number; completedAt: number | null; pct: number }>();
        for (const t of tasks) {
            if (t.archived || !t.project) continue;

            const effectiveUser = viewAsUser ?? currentUser;
            if (effectiveUser && effectiveUser !== "unassigned") {
                const isAssigned = t.assignedTo.includes(effectiveUser);
                const isCreator = t.createdBy === effectiveUser;
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
    }, [tasks, currentUser, viewAsUser]);

    const viewButtons = [
        { id: 'kanban' as const, Icon: LayoutGrid, label: 'Kanban' },
        { id: 'timeline' as const, Icon: CalendarDays, label: 'Timeline' },
        { id: 'terminées' as const, Icon: CheckCircle2, label: 'Terminées' },
        { id: 'dashboard' as const, Icon: BarChart3, label: 'Dashboard' },
        { id: 'pointage' as const, Icon: Clock, label: 'Pointage' },
    ];

    const commandBarStyle = {
        backgroundColor: 'var(--bg-tertiary)',
        borderColor: `${primaryColor}30`,
        boxShadow: `0 0 0 1px ${primaryColor}33, 0 0 20px ${primaryColor}26, 0 4px 12px -2px rgba(0, 0, 0, 0.4)`
    };

    return (
        <header
            className="kanban-header relative z-10 flex flex-col gap-2 px-2 sm:px-4 md:px-6 py-2 sm:py-3 border-b-2 border-theme-primary"
        >
            <style>{`
                @keyframes glow-pulse {
                    0%, 100% { box-shadow: 0 0 15px ${primaryColor}40, 0 0 30px ${primaryColor}20; }
                    50% { box-shadow: 0 0 20px ${primaryColor}60, 0 0 40px ${primaryColor}30, 0 0 60px ${primaryColor}15; }
                }
                .animate-glow-pulse { animation: glow-pulse 3s ease-in-out infinite; }
            `}</style>

            {/* ── MOBILE BAR (< md) ── */}
            <div
                className="md:hidden flex items-center gap-1.5 rounded-2xl border-2 px-2 py-1.5"
                style={commandBarStyle}
            >
                {/* Logo icon */}
                <div
                    className="h-7 w-7 shrink-0"
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
                        filter: `drop-shadow(0 0 6px ${primaryColor}99)`
                    }}
                />

                {/* View toggle — icônes seulement */}
                <div className="flex rounded-xl overflow-hidden border border-white/10">
                    {viewButtons.map(({ id, Icon, label }) => (
                        <button
                            key={id}
                            onClick={() => onViewChange(id)}
                            className="flex items-center justify-center px-2 py-2 transition-colors"
                            style={
                                activeView === id
                                    ? id === 'terminées'
                                        ? { backgroundColor: 'rgba(52,211,153,0.15)', color: 'rgb(52,211,153)' }
                                        : id === 'pointage'
                                            ? { backgroundColor: 'rgba(251,191,36,0.15)', color: 'rgb(251,191,36)' }
                                            : { backgroundColor: `${primaryColor}25`, color: primaryColor }
                                    : { color: 'rgba(255,255,255,0.72)' }
                            }
                            title={label}
                        >
                            <Icon className="h-3.5 w-3.5" />
                        </button>
                    ))}
                </div>

                <div className="flex-1" />

                {/* Notifications toggle */}
                <button
                    onClick={onToggleNotifications}
                    className="relative flex items-center justify-center rounded-xl border px-2 py-2 text-xs transition-all hover:scale-105"
                    style={!notificationsEnabled
                        ? { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.25)' }
                        : mentionCount > 0
                            ? { borderColor: 'rgba(245,158,11,0.45)', backgroundColor: 'rgba(245,158,11,0.15)', color: '#fcd34d' }
                            : { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)' }
                    }
                    title={notificationsEnabled ? 'Notifications activées — cliquer pour désactiver' : 'Notifications désactivées — cliquer pour activer'}
                >
                    {notificationsEnabled
                        ? <Bell className="h-4 w-4" />
                        : <BellOff className="h-4 w-4" />
                    }
                    {notificationsEnabled && mentionCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 animate-pulse items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black">
                            {mentionCount > 9 ? '9+' : mentionCount}
                        </span>
                    )}
                </button>

                {/* Nouvelle tâche */}
                <button
                    ref={mobileToggleButtonRef}
                    onClick={() => setShowQuickAdd(!showQuickAdd)}
                    className="flex items-center justify-center rounded-xl border px-2 py-2 animate-glow-pulse"
                    style={{
                        borderColor: `${primaryColor}30`,
                        backgroundColor: `${primaryColor}10`,
                        color: `${primaryColor}e6`,
                    }}
                    title="Nouvelle tâche"
                >
                    <Plus className="h-4 w-4" />
                </button>

                {/* Burger button */}
                <button
                    ref={burgerButtonRef}
                    onClick={() => setShowBurgerMenu(!showBurgerMenu)}
                    className="flex items-center justify-center rounded-xl border border-theme-primary bg-white/5 px-2 py-2 text-theme-secondary transition-all hover:bg-white/10 hover:text-theme-primary"
                    title={showBurgerMenu ? 'Fermer le menu' : 'Menu'}
                >
                    {showBurgerMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>
            </div>

            {/* ── BURGER MENU DROPDOWN (mobile only) ── */}
            {showBurgerMenu && (
                <div
                    ref={burgerMenuRef}
                    className="md:hidden rounded-2xl border-2 overflow-hidden"
                    style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        borderColor: `${primaryColor}30`,
                        boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px ${primaryColor}22`
                    }}
                >
                    {/* CR Semaine — mis en avant */}
                    <button
                        onClick={burgerAction(onOpenWeeklyReport)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-white transition-colors hover:brightness-110"
                        style={{
                            backgroundImage: `linear-gradient(to right, ${primaryColor}22, ${secondaryColor}22)`,
                            borderBottom: `1px solid rgba(255,255,255,0.06)`
                        }}
                    >
                        <Printer className="h-4 w-4" style={{ color: primaryColor }} />
                        CR Semaine
                    </button>

                    {/* Grille 3 colonnes — actions principales */}
                    <div className="grid grid-cols-3">
                        {[
                            { icon: Bell, label: 'Notifs', action: onOpenNotifications },
                            { icon: Palette, label: 'Thèmes', action: onOpenThemes },
                            { icon: HelpCircle, label: 'Aide', action: onOpenHelp },
                        ].map(({ icon: Icon, label, action }) => (
                            <button
                                key={label}
                                onClick={burgerAction(action)}
                                className="flex flex-col items-center gap-1.5 px-3 py-3 text-[11px] text-theme-secondary transition-colors hover:bg-white/5 hover:text-theme-primary border-b border-r border-white/5 last:border-r-0"
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Grille 3 colonnes — gestion */}
                    <div className="grid grid-cols-3 border-t border-white/5">
                        {[
                            { icon: FolderPlus, label: 'Dossiers', action: onOpenDirPanel },
                            { icon: List, label: 'Projets', action: onOpenProjectsList },
                            { icon: Trash2, label: 'Corbeille', action: onOpenTaskArchive },
                        ].map(({ icon: Icon, label, action }) => (
                            <button
                                key={label}
                                onClick={burgerAction(action)}
                                className="flex flex-col items-center gap-1.5 px-3 py-3 text-[11px] text-theme-secondary transition-colors hover:bg-white/5 hover:text-theme-primary border-r border-white/5 last:border-r-0"
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </button>
                        ))}
                    </div>

                    {isAdmin && (
                        <button
                            onClick={burgerAction(onOpenAdminProjects)}
                            className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-400/10 border-t border-white/5"
                        >
                            <ShieldAlert className="h-4 w-4" />
                            Admin projets (JSON)
                        </button>
                    )}

                    {/* Export / Import */}
                    <div className="grid grid-cols-2 border-t border-white/5">
                        {[
                            { icon: Download, label: 'Export JSON', action: onExport },
                            { icon: Upload, label: 'Import JSON', action: onImport },
                        ].map(({ icon: Icon, label, action }) => (
                            <button
                                key={label}
                                onClick={burgerAction(action)}
                                className="flex items-center gap-2 px-4 py-3 text-xs text-theme-secondary transition-colors hover:bg-white/5 hover:text-theme-primary border-r border-white/5 last:border-r-0"
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── DESKTOP ROW 1 (≥ md) ── */}
            <div
                className="relative hidden md:flex items-center justify-between gap-2 sm:gap-4 rounded-3xl border-2 px-2 sm:px-4 md:px-6 py-2"
                style={commandBarStyle}
            >
                {/* Logo - Ultra Compact */}
                <div className="group flex items-center gap-2 shrink-0">
                    <div className="relative flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center transition-all duration-300 hover:scale-110 hover:rotate-3">
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
                        <div
                            className="absolute inset-0 rounded-xl opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-50 group-hover:animate-spin-slow"
                            style={{
                                background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor}, ${primaryColor})`
                            }}
                        />
                    </div>
                    <div className="hidden sm:flex flex-col">
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

                {/* Search Input - Compact (appear on Ctrl+F) */}
                {showSearch && (
                    <div className="w-full md:w-64 md:block">
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
                                onArchiveProject={() => onArchiveProject(stat.project)}
                                onRenameProject={(newName) => onRenameProject(stat.project, newName)}
                                projectColors={projectColors}
                                onColorChange={(idx) => setProjectColor(stat.project, idx)}
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

                    {/* View Toggle (Kanban / Timeline / Dashboard / Terminées) */}
                    <div className="flex rounded-xl overflow-hidden border border-white/10 overflow-x-auto">
                        {viewButtons.map(({ id, Icon, label }) => (
                            <button
                                key={id}
                                onClick={() => onViewChange(id)}
                                className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold transition-colors"
                                style={
                                    activeView === id
                                        ? id === 'terminées'
                                            ? { backgroundColor: 'rgba(52,211,153,0.15)', color: 'rgb(52,211,153)' }
                                            : id === 'pointage'
                                                ? { backgroundColor: 'rgba(251,191,36,0.15)', color: 'rgb(251,191,36)' }
                                                : { backgroundColor: `${primaryColor}25`, color: primaryColor }
                                        : { color: 'rgba(255,255,255,0.72)' }
                                }
                                title={`Vue ${label}`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                <span className="hidden lg:inline">{label}</span>
                            </button>
                        ))}
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

                    {/* Notifications toggle */}
                    <button
                        onClick={onToggleNotifications}
                        className="relative flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs transition-all hover:scale-105"
                        style={!notificationsEnabled
                            ? { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.25)' }
                            : mentionCount > 0
                                ? { borderColor: 'rgba(245,158,11,0.45)', backgroundColor: 'rgba(245,158,11,0.15)', color: '#fcd34d' }
                                : { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)' }
                        }
                        title={notificationsEnabled ? 'Notifications activées — cliquer pour désactiver' : 'Notifications désactivées — cliquer pour activer'}
                    >
                        {notificationsEnabled
                            ? <Bell className="h-3.5 w-3.5" />
                            : <BellOff className="h-3.5 w-3.5" />
                        }
                        {notificationsEnabled && mentionCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 animate-pulse items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black">
                                {mentionCount > 9 ? '9+' : mentionCount}
                            </span>
                        )}
                    </button>

                    {/* Settings Menu */}
                    <DropdownMenu
                        icon={Settings}
                        label=""
                        className="rounded-xl border border-theme-primary bg-theme-secondary/60 px-2.5 py-2 hover:bg-theme-secondary/80 transition-all text-white/80"
                    >
                        <DropdownSection label="Paramètres" />
                        <DropdownItem icon={Palette} label="Thèmes" onClick={onOpenThemes} />
                        <DropdownItem icon={Bell} label="Notifications" onClick={onOpenNotifications} />
                        <DropdownItem icon={LayoutTemplate} label="Templates" onClick={onOpenTemplates} />
                        <DropdownItem icon={Calendar} label="Outlook / ICS" onClick={onOpenOutlook} />
                        <DropdownItem icon={Users} label="Utilisateurs" onClick={onOpenUsers} />
                        <DropdownItem icon={HardDrive} label="Stockage" onClick={onOpenStorage} />

                        <div className="my-1 h-px bg-theme-primary" />
                        <DropdownSection label="Projets" />
                        <DropdownItem icon={FolderPlus} label="Dossiers projets" onClick={onOpenDirPanel} />
                        <DropdownItem icon={List} label="Gérer projets" onClick={onOpenProjectsList} />
                        {isAdmin && (
                            <DropdownItem icon={ShieldAlert} label="Admin (JSON)" onClick={onOpenAdminProjects} />
                        )}

                        <div className="my-1 h-px bg-theme-primary" />
                        <DropdownSection label="Données" />
                        <DropdownItem icon={Archive} label="Archives" onClick={onOpenArchive} />
                        <DropdownItem icon={Trash2} label="Corbeille tâches" onClick={onOpenTaskArchive} />
                        <DropdownItem icon={Download} label="Export JSON" onClick={onExport} />
                        <DropdownItem icon={Upload} label="Import JSON" onClick={onImport} />
                    </DropdownMenu>
                </div>
            </div>

            {/* Row 2: QuickAdd Premium - Collapsible */}
            <div
                ref={quickAddContainerRef}
                className={`mx-auto w-full px-2 sm:px-0 sm:w-[80%] lg:w-[75%] xl:w-[70%] 2xl:w-[65%] overflow-visible transition-all duration-300 ${
                    showQuickAdd ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
                }`}
            >
                <QuickAddPremium ref={quickAddRef} />
            </div>
        </header>
    );
}
