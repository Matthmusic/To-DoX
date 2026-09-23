import { useMemo, useState, useEffect, useRef } from "react";
import {
    FolderPlus,
    Users,
    Printer,
    Trash2,
    Archive,
    Upload,
    Download,
    UserCircle,
    List,
    Search,
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
    ShieldAlert,
    LayoutTemplate,
    Calendar,
} from "lucide-react";
import logoSvg from "../assets/To Do X.svg";
import { QuickAddPremium } from "./QuickAddPremium";
import { CircularProgressBadge } from "./CircularProgressBadge";
import { DropdownMenu, DropdownItem, DropdownSection } from ".";
import { SearchInput } from "./SearchInput";
import useStore from "../store/useStore";
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from "../hooks/useTheme";

interface KanbanHeaderPremiumProps {
    filterProject: string;
    onProjectClick: (projectName: string) => void;
    onArchiveProject: (projectName: string) => void;
    onRenameProject: (oldName: string, newName: string) => void;
    onOpenWeeklyReport: () => void;
    onOpenAccount: () => void;
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
    onOpenSearch: () => void;
    // QuickAdd
    quickAddRef?: React.RefObject<{ focus: () => void; prefillProject: (project: string) => void } | null>;
    /** Incrémenter pour ouvrir le panneau QuickAdd et focus l'input (Ctrl+N) */
    triggerOpenQuickAdd?: number;
    /** Ouvrir le QuickAdd avec un projet prérempli (clic droit sur en-tête projet) */
    triggerOpenWithProject?: { count: number; project: string };
}

/**
 * Commandes principales, puis navigation et filtres projets.
 * Les actions secondaires partagent le même menu sur desktop et mobile.
 */
