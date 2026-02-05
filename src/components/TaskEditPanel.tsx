import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { STATUSES, PRIORITIES, type StatusDef, type PriorityDef } from "../constants";
import { Autocomplete } from "./Autocomplete";
import { ProjectAutocomplete } from "./ProjectAutocomplete";
import useStore from "../store/useStore";
import type { Task, TaskData } from "../types";
import { confirmModal } from "../utils/confirm";

interface TaskEditPanelProps {
    task: Task;
    position: { x: number; y: number };
    onClose: () => void;
}

/**
 * Panneau d'édition pour clic droit sur une tâche
 */
export function TaskEditPanel({ task: initialTask, position, onClose }: TaskEditPanelProps) {
    const { updateTask, removeTask, archiveTask, users, projectHistory, tasks } = useStore();

    // Récupérer la tâche à jour depuis le store pour refléter les changements en temps réel
    const task = tasks.find(t => t.id === initialTask.id) || initialTask;

    // Alias functions to match internal usage if needed, or simply use store actions directly
    const onUpdate = updateTask;
    const onDelete = removeTask;
    const onArchive = archiveTask;

    const menuRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState({ top: position.y, left: position.x });

    // États locaux pour les champs texte (sauvegarde uniquement sur blur)
    const [localTitle, setLocalTitle] = useState(task.title);
    const [localProject, setLocalProject] = useState(task.project);
    const [localNotes, setLocalNotes] = useState(task.notes || "");

    // Synchroniser les états locaux quand la tâche change (pour les champs texte)
    useEffect(() => {
        setLocalTitle(task.title);
        setLocalProject(task.project);
        setLocalNotes(task.notes || "");
    }, [task.id, task.title, task.project, task.notes]); // Sync sur les changements de la tâche

    // Fonction pour sauvegarder les modifications en attente
    const saveLocalChanges = useCallback(() => {
        const updates: Partial<TaskData> & { id?: string } = {}; // Using Partial<TaskData> essentially
        if (localTitle !== task.title) updates.title = localTitle;
        if (localProject !== task.project) updates.project = localProject;
        if (localNotes !== (task.notes || "")) updates.notes = localNotes;

        if (Object.keys(updates).length > 0) {
            onUpdate(task.id, updates);
        }
    }, [localTitle, localProject, localNotes, task.title, task.project, task.notes, task.id, onUpdate]);

    useEffect(() => {
        function closeOnClick(e: MouseEvent) {
            // Ignorer les clics sur les dropdowns d'autocomplete (rendus via portal)
            if ((e.target as Element).closest('[class*="z-[99999]"]')) {
                return;
            }
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                saveLocalChanges();
                onClose();
            }
        }
        document.addEventListener("mousedown", closeOnClick);
        return () => document.removeEventListener("mousedown", closeOnClick);
    }, [onClose, saveLocalChanges]);

    useEffect(() => {
        if (!menuRef.current) return;

        const menuWidth = menuRef.current.offsetWidth || 256;
        const menuHeight = menuRef.current.offsetHeight || 400;
        const padding = 16;

        let left = position.x;
        if (left + menuWidth + padding > window.innerWidth) {
            left = window.innerWidth - menuWidth - padding;
        }
        left = Math.max(padding, left);

        let top = position.y;
        if (top + menuHeight + padding > window.innerHeight) {
            top = position.y - menuHeight;
            if (top < padding) {
                top = padding;
            }
        }

        setAdjustedPosition({ top, left });
    }, [position.x, position.y]);

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[99999] w-64 max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-white/20 bg-white/5 p-3 text-slate-100 shadow-2xl backdrop-blur-xl"
            style={{
                top: adjustedPosition.top,
                left: adjustedPosition.left,
                animation: 'contextMenuSlideIn 0.15s ease-out'
            }}
        >
            <div className="grid gap-2">
                <label className="text-xs text-slate-400">Statut</label>
                <Autocomplete<StatusDef, 'todo' | 'doing' | 'review' | 'done'>
                    value={task.status}
                    onChange={(val) => onUpdate(task.id, { status: val })}
                    options={STATUSES}
                    placeholder="Statut"
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-left text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    getValue={(s) => s.id}
                    getLabel={(s) => s.label}
                />

                <label className="mt-2 text-xs text-slate-400">Titre</label>
                <input
                    type="text"
                    value={localTitle}
                    onChange={(e) => setLocalTitle(e.target.value)}
                    onBlur={() => localTitle !== task.title && onUpdate(task.id, { title: localTitle })}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLElement).blur()}
                    className="rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                />

                <label className="mt-2 text-xs text-slate-400">Projet</label>
                <ProjectAutocomplete
                    value={localProject || ""}
                    onChange={setLocalProject}
                    onBlur={(selectedValue) => {
                        const finalValue = selectedValue ?? localProject;
                        if (finalValue !== task.project) {
                            setLocalProject(finalValue || "");
                            onUpdate(task.id, { project: finalValue || undefined });
                        }
                    }}
                    projectHistory={projectHistory}
                    placeholder="Projet"
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] uppercase"
                />

                <label className="mt-2 text-xs text-slate-400">Échéance</label>
                <input
                    type="date"
                    value={task.due || ""}
                    onChange={(e) => onUpdate(task.id, { due: e.target.value })}
                    className="rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                />

                <label className="mt-2 text-xs text-slate-400">Priorité</label>
                <Autocomplete<PriorityDef, 'low' | 'med' | 'high'>
                    value={task.priority}
                    onChange={(val) => onUpdate(task.id, { priority: val })}
                    options={PRIORITIES}
                    placeholder="Priorité"
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-left text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    getValue={(p) => p.id}
                    getLabel={(p) => p.label}
                />

                <label className="mt-2 text-xs text-emerald-400">Créée par</label>
                <Autocomplete<{ id: string; name: string; email: string }, string>
                    value={task.createdBy}
                    onChange={(val) => onUpdate(task.id, { createdBy: val })}
                    options={users}
                    placeholder="Créateur"
                    className="w-full rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-left text-emerald-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    getValue={(u) => u.id}
                    getLabel={(u) => u.name}
                />

                <label className="mt-2 text-xs text-slate-400">Assigné à (sélection multiple)</label>
                <div className="w-full rounded-2xl border border-white/15 bg-white/5 p-2 space-y-1 max-h-32 overflow-y-auto">
                    {users.map(user => (
                        <label key={user.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition">
                            <input
                                type="checkbox"
                                checked={task.assignedTo.includes(user.id)}
                                onChange={(e) => {
                                    const newAssigned = e.target.checked
                                        ? [...task.assignedTo, user.id]
                                        : task.assignedTo.filter(id => id !== user.id);
                                    onUpdate(task.id, { assignedTo: newAssigned });
                                }}
                                className="h-4 w-4 rounded accent-blue-400 cursor-pointer"
                            />
                            <span className="text-sm text-slate-100">{user.name}</span>
                        </label>
                    ))}
                </div>

                <label className="mt-2 text-xs text-slate-400">Notes</label>
                <textarea
                    value={localNotes}
                    onChange={(e) => setLocalNotes(e.target.value)}
                    onBlur={() => localNotes !== (task.notes || "") && onUpdate(task.id, { notes: localNotes })}
                    className="rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                    rows={3}
                />

                {task.status === "done" && (
                    <button
                        onClick={() => {
                            onArchive(task.id);
                            onClose();
                        }}
                        className="mt-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-emerald-100 transition hover:bg-emerald-400/20"
                    >
                        Archiver
                    </button>
                )}

                <button
                    onClick={async () => {
                        if (await confirmModal(`Supprimer la t?che "${task.title}" ?`)) {
                            onDelete(task.id);
                            onClose();
                        }
                    }}
                    className="mt-2 rounded-2xl border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-rose-100 transition hover:bg-rose-400/20"
                >
                    Supprimer
                </button>
            
            </div>
        </div>,
        document.body
    );
}
