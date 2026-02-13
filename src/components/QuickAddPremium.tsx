import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { Calendar, Hash, AtSign, Sparkles, FolderPlus, Palette } from "lucide-react";
import { PROJECT_COLORS } from "../constants";
import { addDaysISO, formatDateFull } from "../utils";
import { alertModal } from "../utils/confirm";
import { Autocomplete } from "./Autocomplete";
import { DatePickerModal } from "./DatePickerModal";
import { ProjectAutocomplete } from "./ProjectAutocomplete";
import { useClickOutside } from "../hooks/useClickOutside";
import { useTheme } from "../hooks/useTheme";
import useStore from "../store/useStore";
import type { TaskData, User } from "../types";

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
                className="w-full max-w-md rounded-3xl border border-white/10 p-6 text-theme-primary shadow-2xl"
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
                        className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-theme-secondary transition hover:bg-white/10"
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
export const QuickAddPremium = forwardRef<{ focus: () => void }>((_props, ref) => {
    const { addTask, projectHistory, users, directories, projectColors, setDirectories, setProjectColor } = useStore();
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;
    const secondaryColor = activeTheme.palette.secondary;

    const [taskTitle, setTaskTitle] = useState("");
    const [projectName, setProjectName] = useState("");
    const [pendingFolderPath, setPendingFolderPath] = useState<string | null>(null);
    const [dueDate, setDueDate] = useState(addDaysISO(3));
    const [taskPriority] = useState<"low" | "med" | "high">("med");
    const [assignedUserId, setAssignedUserId] = useState("unassigned");
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

    // Exposer la méthode focus() pour les raccourcis clavier
    useImperativeHandle(ref, () => ({
        focus: () => {
            inputRef.current?.focus();
        },
    }));

    // Détection automatique de #projet et @user dans le titre
    useEffect(() => {
        const projectMatch = taskTitle.match(/#(\w+)/);
        const userMatch = taskTitle.match(/@(\w+)/);

        if (projectMatch && projectMatch[1]) {
            const detectedProject = projectMatch[1].toUpperCase();
            if (detectedProject !== projectName) {
                setProjectName(detectedProject);
            }
        }

        if (userMatch && userMatch[1]) {
            const detectedUserName = userMatch[1];
            const foundUser = users.find(u => u.name.toLowerCase().includes(detectedUserName.toLowerCase()));
            if (foundUser && foundUser.id !== assignedUserId) {
                setAssignedUserId(foundUser.id);
            }
        }
    }, [taskTitle, projectName, assignedUserId, users]);

    // Fermer les dropdowns lors d'un clic en dehors
    useClickOutside([colorPickerRef, colorButtonRef], () => setShowColorPicker(false), showColorPicker);
    useClickOutside([projectPickerRef, projectButtonRef], () => setShowProjectPicker(false), showProjectPicker);
    useClickOutside([userPickerRef, userButtonRef], () => setShowUserPicker(false), showUserPicker);

    function onAdd(data: TaskData) {
        addTask(data);
    }

    function handleSetDirectory(name: string, path: string) {
        setDirectories({ ...directories, [name]: path });
    }

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (!taskTitle.trim()) return;

        // Nettoyer le titre des tags
        const cleanTitle = taskTitle.replace(/#\w+/g, '').replace(/@\w+/g, '').trim();

        const normalizedProject = projectName.trim().toUpperCase();
        if (normalizedProject && selectedColorIndex !== null) {
            setProjectColor(normalizedProject, selectedColorIndex);
        }
        onAdd({
            title: cleanTitle,
            project: projectName,
            due: dueDate,
            priority: taskPriority,
            assignedTo: [assignedUserId],
            folderPath: pendingFolderPath || undefined,
        });
        setTaskTitle("");
        setPendingFolderPath(null);
        setProjectName("");
        setAssignedUserId("unassigned");
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
                            : "border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl"
                    }`}
                    style={{
                        backgroundColor: isFocused ? 'var(--bg-tertiary)' : 'var(--bg-tertiary)',
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
                            className="w-full bg-transparent text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none font-medium uppercase"
                            placeholder="Nouvelle tâche... (#projet @user)"
                            value={taskTitle}
                            onChange={handleTitleChange}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Project Selector */}
                        <div className="relative">
                            <button
                                ref={projectButtonRef}
                                type="button"
                                onClick={() => setShowProjectPicker(!showProjectPicker)}
                                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                                    !projectName && "border-white/10 bg-white/5 text-theme-muted hover:bg-white/10 hover:text-white"
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
                            >
                                <Hash className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{projectName || "Projet"}</span>
                            </button>

                            {showProjectPicker && (
                                <div
                                    ref={projectPickerRef}
                                    className="absolute right-0 top-full z-[10000] mt-2 w-80 rounded-2xl border border-white/10 p-3 shadow-2xl"
                                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ProjectAutocomplete
                                        value={projectName}
                                        onChange={setProjectName}
                                        projectHistory={projectHistory}
                                        placeholder="PROJET"
                                        className="mb-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-theme-primary placeholder-slate-400 uppercase focus:ring-0"
                                        style={{
                                            ['--focus-border-color' as any]: `${primaryColor}66`
                                        }}
                                        onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.style.borderColor = `${primaryColor}66`}
                                        onBlur={(e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                                    />
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleSelectFolder}
                                            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-theme-secondary transition hover:bg-white/10"
                                        >
                                            <FolderPlus className="h-3.5 w-3.5" />
                                            Dossier
                                        </button>
                                        <button
                                            ref={colorButtonRef}
                                            type="button"
                                            onClick={() => setShowColorPicker(!showColorPicker)}
                                            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-theme-secondary transition hover:bg-white/10"
                                        >
                                            <Palette className="h-3.5 w-3.5" />
                                            Couleur
                                        </button>
                                    </div>
                                    {showColorPicker && (
                                        <div
                                            ref={colorPickerRef}
                                            className="mt-2 flex flex-wrap gap-2 rounded-xl border border-white/10 p-3"
                                            style={{ backgroundColor: 'var(--bg-secondary)' }}
                                        >
                                            {PROJECT_COLORS.map((c, index) => (
                                                <button
                                                    key={index}
                                                    type="button"
                                                    className={`h-8 w-8 rounded-full border ${c.border} ${c.bg} transition-transform hover:scale-110 ${
                                                        selectedColorIndex === index ? "ring-2 ring-white/60 scale-110" : ""
                                                    }`}
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
                                </div>
                            )}
                        </div>

                        {/* User Selector */}
                        <div className="relative">
                            <button
                                ref={userButtonRef}
                                type="button"
                                onClick={() => setShowUserPicker(!showUserPicker)}
                                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                                    assignedUserId === "unassigned" && "border-white/10 bg-white/5 text-theme-muted hover:bg-white/10 hover:text-white"
                                }`}
                                style={
                                    assignedUserId !== "unassigned"
                                        ? {
                                              borderColor: `${secondaryColor}66`,
                                              backgroundColor: `${secondaryColor}1a`,
                                              color: `${secondaryColor}e6`
                                          }
                                        : undefined
                                }
                                title="Assigner à un utilisateur"
                            >
                                <AtSign className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{users.find(u => u.id === assignedUserId)?.name || "User"}</span>
                            </button>

                            {showUserPicker && (
                                <div
                                    ref={userPickerRef}
                                    className="absolute right-0 top-full z-[10000] mt-2 w-64 rounded-2xl border border-white/10 p-3 shadow-2xl"
                                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                                >
                                    <Autocomplete<User, string>
                                        value={assignedUserId}
                                        onChange={(val) => {
                                            setAssignedUserId(val);
                                            setShowUserPicker(false);
                                        }}
                                        options={users}
                                        placeholder="Non assigné"
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-theme-primary focus:ring-0"
                                        style={{
                                            ['--focus-border-color' as any]: `${secondaryColor}66`
                                        }}
                                        onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.style.borderColor = `${secondaryColor}66`}
                                        onBlur={(e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                                        getValue={(user) => user.id}
                                        getLabel={(user) => user.name}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Date Picker */}
                        <button
                            ref={datePickerButtonRef}
                            type="button"
                            onClick={() => setShowDatePicker(true)}
                            className="hidden md:flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-theme-secondary transition-all hover:bg-white/10 hover:text-white whitespace-nowrap"
                            title="Définir une échéance"
                        >
                            <Calendar className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">{formatDateFull(dueDate)}</span>
                        </button>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            className="rounded-xl px-4 sm:px-6 py-1.5 text-sm font-black text-white transition-all hover:scale-105 hover:brightness-110"
                            style={{
                                backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
                                boxShadow: `0 10px 15px -3px ${primaryColor}33, 0 4px 6px -4px ${primaryColor}33`
                            }}
                        >
                            ⏎
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
            <DatePickerModal
                isOpen={showDatePicker}
                value={dueDate}
                onSelect={(iso) => setDueDate(iso)}
                onClose={() => setShowDatePicker(false)}
            />
        </>
    );
});

QuickAddPremium.displayName = 'QuickAddPremium';