export function KanbanHeaderPremium({
    filterProject,
    onProjectClick,
    onArchiveProject,
    onRenameProject,
    onOpenWeeklyReport,
    onOpenAccount,
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
    onOpenSearch,
    quickAddRef,
    triggerOpenQuickAdd,
    triggerOpenWithProject,
}: KanbanHeaderPremiumProps) {
    const { tasks, projectColors, currentUser, viewAsUser, setProjectColor, notificationPanelSide } = useStore(useShallow((s) => ({ tasks: s.tasks, projectColors: s.projectColors, currentUser: s.currentUser, viewAsUser: s.viewAsUser, setProjectColor: s.setProjectColor, notificationPanelSide: s.notificationPanelSide })));
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
                // completedAt (posé quand le statut passe à "done") est plus fiable que
                // updatedAt : updatedAt bouge dès qu'on retouche la tâche plus tard
                // (renommage, réassignation...) et ferait repartir le délai à zéro.
                const finishedAt = t.completedAt ?? t.updatedAt;
                if (!obj.completedAt || finishedAt > obj.completedAt) {
                    obj.completedAt = finishedAt;
                }
            }
            map.set(key, obj);
        }
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        return [...map.entries()]
            .map(([project, v]) => ({
                project,
                total: v.total,
                done: v.done,
                pct: v.total ? Math.round((v.done / v.total) * 100) : 0,
                completedAt: v.total && v.done === v.total ? v.completedAt : null,
            }))
            // Un dossier resté à 100% plus d'une semaine sort du Command Center — il
            // reste consultable dans "Terminées"/Dashboard, juste plus épinglé ici.
            .filter((p) => !(p.completedAt && now - p.completedAt > ONE_WEEK_MS))
            .sort((a, b) => {
                // Dossiers actifs toujours avant les dossiers 100% terminés — sinon un
                // dossier fini avec peu de tâches se fait discrètement repousser hors du
                // cadre visible (masqué par le fondu) par l'accumulation de tâches sur
                // les dossiers actifs au fil des jours.
                const aDone = a.total > 0 && a.done === a.total;
                const bDone = b.total > 0 && b.done === b.total;
                if (aDone !== bDone) return aDone ? 1 : -1;
                return b.total - a.total;
            });
    }, [tasks, currentUser, viewAsUser]);

    const viewButtons = [
        { id: 'kanban' as const, Icon: LayoutGrid, label: 'Kanban' },
        { id: 'timeline' as const, Icon: CalendarDays, label: 'Timeline' },
        { id: 'terminées' as const, Icon: CheckCircle2, label: 'Terminées' },
        { id: 'dashboard' as const, Icon: BarChart3, label: 'Dashboard' },
        { id: 'pointage' as const, Icon: Clock, label: 'Pointage' },
    ];

    return (
        <header className={`kanban-header relative z-10 flex shrink-0 min-w-0 flex-col gap-2 py-2 ${notificationPanelSide === 'left' ? 'pr-2 pl-24 sm:pr-4 lg:pr-6' : 'pl-2 pr-24 sm:pl-4 lg:pl-6'}`}>
            {/* max-w-2400px + mx-auto : reste aligné avec .kanban-row (même plafond) sur les
                écrans très larges, plutôt que de s'étirer bord à bord dans le header. */}
            <div className="min-w-0 max-w-[2400px] w-full mx-auto rounded-2xl border border-theme-primary px-3 py-2.5 sm:px-4" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                    {!window.electronAPI?.isElectron && (
                        <img
                            src={logoSvg}
                            alt="To-DoX"
                            className="h-6 w-auto shrink-0"
                        />
                    )}
                    <select
                        aria-label="Vue des tâches"
                        value={activeView}
                        onChange={(event) => onViewChange(event.target.value as KanbanHeaderPremiumProps['activeView'])}
                        className="min-w-0 flex-1 rounded-lg border border-theme-primary bg-theme-secondary px-3 py-2 text-sm text-theme-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-white md:hidden"
                    >
                        {viewButtons.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
                    </select>
                    <nav aria-label="Vues des tâches" className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-1 md:flex">
                        {viewButtons.map(({ id, Icon, label }) => (
                            <button key={id} type="button" onClick={() => onViewChange(id)} aria-current={activeView === id ? 'page' : undefined}
                                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-sm ${activeView === id ? 'bg-[rgba(var(--overlay-rgb),0.1)] text-theme-primary' : 'text-theme-secondary hover:bg-[rgba(var(--overlay-rgb),0.05)] hover:text-theme-primary'}`}>
                                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                {label}
                            </button>
                        ))}
                    </nav>
                    <button
                        ref={toggleButtonRef}
                        type="button"
                        onClick={() => setShowQuickAdd(!showQuickAdd)}
                        aria-expanded={showQuickAdd}
                        aria-controls="header-quick-add"
                        className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), linear-gradient(to right, ${primaryColor}, ${secondaryColor})` }}
                    >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Nouvelle tâche
                        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${showQuickAdd ? 'rotate-180' : ''}`} />
                    </button>
                    <button type="button" onClick={onOpenSearch} aria-label="Rechercher des tâches" aria-expanded={showSearch} aria-controls="header-search" title="Rechercher (Ctrl+F)"
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-theme-primary transition-colors hover:bg-[rgba(var(--overlay-rgb),0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                        <Search className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <div className="relative shrink-0">
                        <DropdownMenu icon={Menu} label="Menu" className="whitespace-nowrap rounded-xl border border-theme-primary bg-[rgba(var(--overlay-rgb),0.05)] text-sm text-theme-primary hover:bg-[rgba(var(--overlay-rgb),0.1)]">
                            <DropdownSection label="Mon compte" />
                            <DropdownItem icon={UserCircle} label="Mon compte" onClick={onOpenAccount} />
                            <DropdownSection label="Actions" />
                            <DropdownItem icon={Printer} label="Rapport hebdomadaire" onClick={onOpenWeeklyReport} />
                            <DropdownItem icon={HelpCircle} label="Aide (F1)" onClick={onOpenHelp} />
                            <DropdownItem icon={notificationsEnabled ? BellOff : Bell} label={notificationsEnabled ? 'Suspendre les notifications' : 'Activer les notifications'} onClick={onToggleNotifications} />
                            <DropdownItem icon={Bell} label={mentionCount > 0 ? `Notifications · ${mentionCount} mention(s)` : 'Réglages des notifications'} onClick={onOpenNotifications} />
                            <DropdownSection label="Paramètres" />
                            <DropdownItem icon={Palette} label="Thèmes" onClick={onOpenThemes} />
                            <DropdownItem icon={LayoutTemplate} label="Templates" onClick={onOpenTemplates} />
                            <DropdownItem icon={Calendar} label="Outlook / ICS" onClick={onOpenOutlook} />
                            <DropdownItem icon={Users} label="Utilisateurs" onClick={onOpenUsers} />
                            <DropdownSection label="Projets" />
                            <DropdownItem icon={FolderPlus} label="Dossiers projets" onClick={onOpenDirPanel} />
                            <DropdownItem icon={List} label="Gérer projets" onClick={onOpenProjectsList} />
                            {isAdmin && <DropdownItem icon={ShieldAlert} label="Admin (JSON)" onClick={onOpenAdminProjects} />}
                            <DropdownSection label="Données" />
                            <DropdownItem icon={Archive} label="Archives" onClick={onOpenArchive} />
                            <DropdownItem icon={Trash2} label="Corbeille tâches" onClick={onOpenTaskArchive} />
                            <DropdownItem icon={Download} label="Export JSON" onClick={onExport} />
                            <DropdownItem icon={Upload} label="Import JSON" onClick={onImport} />
                        </DropdownMenu>
                        {mentionCount > 0 && (
                            <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-slate-950" aria-label={`${mentionCount} mentions non lues`}>
                                {mentionCount > 9 ? '9+' : mentionCount}
                            </span>
                        )}
                    </div>
                </div>
                {showSearch && (
                    <div id="header-search" className="mt-3">
                        <SearchInput ref={searchInputRef} value={filterSearch} onChange={onSearchChange} placeholder="Rechercher des tâches… (Échap pour fermer)" />
                    </div>
                )}
                <div className="mt-2 min-w-0 border-t border-theme-primary pt-2">
                    {projectStats.length > 0 && (
                        <div role="region" aria-label="Filtrer par projet" tabIndex={0} className="flex min-w-0 items-center justify-center gap-2 overflow-x-auto px-1 py-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[rgba(var(--overlay-rgb),0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                            {projectStats.map((stat) => (
                                <CircularProgressBadge key={stat.project} project={stat.project} percentage={stat.pct} total={stat.total} done={stat.done}
                                    isSelected={filterProject === stat.project} onClick={() => onProjectClick(stat.project)}
                                    onArchiveProject={() => onArchiveProject(stat.project)} onRenameProject={(newName) => onRenameProject(stat.project, newName)}
                                    projectColors={projectColors} onColorChange={(idx) => setProjectColor(stat.project, idx)} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div id="header-quick-add" ref={quickAddContainerRef} hidden={!showQuickAdd} className="w-full overflow-visible">
                <QuickAddPremium ref={quickAddRef} />
            </div>
        </header>
    );
}
