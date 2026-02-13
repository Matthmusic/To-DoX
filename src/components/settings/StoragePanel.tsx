import { useState } from "react";
import useStore from "../../store/useStore";
import { GlassModal } from "../ui/GlassModal";
import { alertModal } from "../../utils/confirm";

interface StoragePanelProps {
    onClose: () => void;
}

export function StoragePanel({ onClose }: StoragePanelProps) {
    const { storagePath, setStoragePath } = useStore();
    const [localPath, setLocalPath] = useState(storagePath || "");
    const [changeMessage, setChangeMessage] = useState("");

    async function chooseFolder() {
        if (!window.electronAPI?.chooseStorageFolder) return;

        const result = await window.electronAPI.chooseStorageFolder();
        if (result.success && result.path) {
            setLocalPath(result.path);
        }
    }

    function savePath() {
        if (!localPath) {
            alertModal("Veuillez choisir un dossier de stockage");
            return;
        }

        // Sauvegarder le nouveau chemin
        localStorage.setItem('storage_path', localPath);
        setStoragePath(localPath);
        setChangeMessage("⚠️ Le chemin a été modifié. Veuillez redémarrer l'application pour appliquer les changements.");

        // Fermer après 3 secondes
        setTimeout(() => {
            onClose();
        }, 3000);
    }

    async function openStorageFolder() {
        if (storagePath && window.electronAPI?.openFolder) {
            await window.electronAPI.openFolder(storagePath);
        }
    }

    return (
        <GlassModal isOpen={true} onClose={onClose} title="Configuration du stockage" size="lg">
            <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-indigo-400/30 bg-indigo-400/5 p-4">
                    <h4 className="text-sm font-semibold text-indigo-200">🗂️ Stockage Partagé</h4>
                    <p className="mt-2 text-sm text-slate-400">
                        Vos données sont stockées sur le serveur partagé (Z:\) pour une collaboration multi-utilisateurs en temps réel.
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                        Chemin actuel : <code className="rounded bg-white/10 px-2 py-1">{storagePath || "Non défini"}</code>
                    </p>
                </div>

                {changeMessage && (
                    <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
                        <p className="text-sm text-amber-200">{changeMessage}</p>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-sm text-slate-400">Changer le dossier de stockage</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={localPath}
                            onChange={(e) => setLocalPath(e.target.value)}
                            className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                            placeholder="Z:\F - UTILITAIRES\TODOX"
                        />
                        <button
                            onClick={chooseFolder}
                            className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-slate-100 transition hover:bg-[#1E3A8A]/60"
                        >
                            Parcourir...
                        </button>
                    </div>
                </div>

                <div className="rounded-2xl border border-rose-400/30 bg-rose-400/5 p-4">
                    <h4 className="text-sm font-semibold text-rose-200">⚠️ Important</h4>
                    <ul className="mt-2 space-y-1 text-xs text-slate-400">
                        <li>• Les sauvegardes automatiques sont créées dans le dossier <code className="rounded bg-white/10 px-1">backups/</code></li>
                        <li>• Les 5 dernières sauvegardes sont conservées</li>
                        <li>• Évitez de modifier les fichiers manuellement pendant l'utilisation</li>
                        <li>• Si OneDrive est en mode "en ligne uniquement", la première ouverture peut être lente</li>
                    </ul>
                </div>
            </div>

            <div className="mt-6 flex justify-between gap-2">
                <button
                    onClick={openStorageFolder}
                    className="rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-cyan-100 transition hover:bg-cyan-400/20"
                >
                    Ouvrir le dossier
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="rounded-2xl border border-white/20 px-4 py-2 text-slate-200 transition hover:bg-[#1E3A8A]/60"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={savePath}
                        className="rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 px-5 py-2 font-semibold text-slate-900 shadow-lg shadow-emerald-500/20"
                    >
                        Enregistrer
                    </button>
                </div>
            </div>
        </GlassModal>
    );
}
