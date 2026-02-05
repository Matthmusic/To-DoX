import { useState, useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import useStore from "../../store/useStore";
import { Modal } from "../ui/Modal";
import { alertModal, confirmModal } from "../../utils/confirm";

interface ProjectsListPanelProps {
    onClose: () => void;
}

export function ProjectsListPanel({ onClose }: ProjectsListPanelProps) {
    const { projectHistory, setProjectHistory, tasks, setTasks, directories, setDirectories } = useStore();
    const [localHistory, setLocalHistory] = useState<string[]>(() => [...projectHistory]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState("");

    // Compte le nombre de tâches par projet
    const taskCountByProject = useMemo(() => {
        const counts: Record<string, number> = {};
        tasks.forEach(t => {
            if (t.project) {
                counts[t.project] = (counts[t.project] || 0) + 1;
            }
        });
        return counts;
    }, [tasks]);

    function startEditing(index: number) {
        setEditingIndex(index);
        setEditingValue(localHistory[index]);
    }

    function saveEditing() {
        if (editingIndex === null) return;

        const oldName = localHistory[editingIndex];
        const newName = editingValue.trim().toUpperCase();

        if (!newName) {
            alertModal("Le nom du projet ne peut pas être vide");
            return;
        }

        if (newName !== oldName && localHistory.includes(newName)) {
            alertModal("Un projet avec ce nom existe déjà");
            return;
        }

        // Mettre à jour la liste locale
        const newHistory = [...localHistory];
        newHistory[editingIndex] = newName;
        setLocalHistory(newHistory);

        setEditingIndex(null);
        setEditingValue("");
    }

    function cancelEditing() {
        setEditingIndex(null);
        setEditingValue("");
    }

    async function deleteProject(index: number) {
        const projectName = localHistory[index];
        const taskCount = taskCountByProject[projectName] || 0;

        if (taskCount > 0) {
            if (!(await confirmModal(`Le projet "${projectName}" contient ${taskCount} tâche(s).Voulez - vous vraiment le supprimer de la liste ? (Les tâches ne seront pas supprimées)`))) {
                return;
            }
        }

        const newHistory = localHistory.filter((_, i) => i !== index);
        setLocalHistory(newHistory);
    }

    function save() {
        // Détecter les renommages
        const renames: Record<string, string> = {};
        projectHistory.forEach((oldName, index) => {
            const newName = localHistory[index];
            if (newName && newName !== oldName) {
                renames[oldName] = newName;
            }
        });

        // Appliquer les renommages aux tâches
        if (Object.keys(renames).length > 0) {
            const newTasks = tasks.map(t => {
                if (t.project && renames[t.project]) {
                    return { ...t, project: renames[t.project] };
                }
                return t;
            });
            // Update store
            setTasks(newTasks);
        }

        // Apply renames/removals to directories
        // Combine renames and removals on a fresh copy of directories
        const finalDirectories = { ...directories };

        // Apply renames
        if (Object.keys(renames).length > 0) {
            Object.entries(renames).forEach(([oldName, newName]) => {
                if (finalDirectories[oldName]) {
                    finalDirectories[newName] = finalDirectories[oldName];
                    delete finalDirectories[oldName];
                }
            });
        }

        // Apply removals
        const removed = projectHistory.filter(p => !localHistory.includes(p));
        removed.forEach(p => {
            delete finalDirectories[p];
        });

        setDirectories(finalDirectories);
        setProjectHistory(localHistory);
        onClose();
    }

    return (
        <Modal isOpen={true} onClose={onClose} title="Liste des projets" width="max-w-xl">
            <p className="mt-2 text-sm text-slate-400">
                Gérez la liste des projets utilisés pour l'autocomplétion. Vous pouvez renommer ou supprimer des projets.
            </p>
            <div className="mt-4 max-h-[50vh] space-y-2 overflow-auto pr-1">
                {localHistory.length === 0 && (
                    <div className="text-sm text-slate-400">
                        Aucun projet dans l'historique.
                    </div>
                )}
                {localHistory.map((project, index) => (
                    <div key={index} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
                        {editingIndex === index ? (
                            <>
                                <input
                                    type="text"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") saveEditing();
                                        if (e.key === "Escape") cancelEditing();
                                    }}
                                    className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] uppercase"
                                    autoFocus
                                />
                                <button
                                    onClick={saveEditing}
                                    className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-100 transition hover:bg-emerald-400/20"
                                >
                                    OK
                                </button>
                                <button
                                    onClick={cancelEditing}
                                    className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/10"
                                >
                                    Annuler
                                </button>
                            </>
                        ) : (
                            <>
                                <span className="flex-1 text-sm font-medium text-slate-200">{project}</span>
                                <span className="text-xs text-slate-500">
                                    {taskCountByProject[project] || 0} tâche(s)
                                </span>
                                <button
                                    onClick={() => startEditing(index)}
                                    className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 p-1.5 text-cyan-100 transition hover:bg-cyan-400/20"
                                    title="Renommer"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    onClick={() => deleteProject(index)}
                                    className="rounded-lg border border-rose-400/40 bg-rose-400/10 p-1.5 text-rose-100 transition hover:bg-rose-400/20"
                                    title="Supprimer"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </>
                        )}
                    </div>
                ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
                <button
                    onClick={onClose}
                    className="rounded-2xl border border-white/20 px-4 py-2 text-slate-200 transition hover:bg-[#1E3A8A]/60"
                >
                    Annuler
                </button>
                <button
                    onClick={save}
                    className="rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 px-5 py-2 font-semibold text-slate-900 shadow-lg shadow-emerald-500/20"
                >
                    Enregistrer
                </button>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
                Note : Renommer un projet mettra à jour toutes les tâches associées. Supprimer un projet le retire uniquement de l'autocomplétion.
            </p>
        </Modal>
    );
}
