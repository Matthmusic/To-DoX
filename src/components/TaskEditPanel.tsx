import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { STATUSES, PRIORITIES, type StatusDef, type PriorityDef } from "../constants";
import { Autocomplete } from "./Autocomplete";
import { ProjectAutocomplete } from "./ProjectAutocomplete";
import { DatePickerDropdown } from "./DatePickerModal";
import useStore from "../store/useStore";
import type { Task, TaskData, RecurrenceType } from "../types";
import { confirmModal, alertModal } from "../utils/confirm";
import { formatDateFull } from "../utils";
import { Repeat, BookmarkPlus, CheckCircle2, RotateCcw, Calendar, ExternalLink } from "lucide-react";
import { parseFilePaths, getDroppedFilePath, formatPathForInsertion, getPathDisplayName } from "./SubtaskList";

interface TaskEditPanelProps {
    task: Task;
    position: { x: number; y: number };
    onClose: () => void;
    centered?: boolean;
}

/**
 * Panneau d'édition pour clic droit sur une tâche
 */
export function TaskEditPanel({ task: initialTask, position, onClose, centered = false }: TaskEditPanelProps) {
    const { updateTask, removeTask, archiveTask, users, projectHistory, tasks, addTemplate, setReviewers, currentUser } = useStore();
    const sortedUsers = [...users].sort((a, b) => {
        if (a.id === currentUser) return -1;
        if (b.id === currentUser) return 1;
        return 0;
    });

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
    const [notesEditing, setNotesEditing] = useState(false);
    const [notesDropTarget, setNotesDropTarget] = useState(false);
    const [notesEditDropTarget, setNotesEditDropTarget] = useState(false);
    const notesRef = useRef<HTMLTextAreaElement>(null);
    const [showDateDropdown, setShowDateDropdown] = useState(false);

    // Synchroniser les états locaux quand la tâche change (pour les champs texte)
    useEffect(() => {
        setLocalTitle(task.title);
        setLocalProject(task.project);
        setLocalNotes(task.notes || "");
        setNotesEditing(false);
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

    const panel = (
        <div
            ref={menuRef}
            className="fixed z-[99999] w-[calc(100vw-1rem)] sm:w-[32rem] max-h-[85vh] sm:max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-white/20 bg-white/5 p-3 text-slate-100 shadow-2xl backdrop-blur-xl"
            style={
                centered
                    ? {
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        animation: 'contextMenuSlideIn 0.15s ease-out',
                    }
                    : {
                        top: adjustedPosition.top,
                        left: adjustedPosition.left,
                        animation: 'contextMenuSlideIn 0.15s ease-out',
                    }
            }
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
                    className="rounded-2xl border border-white/15 bg-white/5 px-2 py-1 text-slate-100 uppercase focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
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
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowDateDropdown(v => !v)}
                        className="flex w-full items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-slate-100 transition hover:bg-white/10"
                    >
                        <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                        <span>{task.due ? formatDateFull(task.due) : 'Aucune date'}</span>
                    </button>
                    <DatePickerDropdown
                        isOpen={showDateDropdown}
                        value={task.due || new Date().toISOString().split('T')[0]}
                        onSelect={(iso) => { onUpdate(task.id, { due: iso }); }}
                        onClose={() => setShowDateDropdown(false)}
                    />
                </div>

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
                    {sortedUsers.map(user => (
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

                <label className="mt-2 text-xs text-violet-400">Réviseurs</label>
                <div className="w-full rounded-2xl border border-violet-400/20 bg-violet-400/5 p-2 space-y-1 max-h-32 overflow-y-auto">
                    {sortedUsers.map(user => (
                        <label key={user.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition">
                            <input
                                type="checkbox"
                                checked={(task.reviewers || []).includes(user.id)}
                                onChange={(e) => {
                                    const newReviewers = e.target.checked
                                        ? [...(task.reviewers || []), user.id]
                                        : (task.reviewers || []).filter(id => id !== user.id);
                                    setReviewers(task.id, newReviewers);
                                }}
                                className="h-4 w-4 rounded accent-violet-400 cursor-pointer"
                            />
                            <span className="text-sm text-slate-100">{user.name}</span>
                        </label>
                    ))}
                </div>

                {/* Historique de révision */}
                {(task.reviewValidatedBy || task.reviewRejectedBy) && (
                    <>
                        <label className="mt-2 text-xs text-slate-400">Historique révision</label>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                            {task.reviewValidatedBy && (
                                <div className="flex items-center gap-2 text-xs text-emerald-400">
                                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span>
                                        Validé par {users.find(u => u.id === task.reviewValidatedBy)?.name ?? task.reviewValidatedBy}
                                        {task.reviewValidatedAt && ` · ${new Date(task.reviewValidatedAt).toLocaleDateString('fr-FR')}`}
                                    </span>
                                </div>
                            )}
                            {task.reviewRejectedBy && (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-xs text-amber-400">
                                        <RotateCcw className="h-3.5 w-3.5 flex-shrink-0" />
                                        <span>
                                            Corrections demandées par {users.find(u => u.id === task.reviewRejectedBy)?.name ?? task.reviewRejectedBy}
                                            {task.reviewRejectedAt && ` · ${new Date(task.reviewRejectedAt).toLocaleDateString('fr-FR')}`}
                                        </span>
                                    </div>
                                    {task.rejectionComment && (
                                        <p className="ml-5 text-xs text-slate-400 italic">"{task.rejectionComment}"</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                <label className="mt-2 text-xs text-slate-400">Notes</label>
                {notesEditing ? (
                    <textarea
                        ref={notesRef}
                        value={localNotes}
                        onChange={(e) => setLocalNotes(e.target.value)}
                        onBlur={() => {
                            if (localNotes !== (task.notes || "")) onUpdate(task.id, { notes: localNotes });
                            setNotesEditing(false);
                        }}
                        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setNotesEditDropTarget(true); } }}
                        onDragLeave={() => setNotesEditDropTarget(false)}
                        onDrop={(e) => {
                            if (e.dataTransfer.files.length === 0) return;
                            e.preventDefault();
                            setNotesEditDropTarget(false);
                            const file = e.dataTransfer.files[0];
                            const path = getDroppedFilePath(file);
                            if (!path) return;
                            const formattedPath = formatPathForInsertion(path);
                            const ta = e.currentTarget;
                            const start = ta.selectionStart ?? localNotes.length;
                            const end = ta.selectionEnd ?? localNotes.length;
                            const newNotes = localNotes.slice(0, start) + (localNotes.slice(0, start).length > 0 ? '\n' : '') + formattedPath + localNotes.slice(end);
                            setLocalNotes(newNotes);
                            onUpdate(task.id, { notes: newNotes });
                        }}
                        className={`rounded-2xl border px-2 py-1 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] transition ${notesEditDropTarget ? 'border-blue-400/60 bg-blue-400/10' : 'border-white/15 bg-white/5'}`}
                        rows={3}
                        autoFocus
                    />
                ) : (
                    <div
                        onClick={() => { setNotesEditing(true); setTimeout(() => notesRef.current?.focus(), 10); }}
                        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setNotesDropTarget(true); } }}
                        onDragLeave={() => setNotesDropTarget(false)}
                        onDrop={(e) => {
                            if (e.dataTransfer.files.length === 0) return;
                            e.preventDefault();
                            setNotesDropTarget(false);
                            const file = e.dataTransfer.files[0];
                            const path = getDroppedFilePath(file);
                            if (!path) return;
                            const formattedPath = formatPathForInsertion(path);
                            const newNotes = localNotes ? `${localNotes}\n${formattedPath}` : formattedPath;
                            setLocalNotes(newNotes);
                            onUpdate(task.id, { notes: newNotes });
                        }}
                        className={`min-h-[60px] cursor-text rounded-2xl border px-2 py-1 text-sm transition ${notesDropTarget ? 'border-blue-400/60 bg-blue-400/10' : 'border-white/15 bg-white/5'}`}
                        title="Cliquer pour éditer · Déposer un fichier pour insérer son chemin"
                    >
                        {localNotes ? (
                            <span className="whitespace-pre-wrap leading-relaxed">
                                {parseFilePaths(localNotes).map((part, idx) =>
                                    part.type === 'path' ? (
                                        <button
                                            key={idx}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.electronAPI?.openFolder) window.electronAPI.openFolder(part.content);
                                            }}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(part.content);
                                            }}
                                            className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 hover:text-blue-200 transition border border-blue-500/30 font-mono text-xs"
                                            title={part.content}
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            {getPathDisplayName(part.content)}
                                        </button>
                                    ) : (
                                        <span key={idx} className="text-slate-300">{part.content}</span>
                                    )
                                )}
                            </span>
                        ) : (
                            <span className="text-slate-500 italic">Notes... (déposer un fichier pour l'insérer)</span>
                        )}
                    </div>
                )}

                {/* Récurrence */}
                <label className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                    <Repeat className="w-3 h-3" /> Récurrence
                </label>
                <div className="flex gap-2 flex-wrap">
                    {([null, 'daily', 'weekly', 'monthly'] as (RecurrenceType | null)[]).map(type => (
                        <button
                            key={type ?? 'none'}
                            onClick={() => onUpdate(task.id, {
                                recurrence: type ? { type } : undefined
                            })}
                            className={`rounded-xl px-3 py-1 text-xs transition border ${
                                (task.recurrence?.type ?? null) === type
                                    ? 'border-blue-400/60 bg-blue-400/20 text-blue-200'
                                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                            }`}
                        >
                            {type === null ? 'Aucune' : type === 'daily' ? 'Quotidien' : type === 'weekly' ? 'Hebdo' : 'Mensuel'}
                        </button>
                    ))}
                </div>

                {/* Enregistrer les sous-tâches comme template */}
                <button
                    onClick={async () => {
                        if (task.subtasks.length === 0) {
                            await alertModal("Cette tâche n'a aucune sous-tâche à enregistrer comme template.");
                            return;
                        }
                        addTemplate({
                            name: task.title,
                            subtaskTitles: task.subtasks.map(s => s.title),
                        });
                        onClose();
                    }}
                    className="mt-2 flex items-center gap-2 rounded-2xl border border-violet-400/40 bg-violet-400/10 px-2 py-1 text-violet-200 transition hover:bg-violet-400/20 text-sm"
                >
                    <BookmarkPlus className="w-4 h-4" />
                    Enregistrer les sous-tâches comme template
                </button>

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
                        if (await confirmModal(`Supprimer la tâche "${task.title}" ?`)) {
                            onDelete(task.id);
                            onClose();
                        }
                    }}
                    className="mt-2 rounded-2xl border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-rose-100 transition hover:bg-rose-400/20"
                >
                    Supprimer
                </button>

            </div>
        </div>
    );

    return createPortal(
        centered ? (
            <div
                className="fixed inset-0 z-[99998] flex items-center justify-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
                onMouseDown={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
            >
                {panel}
            </div>
        ) : panel,
        document.body
    );
}
