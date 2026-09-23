import React, { useEffect, useLayoutEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { Calendar, Hash, AtSign, Sparkles, FolderPlus, Palette, Check, CornerDownLeft } from "lucide-react";
import { PROJECT_COLORS } from "../constants";
import { addDaysISO, formatDateFull } from "../utils";
import { alertModal } from "../utils/confirm";
import { DatePickerDropdown } from "./DatePickerModal";
import { ProjectAutocomplete } from "./ProjectAutocomplete";
import { useClickOutside } from "../hooks/useClickOutside";
import { useTheme } from "../hooks/useTheme";
import useStore from "../store/useStore";
import { useShallow } from 'zustand/react/shallow';
import type { TaskData } from "../types";

// Noms FR alignés sur l'ordre de PROJECT_COLORS (constants.ts), pour les aria-label
// des pastilles de couleur -- sinon 9 boutons ronds strictement indiscernables au clavier/lecteur d'écran.
const PROJECT_COLOR_NAMES = ["Bleu", "Cyan", "Émeraude", "Jaune", "Orange", "Rose", "Violet", "Indigo", "Ardoise"];

interface ProjectExistsModalProps {
    existingProject: string;
    onUseExisting: () => void;
    onCreateNew: () => void;
    onCancel: () => void;
}

function ProjectExistsModal({ existingProject, onUseExisting, onCreateNew, onCancel }: ProjectExistsModalProps) {
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;
    const secondaryColor = activeTheme.palette.secondary;

    return createPortal(
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur"
            onClick={onCancel}
        >
            <div
                className="w-full max-w-md rounded-3xl border border-[rgba(var(--overlay-rgb),0.1)] p-6 text-theme-primary shadow-2xl"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold mb-4">Projet existant</h3>
                <p className="text-sm text-theme-secondary mb-4">
                    Un projet nommé <span className="font-semibold" style={{ color: primaryColor }}>{existingProject}</span> existe déjà.
                </p>
                <p className="text-sm text-theme-muted mb-6">
                    Voulez-vous utiliser ce projet existant ou créer un nouveau projet avec un suffixe ?
                </p>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={onUseExisting}
                        className="w-full rounded-xl border px-4 py-2 text-sm transition"
                        style={{
                            borderColor: `${primaryColor}66`,
                            backgroundColor: `${primaryColor}1a`,
                            color: `${primaryColor}e6`
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${primaryColor}33`}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${primaryColor}1a`}
                    >
                        Utiliser le projet existant
                    </button>
                    <button
                        onClick={onCreateNew}
                        className="w-full rounded-xl border px-4 py-2 text-sm transition"
                        style={{
                            borderColor: `${secondaryColor}66`,
                            backgroundColor: `${secondaryColor}1a`,
                            color: `${secondaryColor}e6`
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${secondaryColor}33`}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${secondaryColor}1a`}
                    >
                        Créer un nouveau projet (avec suffixe)
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full rounded-xl border border-[rgba(var(--overlay-rgb),0.2)] bg-[rgba(var(--overlay-rgb),0.05)] px-4 py-2 text-sm text-theme-secondary transition hover:bg-[rgba(var(--overlay-rgb),0.1)]"
                    >
                        Annuler
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

/**
 * QuickAdd Premium avec détection automatique de tags #projet et @user
 * Design futuriste avec border gradient animé
 *
 * Expose une méthode focus() via ref pour permettre le focus programmatique depuis les raccourcis clavier
 */
export const QuickAddPremium = forwardRef<{ focus: () => void; prefillProject: (project: string) => void }>((_props, ref) => {
    const { addTask, projectHistory, users, projectColors, setProjectDirectory, setProjectColor, currentUser } = useStore(useShallow((s) => ({ addTask: s.addTask, projectHistory: s.projectHistory, users: s.users, projectColors: s.projectColors, setProjectDirectory: s.setProjectDirectory, setProjectColor: s.setProjectColor, currentUser: s.currentUser })));
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;
    const secondaryColor = activeTheme.palette.secondary;

    const [taskTitle, setTaskTitle] = useState("");
    const [projectName, setProjectName] = useState("");
    const [pendingFolderPath, setPendingFolderPath] = useState<string | null>(null);
    const [dueDate, setDueDate] = useState(addDaysISO(3));
    const [taskPriority] = useState<"low" | "med" | "high">("med");
    const [assignedUserIds, setAssignedUserIds] = useState<string[]>(() => [currentUser || "unassigned"]);
    const [showExistsModal, setShowExistsModal] = useState(false);
    const [pendingProjectName, setPendingProjectName] = useState("");
    const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showProjectPicker, setShowProjectPicker] = useState(false);
    const [showUserPicker, setShowUserPicker] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const colorButtonRef = useRef<HTMLButtonElement>(null);
    const datePickerButtonRef = useRef<HTMLButtonElement>(null);
    const projectPickerRef = useRef<HTMLDivElement>(null);
    const projectButtonRef = useRef<HTMLButtonElement>(null);
    const userPickerRef = useRef<HTMLDivElement>(null);
    const userButtonRef = useRef<HTMLButtonElement>(null);

    const [projectPickerPos, setProjectPickerPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const [userPickerPos, setUserPickerPos] = useState<{ top: number; left: number; width: number } | null>(null);

    // Exposer focus() pour les raccourcis clavier et prefillProject() pour le clic droit sur un projet
    useImperativeHandle(ref, () => ({
        focus: () => {
            inputRef.current?.focus();
        },
        prefillProject: (project: string) => {
            setProjectName(project);
            setIsFocused(true);
            setTimeout(() => inputRef.current?.focus(), 0);
        },
    }));

    // Détection automatique de #projet et @user dans le titre
    useEffect(() => {
        // \p{L} (lettre Unicode) plutôt que \w : \w ne capture pas les accents,
        // ce qui tronquait "#Résidence-Bellevue" en "R" (arrêt à "é"). Le tiret
        // est inclus pour les noms composés ("Zone-Industrielle-Nord").
        const projectMatch = taskTitle.match(/#([\p{L}\d_-]+)/u);
        const userMatch = taskTitle.match(/@([\p{L}\d_-]+)/u);

        if (projectMatch && projectMatch[1]) {
            const detectedProject = projectMatch[1].toUpperCase();
            if (detectedProject !== projectName) {
                setProjectName(detectedProject);
            }
        }

        if (userMatch && userMatch[1]) {
            const detectedUserName = userMatch[1];
            const foundUser = users.find(u => u.name.toLowerCase().includes(detectedUserName.toLowerCase()));
            if (foundUser && !assignedUserIds.includes(foundUser.id)) {
                setAssignedUserIds(prev => [...prev.filter(id => id !== "unassigned"), foundUser.id]);
            }
        }
    }, [taskTitle, projectName, assignedUserIds, users]);

    // Fermer les dropdowns lors d'un clic en dehors
    useClickOutside([colorPickerRef, colorButtonRef], () => setShowColorPicker(false), showColorPicker);
    useClickOutside([projectPickerRef, projectButtonRef], () => setShowProjectPicker(false), showProjectPicker);
    useClickOutside([userPickerRef, userButtonRef], () => setShowUserPicker(false), showUserPicker);
    useClickOutside([datePickerButtonRef], () => setShowDatePicker(false), showDatePicker);

    // Positionnement en portal (document.body) des pickers projet/user, à la manière de
    // DatePickerDropdown : en position:absolute simple, ces panneaux restaient descendants
    // du conteneur quickadd-premium-container dont l'opacity passe à 0.8 hors focus --
    // le contenu de la page derrière (colonnes Kanban, "Aucune tâche"...) transparaissait
    // à travers eux. Sortir du flux via portal règle la composition ; la largeur suit celle
    // du bouton déclencheur, capée pour ne pas déborder sur petit écran.
    useLayoutEffect(() => {
        if (!showProjectPicker) { setProjectPickerPos(null); return; }
        function update() {
            if (!projectButtonRef.current) return;
            const rect = projectButtonRef.current.getBoundingClientRect();
            const width = Math.min(320, window.innerWidth - 16);
            setProjectPickerPos({ top: rect.bottom + 8, left: Math.max(8, rect.right - width), width });
        }
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [showProjectPicker]);

    useLayoutEffect(() => {
        if (!showUserPicker) { setUserPickerPos(null); return; }
        function update() {
            if (!userButtonRef.current) return;
            const rect = userButtonRef.current.getBoundingClientRect();
            const width = Math.min(256, window.innerWidth - 16);
            setUserPickerPos({ top: rect.bottom + 8, left: Math.max(8, rect.right - width), width });
        }
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [showUserPicker]);

    function onAdd(data: TaskData) {
        addTask(data);
    }

    function handleSetDirectory(name: string, path: string) {
        setProjectDirectory(name, path);
    }

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (!taskTitle.trim()) return;

        // Nettoyer le titre des tags
        const cleanTitle = taskTitle.replace(/#[\p{L}\d_-]+/gu, '').replace(/@[\p{L}\d_-]+/gu, '').trim();

        const normalizedProject = projectName.trim().toUpperCase();
        if (normalizedProject && selectedColorIndex !== null) {
            setProjectColor(normalizedProject, selectedColorIndex);
        }
        onAdd({
            title: cleanTitle,
            project: projectName,
            due: dueDate,
            priority: taskPriority,
            assignedTo: assignedUserIds,
            folderPath: pendingFolderPath || undefined,
        });
        setTaskTitle("");
        setPendingFolderPath(null);
        setProjectName("");
        setAssignedUserIds([currentUser || "unassigned"]);
    }

    function handleTitleChange(event: React.ChangeEvent<HTMLInputElement>) {
        setTaskTitle(event.target.value);
    }

    async function handleSelectFolder() {
        if (!window.electronAPI?.selectProjectFolder) {
            alertModal("Cette fonctionnalité nécessite l'application Electron");
            return;
        }

        const result = await window.electronAPI.selectProjectFolder();
        if (!result.success || result.canceled) return;

        const folderName = (result.name || "").toUpperCase();
        if (!folderName) return;
        const folderPath = result.path || "";
        if (!folderPath) return;

        if (projectHistory.includes(folderName)) {
            setPendingProjectName(folderName);
            setPendingFolderPath(folderPath);
            setShowExistsModal(true);
        } else {
            setProjectName(folderName);
            setPendingFolderPath(folderPath);
            handleSetDirectory(folderName, folderPath);
        }
    }

    function handleUseExistingProject() {
        setProjectName(pendingProjectName);
        if (pendingFolderPath) {
            handleSetDirectory(pendingProjectName, pendingFolderPath);
        }
        setShowExistsModal(false);
        setPendingProjectName("");
    }

    function handleCreateNewProject() {
        let suffix = 2;
        let newName = `${pendingProjectName} (${suffix})`;
        while (projectHistory.includes(newName)) {
            suffix++;
            newName = `${pendingProjectName} (${suffix})`;
        }
        setProjectName(newName);
        if (pendingFolderPath) {
            handleSetDirectory(newName, pendingFolderPath);
        }
        setShowExistsModal(false);
        setPendingProjectName("");
    }

    function handleCancelModal() {
        setShowExistsModal(false);
        setPendingProjectName("");
        setPendingFolderPath(null);
    }

    useEffect(() => {
        const normalizedProject = projectName.trim().toUpperCase();
        if (normalizedProject && normalizedProject in projectColors) {
            setSelectedColorIndex(projectColors[normalizedProject]);
        }
    }, [projectName, projectColors]);

    // Note: Keyboard shortcut Ctrl+N is now handled centrally by useDefaultShortcuts in ToDoX.tsx

    // Utilisateur connecté toujours en tête de liste (même tri que ReviewerPickerDialog)
    const sortedUsers = [...users].sort((a, b) => {
        if (a.id === currentUser) return -1;
        if (b.id === currentUser) return 1;
        return 0;
    });

    const isUnassigned = assignedUserIds.length === 0 || (assignedUserIds.length === 1 && assignedUserIds[0] === "unassigned");
    const assignedLabel = isUnassigned
        ? "User"
        : assignedUserIds.length === 1
            ? users.find(u => u.id === assignedUserIds[0])?.name || "User"
            : `${assignedUserIds.length} utilisateurs`;

    function toggleAssignedUser(userId: string) {
        setAssignedUserIds(prev => {
            const withoutUnassigned = prev.filter(id => id !== "unassigned");
            return withoutUnassigned.includes(userId)
                ? withoutUnassigned.filter(id => id !== userId)
                : [...withoutUnassigned, userId];
        });
    }

    return (
        <>
            <form
                onSubmit={handleSubmit}
                className="relative w-full"
            >
                <div
                    className={`quickadd-premium-container relative flex items-stretch gap-2 sm:gap-3 rounded-2xl sm:rounded-3xl border-2 px-3 sm:px-5 py-2.5 sm:py-3 transition-all duration-500 ${
                        isFocused
                            ? "border-transparent scale-[1.01]"
                            : "border-[rgba(var(--overlay-rgb),0.1)] shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl"
                    }`}
                    style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        opacity: isFocused ? 1 : 0.8,
                        boxShadow: isFocused
                            ? `0 0 0 2px ${primaryColor}66, 0 0 40px ${primaryColor}33`
                            : undefined,
                        background: isFocused
                            ? `linear-gradient(var(--bg-tertiary), var(--bg-tertiary)) padding-box, linear-gradient(90deg, ${primaryColor}, ${secondaryColor}, ${primaryColor}) border-box`
                            : undefined,
                    }}
                >
                    {/* Icon */}
                    <div className="flex items-center">
                        <Sparkles
                            className={`h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${isFocused ? "animate-pulse" : "text-theme-muted"}`}
                            style={{ color: isFocused ? primaryColor : undefined }}
                        />
                    </div>

                    {/* Main Input */}
                    <div className="flex-1 flex items-center min-w-0">
                        <input
                            ref={inputRef}
                            type="text"
                            className="w-full bg-transparent text-sm sm:text-base text-theme-primary placeholder-slate-400 focus:outline-none font-medium uppercase"
                            placeholder="Nouvelle tâche... (#projet @user)"
                            value={taskTitle}
                            onChange={handleTitleChange}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                        />
                    </div>

                    {/* Séparateur visuel : évite que le champ de saisie (dominant) et le groupe
                        de pastilles (projet/user/date/submit, tassées à droite) donnent une
                        impression de bar déséquilibrée -- coupe le bandeau en deux zones nettes. */}
                    <div className="hidden sm:block w-px self-stretch shrink-0 bg-[rgba(var(--overlay-rgb),0.12)]" />

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
                        {/* Project Selector */}
                        <div className="relative">
                            <button
                                ref={projectButtonRef}
                                type="button"
                                onClick={() => setShowProjectPicker(!showProjectPicker)}
                                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3.5 sm:px-5 py-2 sm:py-2.5 min-w-[110px] sm:min-w-[150px] text-xs font-semibold transition-all whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                                    !projectName && "border-[rgba(var(--overlay-rgb),0.1)] bg-[rgba(var(--overlay-rgb),0.05)] text-theme-muted hover:bg-[rgba(var(--overlay-rgb),0.1)] hover:text-[rgb(var(--overlay-rgb))]"
                                }`}
                                style={
                                    projectName
                                        ? {
                                              borderColor: `${primaryColor}66`,
                                              backgroundColor: `${primaryColor}1a`,
                                              color: `${primaryColor}e6`
                                          }
                                        : undefined
                                }
                                title="Sélectionner un projet"
                                aria-label="Sélectionner un projet"
                            >
                                <Hash className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{projectName || "Projet"}</span>
                            </button>

                            {showProjectPicker && projectPickerPos && createPortal(
                                <div
                                    ref={projectPickerRef}
                                    className="fixed z-[10000] rounded-2xl border border-[rgba(var(--overlay-rgb),0.1)] p-3 shadow-2xl"
                                    style={{ top: projectPickerPos.top, left: projectPickerPos.left, width: projectPickerPos.width, backgroundColor: 'var(--bg-tertiary)' }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ProjectAutocomplete
                                        value={projectName}
                                        onChange={setProjectName}
                                        projectHistory={projectHistory}
                                        placeholder="PROJET"
                                        className="mb-2 w-full rounded-xl border border-[rgba(var(--overlay-rgb),0.1)] bg-[rgba(var(--overlay-rgb),0.05)] px-3 py-2 text-sm text-theme-primary placeholder-slate-400 uppercase focus:ring-0"
                                    />
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleSelectFolder}
                                            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[rgba(var(--overlay-rgb),0.1)] bg-[rgba(var(--overlay-rgb),0.05)] px-3 py-2 text-xs text-theme-secondary transition hover:bg-[rgba(var(--overlay-rgb),0.1)]"
                                        >
                                            <FolderPlus className="h-3.5 w-3.5" />
                                            Dossier
                                        </button>
                                        <button
                                            ref={colorButtonRef}
                                            type="button"
                                            onClick={() => setShowColorPicker(!showColorPicker)}
                                            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[rgba(var(--overlay-rgb),0.1)] bg-[rgba(var(--overlay-rgb),0.05)] px-3 py-2 text-xs text-theme-secondary transition hover:bg-[rgba(var(--overlay-rgb),0.1)]"
                                        >
                                            <Palette className="h-3.5 w-3.5" />
                                            Couleur
                                        </button>
                                    </div>
                                    {showColorPicker && (
                                        <div
                                            ref={colorPickerRef}
                                            className="mt-2 flex flex-wrap gap-2 rounded-xl border border-[rgba(var(--overlay-rgb),0.1)] p-3"
                                            style={{ backgroundColor: 'var(--bg-secondary)' }}
                                        >
                                            {PROJECT_COLORS.map((c, index) => (
                                                <button
                                                    key={index}
                                                    type="button"
                                                    className={`h-8 w-8 rounded-full border ${c.border} ${c.bg} transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                                                        selectedColorIndex === index ? "ring-2 ring-[rgba(var(--overlay-rgb),0.6)] scale-110" : ""
                                                    }`}
                                                    title={`Couleur ${PROJECT_COLOR_NAMES[index]}`}
                                                    aria-label={`Couleur ${PROJECT_COLOR_NAMES[index]}`}
                                                    aria-pressed={selectedColorIndex === index}
                                                    onClick={() => {
                                                        const normalizedProject = projectName.trim().toUpperCase();
                                                        setSelectedColorIndex(index);
                                                        if (normalizedProject) {
                                                            setProjectColor(normalizedProject, index);
                                                        }
                                                        setShowColorPicker(false);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>,
                                document.body
                            )}
                        </div>

                        {/* User Selector */}
                        <div className="relative">
                            <button
                                ref={userButtonRef}
                                type="button"
                                onClick={() => setShowUserPicker(!showUserPicker)}
                                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3.5 sm:px-5 py-2 sm:py-2.5 min-w-[110px] sm:min-w-[180px] text-xs font-semibold transition-all whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                                    isUnassigned && "border-[rgba(var(--overlay-rgb),0.1)] bg-[rgba(var(--overlay-rgb),0.05)] text-theme-muted hover:bg-[rgba(var(--overlay-rgb),0.1)] hover:text-[rgb(var(--overlay-rgb))]"
                                }`}
                                style={
                                    !isUnassigned
                                        ? {
                                              borderColor: `${secondaryColor}66`,
                                              backgroundColor: `${secondaryColor}1a`,
                                              color: `${secondaryColor}e6`
                                          }
                                        : undefined
                                }
                                title="Assigner à un ou plusieurs utilisateurs"
                                aria-label="Assigner à un ou plusieurs utilisateurs"
                            >
                                <AtSign className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{assignedLabel}</span>
                            </button>

                            {showUserPicker && userPickerPos && createPortal(
                                <div
                                    ref={userPickerRef}
                                    className="fixed z-[10000] max-h-80 overflow-y-auto rounded-2xl border border-[rgba(var(--overlay-rgb),0.1)] p-2 shadow-2xl"
                                    style={{ top: userPickerPos.top, left: userPickerPos.left, width: userPickerPos.width, backgroundColor: 'var(--bg-tertiary)' }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    {sortedUsers.map((user) => {
                                        const isSelected = assignedUserIds.includes(user.id);
                                        return (
                                            <button
                                                key={user.id}
                                                type="button"
                                                onClick={() => toggleAssignedUser(user.id)}
                                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition text-theme-secondary hover:bg-[rgba(var(--overlay-rgb),0.08)]"
                                                style={isSelected ? { backgroundColor: `${secondaryColor}26`, color: secondaryColor } : undefined}
                                            >
                                                <span
                                                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[rgba(var(--overlay-rgb),0.25)]"
                                                    style={isSelected ? { backgroundColor: secondaryColor, borderColor: secondaryColor } : undefined}
                                                >
                                                    {isSelected && <Check className="h-3 w-3 text-white" />}
                                                </span>
                                                <span className="truncate">{user.name}</span>
                                            </button>
                                        );
                                    })}
                                    <div className="my-1 h-px bg-[rgba(var(--overlay-rgb),0.1)]" />
                                    <button
                                        type="button"
                                        onClick={() => setAssignedUserIds(["unassigned"])}
                                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition text-theme-secondary hover:bg-[rgba(var(--overlay-rgb),0.08)]"
                                        style={isUnassigned ? { backgroundColor: `${secondaryColor}26`, color: secondaryColor } : undefined}
                                    >
                                        <span
                                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[rgba(var(--overlay-rgb),0.25)]"
                                            style={isUnassigned ? { backgroundColor: secondaryColor, borderColor: secondaryColor } : undefined}
                                        >
                                            {isUnassigned && <Check className="h-3 w-3 text-white" />}
                                        </span>
                                        Non assigné
                                    </button>
                                </div>,
                                document.body
                            )}
                        </div>

                        {/* Date Picker */}
                        <div className="relative hidden md:block">
                            <button
                                ref={datePickerButtonRef}
                                type="button"
                                onClick={() => setShowDatePicker(v => !v)}
                                className="flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(var(--overlay-rgb),0.1)] bg-[rgba(var(--overlay-rgb),0.05)] px-3.5 sm:px-5 py-2 sm:py-2.5 min-w-[130px] sm:min-w-[160px] text-xs font-semibold text-theme-secondary transition-all hover:bg-[rgba(var(--overlay-rgb),0.1)] hover:text-[rgb(var(--overlay-rgb))] whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                title="Définir une échéance"
                                aria-label="Définir une échéance"
                            >
                                <Calendar className="h-3.5 w-3.5" />
                                <span className="hidden lg:inline">{formatDateFull(dueDate)}</span>
                            </button>
                            <DatePickerDropdown
                                isOpen={showDatePicker}
                                value={dueDate}
                                onSelect={(iso) => setDueDate(iso)}
                                onClose={() => setShowDatePicker(false)}
                                align="right"
                                anchorRef={datePickerButtonRef}
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            className="flex items-center justify-center rounded-xl px-5 sm:px-7 py-2 sm:py-2.5 min-w-[80px] sm:min-w-[110px] text-sm font-black text-white transition-all hover:scale-105 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                            style={{
                                backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
                                boxShadow: `0 10px 15px -3px ${primaryColor}33, 0 4px 6px -4px ${primaryColor}33`
                            }}
                            title="Créer la tâche"
                            aria-label="Créer la tâche"
                        >
                            <CornerDownLeft className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>

                    {/* Animated border gradient */}
                    {isFocused && (
                        <div
                            className="quickadd-border-glow absolute -inset-[2px] -z-10 rounded-2xl sm:rounded-3xl opacity-20 blur-xl"
                            style={{
                                backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor}, ${primaryColor})`
                            }}
                        />
                    )}
                </div>
            </form>

            {showExistsModal && (
                <ProjectExistsModal
                    existingProject={pendingProjectName}
                    onUseExisting={handleUseExistingProject}
                    onCreateNew={handleCreateNewProject}
                    onCancel={handleCancelModal}
                />
            )}
        </>
    );
});

QuickAddPremium.displayName = 'QuickAddPremium';
