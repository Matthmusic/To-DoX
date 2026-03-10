import { useMemo, useState } from "react";
import { ShieldAlert, Trash2 } from "lucide-react";
import useStore from "../../store/useStore";
import { GlassModal } from "../ui/GlassModal";
import { alertModal, confirmModal } from "../../utils/confirm";

interface AdminProjectsPanelProps {
    onClose: () => void;
}

function normalizeProjectName(value?: string | null): string {
    return (value ?? "").trim().toUpperCase();
}

export function AdminProjectsPanel({ onClose }: AdminProjectsPanelProps) {
    const {
        currentUser,
        tasks,
        timeEntries,
        projectHistory,
        directories,
        projectColors,
        setTasks,
        setTimeEntries,
        setProjectHistory,
        setDirectories,
        setProjectColors,
    } = useStore();

    const [search, setSearch] = useState("");
    const isAdmin = currentUser === "matthieu";

    const projects = useMemo(() => {
        const stats = new Map<string, {
            name: string;
            tasksCount: number;
            timeEntriesCount: number;
            inHistory: boolean;
            hasDirectory: boolean;
            hasColor: boolean;
        }>();

        function ensure(rawName?: string | null) {
            const name = normalizeProjectName(rawName);
            if (!name) return null;
            if (!stats.has(name)) {
                stats.set(name, {
                    name,
                    tasksCount: 0,
                    timeEntriesCount: 0,
                    inHistory: false,
                    hasDirectory: false,
                    hasColor: false,
                });
            }
            return stats.get(name)!;
        }

        tasks.forEach((t) => {
            const s = ensure(t.project);
            if (s) s.tasksCount += 1;
        });

        timeEntries.forEach((e) => {
            const s = ensure(e.project);
            if (s) s.timeEntriesCount += 1;
        });

        projectHistory.forEach((p) => {
            const s = ensure(p);
            if (s) s.inHistory = true;
        });

        Object.keys(directories).forEach((p) => {
            const s = ensure(p);
            if (s) s.hasDirectory = true;
        });

        Object.keys(projectColors).forEach((p) => {
            const s = ensure(p);
            if (s) s.hasColor = true;
        });

        return Array.from(stats.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [tasks, timeEntries, projectHistory, directories, projectColors]);

    const filteredProjects = useMemo(() => {
        const q = normalizeProjectName(search);
        if (!q) return projects;
        return projects.filter((p) => p.name.includes(q));
    }, [projects, search]);

    async function deleteProjectEverywhere(projectName: string) {
        const target = normalizeProjectName(projectName);
        if (!target) return;

        const tasksCount = tasks.filter((t) => normalizeProjectName(t.project) === target).length;
        const timeEntriesCount = timeEntries.filter((e) => normalizeProjectName(e.project) === target).length;

        const confirmed = await confirmModal(
            `Suppression totale du projet "${target}" ?\n\n` +
            `Cette action retirera ce projet du JSON :\n` +
            `- ${tasksCount} tâche(s)\n` +
            `- ${timeEntriesCount} saisie(s) de pointage\n` +
            `- historique projets, dossiers et couleurs`
        );

        if (!confirmed) return;

        const nextTasks = tasks.filter((t) => normalizeProjectName(t.project) !== target);
        const nextTimeEntries = timeEntries.filter((e) => normalizeProjectName(e.project) !== target);
        const nextProjectHistory = projectHistory.filter((p) => normalizeProjectName(p) !== target);

        const nextDirectories: Record<string, string> = {};
        Object.entries(directories).forEach(([k, v]) => {
            if (normalizeProjectName(k) !== target) nextDirectories[k] = v;
        });

        const nextProjectColors: Record<string, number> = {};
        Object.entries(projectColors).forEach(([k, v]) => {
            if (normalizeProjectName(k) !== target) nextProjectColors[k] = v;
        });

        setTasks(nextTasks);
        setTimeEntries(nextTimeEntries);
        setProjectHistory(nextProjectHistory);
        setDirectories(nextDirectories);
        setProjectColors(nextProjectColors);

        await alertModal(`Projet "${target}" supprimé des données.`);
    }

    if (!isAdmin) {
        return (
            <GlassModal isOpen={true} onClose={onClose} title="Admin projets" size="md">
                <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
                    Accès refusé. Cette interface est réservée à Matthieu Maurel.
                </div>
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="rounded-2xl border border-white/20 px-4 py-2 text-slate-200 transition hover:bg-[#1E3A8A]/60"
                    >
                        Fermer
                    </button>
                </div>
            </GlassModal>
        );
    }

    return (
        <GlassModal isOpen={true} onClose={onClose} title="Admin projets (JSON)" size="xl">
            <div className="mt-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
                <div className="flex items-center gap-2 font-semibold">
                    <ShieldAlert className="h-4 w-4" />
                    Suppression totale
                </div>
                <p className="mt-1 text-[11px] text-amber-100/80">
                    Cette action supprime le projet dans les données persistées: tâches, pointage, historique, dossier et couleur.
                </p>
            </div>

            <div className="mt-4">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un projet..."
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                />
            </div>

            <div className="mt-4 max-h-[50vh] space-y-2 overflow-auto pr-1">
                {filteredProjects.length === 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-400">
                        Aucun projet trouvé.
                    </div>
                )}

                {filteredProjects.map((p) => (
                    <div key={p.name} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <div className="flex items-center gap-2">
                            <span className="flex-1 truncate text-sm font-semibold text-slate-100" title={p.name}>
                                {p.name}
                            </span>
                            <button
                                onClick={() => deleteProjectEverywhere(p.name)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20"
                                title="Supprimer totalement du JSON"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Supprimer
                            </button>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                            {p.tasksCount} tâche(s) · {p.timeEntriesCount} pointage(s)
                            {p.inHistory ? " · historique" : ""}
                            {p.hasDirectory ? " · dossier" : ""}
                            {p.hasColor ? " · couleur" : ""}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-5 flex justify-end">
                <button
                    onClick={onClose}
                    className="rounded-2xl border border-white/20 px-4 py-2 text-slate-200 transition hover:bg-[#1E3A8A]/60"
                >
                    Fermer
                </button>
            </div>
        </GlassModal>
    );
}

