import { useState } from "react";
import useStore from "../../store/useStore";
import type { User } from "../../types";
import { uid } from "../../utils";
import { GlassModal } from "../ui/GlassModal";
import { alertModal, confirmModal } from "../../utils/confirm";

interface UsersPanelProps {
    onClose: () => void;
}

export function UsersPanel({ onClose }: UsersPanelProps) {
    const { users, setUsers, currentUser, setCurrentUser } = useStore();
    const [localUsers, setLocalUsers] = useState<User[]>(() => [...users]);
    const [newUserName, setNewUserName] = useState("");
    const [newUserEmail, setNewUserEmail] = useState("");

    function addUser() {
        if (!newUserName.trim()) {
            alertModal("Le nom de l'utilisateur est requis");
            return;
        }
        if (!newUserEmail.trim() || !newUserEmail.includes("@")) {
            alertModal("Un email valide est requis");
            return;
        }

        const newUser: User = {
            id: uid(),
            name: newUserName.trim(),
            email: newUserEmail.trim().toLowerCase(),
        };

        setLocalUsers([...localUsers, newUser]);
        setNewUserName("");
        setNewUserEmail("");
    }

    async function removeUser(userId: string) {
        if (userId === "unassigned") {
            alertModal("Impossible de supprimer l'utilisateur par défaut");
            return;
        }
        if (await confirmModal("Supprimer cet utilisateur ?")) {
            setLocalUsers(localUsers.filter(u => u.id !== userId));
        }
    }

    function updateUser(userId: string, field: keyof User, value: string) {
        setLocalUsers(localUsers.map(u =>
            u.id === userId ? { ...u, [field]: value } : u
        ));
    }

    function save() {
        // Validation des emails
        for (const user of localUsers) {
            if (user.id !== "unassigned" && (!user.email || !user.email.includes("@"))) {
                alertModal(`L'utilisateur "${user.name}" doit avoir un email valide`);
                return;
            }
        }
        setUsers(localUsers);
        onClose();
    }

    return (
        <GlassModal isOpen={true} onClose={onClose} title="Gestion des utilisateurs" size="xl">
            <p className="mt-2 text-sm text-theme-muted">
                Gérez les utilisateurs qui peuvent être assignés aux tâches. L'email sera utilisé pour les relances futures.
            </p>

            {/* Utilisateur connecté */}
            <div className="mt-4 rounded-2xl border border-blue-400/30 bg-blue-400/5 p-4">
                <h4 className="text-sm font-semibold text-blue-200 mb-3">Utilisateur connecté</h4>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-theme-secondary">Session actuelle :</span>
                    <select
                        value={currentUser || "unassigned"}
                        onChange={(e) => setCurrentUser(e.target.value === "unassigned" ? null : e.target.value)}
                        className="flex-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-theme-primary focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 cursor-pointer"
                    >
                        <option value="unassigned" className="bg-slate-800 text-theme-primary">Non assigné</option>
                        {users.filter(u => u.id !== "unassigned").map(user => (
                            <option key={user.id} value={user.id} className="bg-slate-800 text-theme-primary">
                                {user.name} ({user.email})
                            </option>
                        ))}
                    </select>
                </div>
                <p className="mt-2 text-xs text-blue-300/70">
                    Cet utilisateur sera utilisé pour créer de nouvelles tâches et filtrer votre vue.
                </p>
            </div>

            {/* Liste des utilisateurs existants */}
            <div className="mt-4 max-h-[40vh] space-y-3 overflow-auto pr-1">
                {localUsers.map((user) => (
                    <div
                        key={user.id}
                        className="grid grid-cols-12 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3"
                    >
                        <div className="col-span-4">
                            <input
                                type="text"
                                value={user.name}
                                onChange={(e) => updateUser(user.id, "name", e.target.value)}
                                disabled={user.id === "unassigned"}
                                className="w-full rounded-xl border border-white/15 bg-white/5 px-2 py-1 text-sm text-theme-primary disabled:opacity-50 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                                placeholder="Nom"
                            />
                        </div>
                        <div className="col-span-6">
                            <input
                                type="email"
                                value={user.email}
                                onChange={(e) => updateUser(user.id, "email", e.target.value.toLowerCase())}
                                disabled={user.id === "unassigned"}
                                className="w-full rounded-xl border border-white/15 bg-white/5 px-2 py-1 text-sm text-theme-primary disabled:opacity-50 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                                placeholder="email@exemple.com"
                            />
                        </div>
                        <div className="col-span-2">
                            {user.id !== "unassigned" && (
                                <button
                                    onClick={() => removeUser(user.id)}
                                    className="w-full rounded-xl border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-xs text-rose-100 transition hover:bg-rose-400/20"
                                >
                                    Supprimer
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Ajout d'un nouvel utilisateur */}
            <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4">
                <h4 className="text-sm font-semibold text-emerald-200">Ajouter un utilisateur</h4>
                <div className="mt-3 grid grid-cols-12 gap-2">
                    <input
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        className="col-span-4 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-theme-primary placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                        placeholder="Nom complet"
                    />
                    <input
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="col-span-6 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-theme-primary placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                        placeholder="email@exemple.com"
                    />
                    <button
                        onClick={addUser}
                        className="col-span-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:brightness-110"
                    >
                        Ajouter
                    </button>
                </div>
            </div>

            {/* Boutons d'action */}
            <div className="mt-6 flex justify-end gap-2">
                <button
                    onClick={onClose}
                    className="rounded-2xl border border-white/20 px-4 py-2 text-theme-primary transition hover:bg-[#1E3A8A]/60"
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
        </GlassModal>
    );
}
