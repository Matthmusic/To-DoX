import { useState } from "react";
import { KeyRound, Shield, ShieldOff, Users } from "lucide-react";
import { IS_API_MODE } from "../../api/client";
import { apiResetUserPassword, apiSetUserAdmin } from "../../api/auth";
import useStore from "../../store/useStore";
import type { User } from "../../types";
import { uid } from "../../utils";
import { GlassModal } from "../ui/GlassModal";
import { alertModal, confirmModal } from "../../utils/confirm";
import { useTheme } from "../../hooks/useTheme";

interface UsersPanelProps {
    onClose: () => void;
}

export function UsersPanel({ onClose }: UsersPanelProps) {
    const { users, setUsers, currentUser, setCurrentUser } = useStore();
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;
    const [localUsers, setLocalUsers] = useState<User[]>(() => [...users]);
    const [newUserName, setNewUserName] = useState("");
    const [newUserEmail, setNewUserEmail] = useState("");

    // Réinitialisation de mot de passe (mode API uniquement)
    const [resetTargetId, setResetTargetId] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [resetLoading, setResetLoading] = useState(false);

    const currentUserObj = users.find(u => u.id === currentUser);
    const isAdmin = IS_API_MODE && currentUserObj?.isAdmin === true;

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

    async function handleResetPassword() {
        if (!resetTargetId || !newPassword) return;
        if (newPassword.length < 6) {
            alertModal("Le mot de passe doit faire au moins 6 caractères");
            return;
        }
        setResetLoading(true);
        try {
            await apiResetUserPassword(resetTargetId, newPassword);
            setResetTargetId(null);
            setNewPassword("");
            alertModal("Mot de passe mis à jour avec succès");
        } catch {
            alertModal("Erreur lors de la mise à jour du mot de passe");
        } finally {
            setResetLoading(false);
        }
    }

    async function handleToggleAdmin(user: User) {
        const action = user.isAdmin ? "retirer les droits admin de" : "passer admin";
        if (!await confirmModal(`Voulez-vous ${action} ${user.name} ?`)) return;
        try {
            const updated = await apiSetUserAdmin(user.id, !user.isAdmin);
            setLocalUsers(localUsers.map(u => u.id === updated.id ? updated : u));
            setUsers(users.map(u => u.id === updated.id ? updated : u));
        } catch {
            alertModal("Erreur lors de la mise à jour des droits");
        }
    }

    function save() {
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
        <GlassModal isOpen={true} onClose={onClose} title={<><Users className="w-6 h-6 mr-2" style={{ color: primaryColor }} />Gestion des utilisateurs</>} size="xl">
            <p className="mt-2 text-sm text-theme-muted">
                Gérez les utilisateurs qui peuvent être assignés aux tâches.{isAdmin && " En tant qu'administrateur, vous pouvez réinitialiser les mots de passe."}
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
                        {[...users].filter(u => u.id !== "unassigned").sort((a, b) => {
                            if (a.id === currentUser) return -1;
                            if (b.id === currentUser) return 1;
                            return 0;
                        }).map(user => (
                            <option key={user.id} value={user.id} className="bg-slate-800 text-theme-primary">
                                {user.name} ({user.email}){user.isAdmin ? " 👑" : ""}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Liste des utilisateurs */}
            <div className="mt-4 max-h-[40vh] space-y-3 overflow-auto pr-1">
                {localUsers.map((user) => (
                    <div key={user.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
                        <div className="flex flex-col sm:grid sm:grid-cols-12 items-stretch sm:items-center gap-2">
                            <div className="w-full sm:col-span-4">
                                <input
                                    type="text"
                                    value={user.name}
                                    onChange={(e) => updateUser(user.id, "name", e.target.value)}
                                    disabled={user.id === "unassigned"}
                                    className="w-full rounded-xl border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-theme-primary disabled:opacity-50 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                                    placeholder="Nom"
                                />
                            </div>
                            <div className="w-full sm:col-span-5">
                                <input
                                    type="email"
                                    value={user.email}
                                    onChange={(e) => updateUser(user.id, "email", e.target.value.toLowerCase())}
                                    disabled={user.id === "unassigned"}
                                    className="w-full rounded-xl border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-theme-primary disabled:opacity-50 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                                    placeholder="email@exemple.com"
                                />
                            </div>
                            <div className="w-full sm:col-span-3 flex gap-1">
                                {isAdmin && user.id !== "unassigned" && (
                                    <button
                                        onClick={() => handleToggleAdmin(user)}
                                        title={user.isAdmin ? "Retirer admin" : "Passer admin"}
                                        className={`flex-1 rounded-xl border px-2 py-1.5 text-xs transition ${user.isAdmin ? "border-amber-400/40 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20" : "border-white/15 bg-white/5 text-slate-400 hover:bg-white/10"}`}
                                    >
                                        {user.isAdmin ? <Shield className="w-3 h-3 mx-auto" /> : <ShieldOff className="w-3 h-3 mx-auto" />}
                                    </button>
                                )}
                                {isAdmin && user.id !== "unassigned" && (
                                    <button
                                        onClick={() => { setResetTargetId(user.id); setNewPassword(""); }}
                                        title="Réinitialiser le mot de passe"
                                        className="flex-1 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-2 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-400/20"
                                    >
                                        <KeyRound className="w-3 h-3 mx-auto" />
                                    </button>
                                )}
                                {user.id !== "unassigned" && (
                                    <button
                                        onClick={() => removeUser(user.id)}
                                        className="flex-1 rounded-xl border border-rose-400/40 bg-rose-400/10 px-2 py-1.5 text-xs text-rose-100 transition hover:bg-rose-400/20"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Formulaire de réinitialisation inline */}
                        {isAdmin && resetTargetId === user.id && (
                            <div className="flex gap-2 pt-1 border-t border-white/10">
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                                    placeholder="Nouveau mot de passe (min. 6 car.)"
                                    autoFocus
                                    className="flex-1 rounded-xl border border-cyan-400/30 bg-cyan-400/5 px-3 py-1.5 text-sm text-theme-primary placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                                />
                                <button
                                    onClick={handleResetPassword}
                                    disabled={resetLoading}
                                    className="rounded-xl bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-50"
                                >
                                    {resetLoading ? "…" : "Valider"}
                                </button>
                                <button
                                    onClick={() => { setResetTargetId(null); setNewPassword(""); }}
                                    className="rounded-xl border border-white/15 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/10"
                                >
                                    Annuler
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Ajout d'un nouvel utilisateur */}
            <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4">
                <h4 className="text-sm font-semibold text-emerald-200">Ajouter un utilisateur</h4>
                <div className="mt-3 flex flex-col sm:grid sm:grid-cols-12 gap-2">
                    <input
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        className="w-full sm:col-span-4 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-theme-primary placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                        placeholder="Nom complet"
                    />
                    <input
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="w-full sm:col-span-6 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-theme-primary placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                        placeholder="email@exemple.com"
                    />
                    <button
                        onClick={addUser}
                        className="w-full sm:col-span-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:brightness-110"
                    >
                        Ajouter
                    </button>
                </div>
            </div>

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
