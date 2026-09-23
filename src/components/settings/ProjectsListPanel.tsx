import { useState, useMemo } from "react";
import { Pencil, Trash2, ArrowUpAZ, ArrowDownAZ, Search, X, List } from "lucide-react";
import useStore from "../../store/useStore";
import { useShallow } from 'zustand/react/shallow';
import { GlassModal } from "../ui/GlassModal";
import { alertModal, confirmModal } from "../../utils/confirm";
import { useTheme } from "../../hooks/useTheme";

interface ProjectsListPanelProps {
    onClose: () => void;
}

// Message affiché quand le renommage de projet est désactivé (voir plus bas) -- réutilisé
// pour le tooltip du bouton et pour le texte accessible.
const RENAME_DISABLED_MESSAGE = "Renommage de projet indisponible pour le moment — sera restauré dans une prochaine mise à jour.";

// Gap Task 4 (bascule backend) : `save()` ci-dessous remplace `projectHistory` et
// `directories` en bloc à partir d'un brouillon local (renommage/suppression/tri visuel),
// pas via une mutation par projet. Il n'existe par ailleurs aucun drag-and-drop de
// réordonnancement des projets dans l'UI actuelle -- le tri ici n'est que visuel côté
// affichage (`sortDir`), il ne persiste pas d'ordre. Le store expose désormais
// `setProjectOrder(name, order)` (route API PUT /api/projects/:name/order) pour un futur
// usage, mais brancher ce panneau dessus correctement demanderait de differ le brouillon et
// d'émettre un appel par ligne modifiée -- une vraie refonte, pas un simple remplacement
// d'appel. Laissé local-only pour l'instant.
export function ProjectsListPanel({ onClose }: ProjectsListPanelProps) {
    const { projectHistory, setProjectHistory, tasks, directories, setDirectories, renameProject } = useStore(useShallow((s) => ({ projectHistory: s.projectHistory, setProjectHistory: s.setProjectHistory, tasks: s.tasks, directories: s.directories, setDirectories: s.setDirectories, renameProject: s.renameProject })));
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;
    const [localHistory, setLocalHistory] = useState<string[]>(() => [...projectHistory]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState("");
    const [search, setSearch] = useState("");
    const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);

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

    // Vue filtrée + triée (conserve l'index original de localHistory)
    const displayList = useMemo(() => {
        const filtered = localHistory
            .map((name, index) => ({ name, index }))
            .filter(({ name }) => name.toLowerCase().includes(search.toLowerCase()));

        if (sortDir === 'asc') filtered.sort((a, b) => a.name.localeCompare(b.name));
        else if (sortDir === 'desc') filtered.sort((a, b) => b.name.localeCompare(a.name));

        return filtered;
    }, [localHistory, search, sortDir]);

    // Renommage désactivé côté UI (voir bouton "Renommer" plus bas, RENAME_DISABLED_MESSAGE) :
    // plus aucun appelant ne déclenche l'entrée en mode édition (editingIndex reste toujours
    // `null`), donc saveEditing/cancelEditing ci-dessous ne sont plus jamais atteintes en
    // pratique -- laissées en place pour rester le point de réactivation unique le jour où
    // le renommage sera reconverti en appel réseau (voir renameProject dans useStore.ts).
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
            if (!(await confirmModal(`Le projet "${projectName}" contient ${taskCount} tâche(s). Voulez-vous vraiment le supprimer de la liste ? (Les tâches ne seront pas supprimées)`))) {
                return;
            }
        }

        setLocalHistory(localHistory.filter((_, i) => i !== index));
        if (editingIndex === index) { setEditingIndex(null); setEditingValue(""); }
    }

    function save() {
        projectHistory.forEach((oldName, index) => {
            const newName = localHistory[index];
            if (newName && newName !== oldName) {
                renameProject(oldName, newName);
            }
        });

        const removed = projectHistory.filter(p => !localHistory.includes(p));
        if (removed.length > 0) {
            const finalDirectories = { ...directories };
            removed.forEach(p => { delete finalDirectories[p]; });
            setDirectories(finalDirectories);
        }

        setProjectHistory(localHistory);
        onClose();
    }

    const toggleSort = () => {
        setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
    };

    return (
        <GlassModal isOpen={true} onClose={onClose} title={<><List className="w-6 h-6 mr-2" style={{ color: primaryColor }} />Liste des projets</>} size="xl">
            <p className="mt-2 text-sm text-slate-400">
                Gérez la liste des projets utilisés pour l'autocomplétion. Vous pouvez renommer ou supprimer des projets.
            </p>

            {/* Barre recherche + tri */}
            <div className="mt-3 flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Rechercher un projet..."
                        className="w-full rounded-xl border border-[rgba(var(--overlay-rgb),0.1)] bg-[rgba(var(--overlay-rgb),0.05)] pl-8 pr-8 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-[rgba(var(--overlay-rgb),0.2)] focus:bg-[rgba(var(--overlay-rgb),0.1)]"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <button
                    onClick={toggleSort}
                    title={sortDir === 'asc' ? 'Tri A→Z (cliquer pour Z→A)' : sortDir === 'desc' ? 'Tri Z→A (cliquer pour désactiver)' : 'Tri désactivé (cliquer pour A→Z)'}
                    aria-label={sortDir === 'asc' ? 'Tri A→Z (cliquer pour Z→A)' : sortDir === 'desc' ? 'Tri Z→A (cliquer pour désactiver)' : 'Tri désactivé (cliquer pour A→Z)'}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                        sortDir
                            ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200'
                            : 'border-[rgba(var(--overlay-rgb),0.1)] bg-[rgba(var(--overlay-rgb),0.05)] text-slate-400 hover:bg-[rgba(var(--overlay-rgb),0.1)]'
                    }`}
                >
                    {sortDir === 'desc' ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
                    {sortDir === 'asc' ? 'A→Z' : sortDir === 'desc' ? 'Z→A' : 'Trier'}
                </button>
            </div>

            <div className="mt-3 max-h-[50vh] space-y-2 overflow-auto pr-1">
                {displayList.length === 0 && (
                    <div className="text-sm text-slate-400">
                        {search ? `Aucun projet ne correspond à "${search}".` : 'Aucun projet dans l\'historique.'}
                    </div>
                )}
                {displayList.map(({ name: project, index }) => (
                    <div key={index} className="flex items-center gap-2 rounded-xl border border-[rgba(var(--overlay-rgb),0.1)] bg-[rgba(var(--overlay-rgb),0.05)] p-2">
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
                                    className="flex-1 rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-[rgba(var(--overlay-rgb),0.05)] px-3 py-1 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] uppercase"
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
                                    className="rounded-lg border border-[rgba(var(--overlay-rgb),0.2)] bg-[rgba(var(--overlay-rgb),0.05)] px-2 py-1 text-xs text-slate-300 transition hover:bg-[rgba(var(--overlay-rgb),0.1)]"
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
                                    disabled
                                    className="rounded-lg border border-[rgba(var(--overlay-rgb),0.1)] bg-[rgba(var(--overlay-rgb),0.05)] p-2 text-slate-500 opacity-50 cursor-not-allowed"
                                    title={RENAME_DISABLED_MESSAGE}
                                    aria-label={RENAME_DISABLED_MESSAGE}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    onClick={() => deleteProject(index)}
                                    className="rounded-lg border border-rose-400/40 bg-rose-400/10 p-2 text-rose-100 transition hover:bg-rose-400/20"
                                    title="Supprimer"
                                    aria-label="Supprimer"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* Gap Task 4 (bascule backend) : save() ci-dessus remplace projectHistory/directories
                en bloc localement -- le poll 10s de fetchProjects (Task 10, useApiSync) peut donc
                faire réapparaître l'état serveur par-dessus peu après. Avertissement visible plutôt
                que silencieux, le temps d'une vraie conversion (voir commentaire en tête de fichier). */}
            <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                ⚠️ Les modifications enregistrées ici peuvent ne pas persister — fonctionnalité en cours de finalisation.
            </p>

            <div className="mt-3 flex justify-end gap-2">
                <button
                    onClick={onClose}
                    className="rounded-2xl border border-[rgba(var(--overlay-rgb),0.2)] px-4 py-2 text-slate-200 transition hover:bg-[rgba(var(--color-primary-rgb),0.6)]"
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
                Note : Supprimer un projet le retire uniquement de l'autocomplétion (les tâches associées ne sont pas supprimées).
            </p>
        </GlassModal>
    );
}
