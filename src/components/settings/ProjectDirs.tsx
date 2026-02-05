import { useState, useMemo } from "react";
import useStore from "../../store/useStore";
import type { Directories } from "../../types";
import { Modal } from "../ui/Modal";

interface ProjectDirsProps {
    onClose: () => void;
}

export function ProjectDirs({ onClose }: ProjectDirsProps) {
    const { tasks, directories, setDirectories } = useStore();

    // Calculer la liste des projets (hors archives)
    const projects = useMemo(() => {
        const s = new Set(tasks.filter((t) => !t.archived && t.project).map((t) => t.project!));
        return [...s].sort();
    }, [tasks]);

    const [local, setLocal] = useState<Directories>(() => ({ ...directories }));

    function setPath(project: string, path: string) {
        setLocal((x) => ({ ...x, [project]: path }));
    }

    function save() {
        setDirectories(local);
        onClose();
    }

    return (
        <Modal isOpen={true} onClose={onClose} title="Dossiers projets" width="max-w-2xl">
            <p className="mt-2 text-sm text-slate-400">
                Saisis le chemin local du dossier pour chaque projet. Exemples :
                <br />
                Windows : <code className="rounded bg-white/10 px-1 text-xs">C:\Projets\AGDV</code>
                <br />
                macOS/Linux : <code className="rounded bg-white/10 px-1 text-xs">/Users/toi/Projets/AGDV</code>
            </p>
            <div className="mt-4 max-h-[50vh] space-y-3 overflow-auto pr-1">
                {projects.length === 0 && (
                    <div className="text-sm text-slate-400">
                        Aucun projet encore. Ajoute des tâches avec un champ « Projet » pour voir la liste ici.
                    </div>
                )}
                {projects.map((p) => (
                    <div key={p} className="grid grid-cols-5 items-center gap-2">
                        <div className="col-span-1 truncate text-sm font-medium text-slate-200" title={p}>
                            {p}
                        </div>
                        <input
                            className="col-span-4 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                            placeholder="Chemin du dossier (file system)"
                            value={local[p] || ""}
                            onChange={(e) => setPath(p, e.target.value)}
                        />
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
                Note : selon le navigateur, l'ouverture de liens <code>file://</code> peut être restreinte. Pour un usage 100% fiable,
                ouvre cette app en local (ex: <strong>file:///</strong> via un bundler dev) ou empaquette-la avec Electron/Tauri.
            </p>
        </Modal>
    );
}
