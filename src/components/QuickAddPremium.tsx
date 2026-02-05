import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Calendar, Hash, AtSign, Sparkles, FolderPlus, Palette } from "lucide-react";
import { PROJECT_COLORS } from "../constants";
import { addDaysISO, formatDateFull } from "../utils";
import { alertModal } from "../utils/confirm";
import { Autocomplete } from "./Autocomplete";
import { DatePickerModal } from "./DatePickerModal";
import { ProjectAutocomplete } from "./ProjectAutocomplete";
import useStore from "../store/useStore";
import type { TaskData, User } from "../types";

interface ProjectExistsModalProps {
    existingProject: string;
    onUseExisting: () => void;
    onCreateNew: () => void;
    onCancel: () => void;
}

function ProjectExistsModal({ existingProject, onUseExisting, onCreateNew, onCancel }: ProjectExistsModalProps) {
    return createPortal(
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur"
            onClick={onCancel}
        >
            <div
                className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1124] p-6 text-slate-100 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold mb-4">Projet existant</h3>
                <p className="text-sm text-slate-300 mb-4">
                    Un projet nommé <span className="font-semibold text-cyan-400">{existingProject}</span> existe déjà.
                </p>
                <p className="text-sm text-slate-400 mb-6">
                    Voulez-vous utiliser ce projet existant ou créer un nouveau projet avec un suffixe ?
                </p>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={onUseExisting}
                        className="w-full rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-400/20"
                    >
                        Utiliser le projet existant
                    </button>
                    <button
                        onClick={onCreateNew}
                        className="w-full rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 transition hover:bg-emerald-400/20"
                    >
                        Créer un nouveau projet (avec suffixe)
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10"
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
 */
export function QuickAddPremium() {
    const { addTask, projectHistory, users, directories, projectColors, setDirectories, setProjectColor } = useStore();

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
    useEffect(() => {
        if (!showColorPicker) return;
        function handleClickOutside(event: MouseEvent) {
            if (
                colorPickerRef.current?.contains(event.target as Node) ||
                colorButtonRef.current?.contains(event.target as Node)
            ) {
                return;
            }
            setShowColorPicker(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showColorPicker]);

    useEffect(() => {
        if (!showProjectPicker) return;
        function handleClickOutside(event: MouseEvent) {
            if (
                projectPickerRef.current?.contains(event.target as Node) ||
                projectButtonRef.current?.contains(event.target as Node)
            ) {
                return;
            }
            setShowProjectPicker(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showProjectPicker]);

    useEffect(() => {
        if (!showUserPicker) return;
        function handleClickOutside(event: MouseEvent) {
            if (
                userPickerRef.current?.contains(event.target as Node) ||
                userButtonRef.current?.contains(event.target as Node)
            ) {
                return;
            }
            setShowUserPicker(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showUserPicker]);

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

    // Keyboard shortcut: Ctrl/Cmd + K to focus
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <>
            <form
                onSubmit={handleSubmit}
                className="relative w-full"
            >
                <div
                    className={`quickadd-premium-container relative flex items-stretch gap-2 sm:gap-3 rounded-2xl sm:rounded-3xl border-2 px-3 sm:px-5 py-2.5 sm:py-3 transition-all duration-500 ${
                        isFocused
                            ? "border-transparent shadow-[0_0_0_2px_rgba(6,182,212,0.4),0_0_40px_rgba(6,182,212,0.2)] scale-[1.01] bg-[#0b1124]"
                            : "border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] bg-[#0b1124]/80 backdrop-blur-xl"
                    }`}
                    style={{
                        background: isFocused
                            ? "linear-gradient(#0b1124, #0b1124) padding-box, linear-gradient(90deg, #10b981, #06b6d4, #8b5cf6) border-box"
                            : undefined,
                    }}
                >
                    {/* Icon */}
                    <div className="flex items-center">
                        <Sparkles className={`h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${isFocused ? "text-cyan-400 animate-pulse" : "text-slate-400"}`} />
                    </div>

                    {/* Main Input */}
                    <div className="flex-1 flex items-center min-w-0">
                        <input
                            ref={inputRef}
                            type="text"
                            className="w-full bg-transparent text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none font-medium"
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
                                    projectName
                                        ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                                        : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                                }`}
                                title="Sélectionner un projet"
                            >
                                <Hash className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{projectName || "Projet"}</span>
                            </button>

                            {showProjectPicker && (
                                <div
                                    ref={projectPickerRef}
                                    className="absolute right-0 top-full z-[10000] mt-2 w-80 rounded-2xl border border-white/10 bg-[#0b1124] p-3 shadow-2xl"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ProjectAutocomplete
                                        value={projectName}
                                        onChange={setProjectName}
                                        projectHistory={projectHistory}
                                        placeholder="PROJET"
                                        className="mb-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 uppercase focus:border-cyan-400/40 focus:ring-0"
                                    />
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleSelectFolder}
                                            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10"
                                        >
                                            <FolderPlus className="h-3.5 w-3.5" />
                                            Dossier
                                        </button>
                                        <button
                                            ref={colorButtonRef}
                                            type="button"
                                            onClick={() => setShowColorPicker(!showColorPicker)}
                                            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10"
                                        >
                                            <Palette className="h-3.5 w-3.5" />
                                            Couleur
                                        </button>
                                    </div>
                                    {showColorPicker && (
                                        <div ref={colorPickerRef} className="mt-2 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-[#050b1f] p-3">
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
                                    assignedUserId !== "unassigned"
                                        ? "border-purple-400/40 bg-purple-400/10 text-purple-300"
                                        : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                                }`}
                                title="Assigner à un utilisateur"
                            >
                                <AtSign className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{users.find(u => u.id === assignedUserId)?.name || "User"}</span>
                            </button>

                            {showUserPicker && (
                                <div ref={userPickerRef} className="absolute right-0 top-full z-[10000] mt-2 w-64 rounded-2xl border border-white/10 bg-[#0b1124] p-3 shadow-2xl">
                                    <Autocomplete<User, string>
                                        value={assignedUserId}
                                        onChange={(val) => {
                                            setAssignedUserId(val);
                                            setShowUserPicker(false);
                                        }}
                                        options={users}
                                        placeholder="Non assigné"
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-purple-400/40 focus:ring-0"
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
                            className="hidden md:flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition-all hover:bg-white/10 hover:text-white whitespace-nowrap"
                            title="Définir une échéance"
                        >
                            <Calendar className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">{formatDateFull(dueDate)}</span>
                        </button>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 sm:px-6 py-1.5 text-sm font-black text-slate-900 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 hover:brightness-110 hover:shadow-emerald-500/40"
                        >
                            ⏎
                        </button>
                    </div>

                    {/* Animated border gradient */}
                    {isFocused && (
                        <div className="quickadd-border-glow absolute -inset-[2px] -z-10 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-500 opacity-20 blur-xl" />
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
}
