import { useState } from "react";
import { Users, Eye, EyeOff } from "lucide-react";
import useStore from "../../store/useStore";
import { useShallow } from 'zustand/react/shallow';
import type { User } from "../../types";
import { GlassModal } from "../ui/GlassModal";
import { alertModal, confirmModal } from "../../utils/confirm";
import { useTheme } from "../../hooks/useTheme";
import { ApiError } from "../../services/api";
import { MIN_PASSWORD_LENGTH } from "../../constants";

interface UsersPanelProps {
    onClose: () => void;
}

// L'AJOUT passe par le backend (createUser -> POST /api/users, admin uniquement).
// La modification et la suppression restent un brouillon local (localUsers, validé par
// setUsers au clic "Enregistrer") : il n'existe pas encore de PUT/DELETE /api/users/:id côté
// backend, et supprimer un utilisateur qui a des tâches/commentaires assignés pose une vraie
// question produit (le schéma Prisma User n'a pas de cascade sur ces relations).
export function UsersPanel({ onClose }: UsersPanelProps) {
    const { users, setUsers, currentUser, setCurrentUser, createUser } = useStore(useShallow((s) => ({ users: s.users, setUsers: s.setUsers, currentUser: s.currentUser, setCurrentUser: s.setCurrentUser, createUser: s.createUser })));
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;
    const [localUsers, setLocalUsers] = useState<User[]>(() => [...users]);
    const [newUserName, setNewUserName] = useState("");
    const [newUserEmail, setNewUserEmail] = useState("");
    const [newUserPassword, setNewUserPassword] = useState("");
    const [showNewUserPassword, setShowNewUserPassword] = useState(false);
    const [creating, setCreating] = useState(false);

    // role absent = compte pas encore synchronisé avec le backend : on ne présume pas admin.
    const isAdmin = users.find(u => u.id === currentUser)?.role === 'admin';

    async function addUser() {
        if (creating) return;
        if (!newUserName.trim()) {
            alertModal("Le nom de l'utilisateur est requis");
            return;
        }
        if (!newUserEmail.trim() || !newUserEmail.includes("@")) {
            alertModal("Un email valide est requis");
            return;
        }
        if (newUserPassword.length < MIN_PASSWORD_LENGTH) {
            alertModal(`Le mot de passe initial doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`);
            return;
        }

        setCreating(true);
        try {
            const created = await createUser({
                name: newUserName.trim(),
                email: newUserEmail.trim().toLowerCase(),
                password: newUserPassword,
            });
            // Le brouillon doit aussi contenir le compte créé : sinon "Enregistrer" (setUsers(localUsers))
            // le retirerait du store jusqu'au prochain poll.
            setLocalUsers(prev => [...prev, created]);
            setNewUserName("");
            setNewUserEmail("");
            setNewUserPassword("");
        } catch (err) {
            alertModal(err instanceof ApiError ? err.message : "Erreur de connexion au serveur");
        } finally {
            setCreating(false);
        }
    }

    async function removeUser(userId: string) {
        // Pas de DELETE /api/users/:id côté backend — voir commentaire en tête de fichier.
        if (userId === "unassigned") {
            alertModal("Impossible de supprimer l'utilisateur par défaut");
            return;
        }
        if (await confirmModal("Supprimer cet utilisateur ?")) {
            setLocalUsers(localUsers.filter(u => u.id !== userId));
        }
    }

    function updateUser(userId: string, field: keyof User, value: string) {
        // Pas de PUT /api/users/:id côté backend — voir commentaire en tête de fichier.
        setLocalUsers(localUsers.map(u =>
            u.id === userId ? { ...u, [field]: value } : u
        ));
    }

    function save() {
        // Commit local uniquement (setUsers) pour la modification/suppression — voir commentaire en tête de fichier.
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
        <GlassModal isOpen={true} onClose={onClose} title={<><Users className="w-6 h-6 mr-2" style={{ color: primaryColor }} />Gestion des utilisateurs</>} size="xl">
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
                        className="flex-1 rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-[rgba(var(--overlay-rgb),0.1)] px-3 py-2 text-theme-primary focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 cursor-pointer"
                    >
                        <option value="unassigned" className="bg-slate-800 text-theme-primary">Non assigné</option>
                        {[...users].filter(u => u.id !== "unassigned").sort((a, b) => {
                            if (a.id === currentUser) return -1;
                            if (b.id === currentUser) return 1;
                            return 0;
                        }).map(user => (
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
                        className="flex flex-col sm:grid sm:grid-cols-12 items-stretch sm:items-center gap-2 rounded-2xl border border-[rgba(var(--overlay-rgb),0.1)] bg-[rgba(var(--overlay-rgb),0.05)] p-3"
                    >
                        <div className="w-full sm:col-span-4">
                            <input
                                type="text"
                                value={user.name}
                                onChange={(e) => updateUser(user.id, "name", e.target.value)}
                                disabled={user.id === "unassigned"}
                                className="w-full rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-[rgba(var(--overlay-rgb),0.05)] px-2 py-1.5 text-sm text-theme-primary disabled:opacity-50 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                placeholder="Nom"
                            />
                        </div>
                        <div className="w-full sm:col-span-6">
                            <input
                                type="email"
                                value={user.email}
                                onChange={(e) => updateUser(user.id, "email", e.target.value.toLowerCase())}
                                disabled={user.id === "unassigned"}
                                className="w-full rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-[rgba(var(--overlay-rgb),0.05)] px-2 py-1.5 text-sm text-theme-primary disabled:opacity-50 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                placeholder="email@exemple.com"
                            />
                        </div>
                        <div className="w-full sm:col-span-2">
                            {user.id !== "unassigned" && (
                                <button
                                    onClick={() => removeUser(user.id)}
                                    className="w-full rounded-xl border border-rose-400/40 bg-rose-400/10 px-2 py-1.5 text-xs text-rose-100 transition hover:bg-rose-400/20"
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
                {isAdmin ? (
                    <div className="mt-3 flex flex-col sm:grid sm:grid-cols-12 gap-2">
                        <input
                            type="text"
                            aria-label="Nom du nouvel utilisateur"
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            className="w-full sm:col-span-3 rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-[rgba(var(--overlay-rgb),0.05)] px-3 py-2 text-theme-primary placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            placeholder="Nom complet"
                        />
                        <input
                            type="email"
                            aria-label="Email du nouvel utilisateur"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            className="w-full sm:col-span-4 rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-[rgba(var(--overlay-rgb),0.05)] px-3 py-2 text-theme-primary placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            placeholder="email@exemple.com"
                        />
                        <div className="relative w-full sm:col-span-3">
                            <input
                                type={showNewUserPassword ? "text" : "password"}
                                aria-label="Mot de passe initial"
                                autoComplete="new-password"
                                value={newUserPassword}
                                onChange={(e) => setNewUserPassword(e.target.value)}
                                className="w-full rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-[rgba(var(--overlay-rgb),0.05)] py-2 pl-3 pr-10 text-theme-primary placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                placeholder={`Mot de passe (${MIN_PASSWORD_LENGTH} car. min.)`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewUserPassword(v => !v)}
                                aria-label={showNewUserPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                                className="absolute inset-y-0 right-2 flex items-center text-theme-muted transition hover:text-theme-primary"
                            >
                                {showNewUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        <button
                            onClick={addUser}
                            disabled={creating}
                            className="w-full sm:col-span-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:brightness-110 disabled:opacity-50"
                        >
                            {creating ? "Création..." : "Ajouter"}
                        </button>
                    </div>
                ) : (
                    <p className="mt-2 text-sm text-theme-muted">
                        Seuls les administrateurs peuvent ajouter des utilisateurs.
                    </p>
                )}
            </div>

            {/* L'ajout est persisté par le serveur ; la modification et la suppression passent
                par setUsers (local) et le poll 10s de fetchUsers peut les écraser peu après. */}
            <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                ⚠️ La modification et la suppression d'utilisateurs restent locales et peuvent ne pas persister — fonctionnalité en cours de finalisation.
            </p>

            {/* Boutons d'action */}
            <div className="mt-4 flex justify-end gap-2">
                <button
                    onClick={onClose}
                    className="rounded-2xl border border-[rgba(var(--overlay-rgb),0.2)] px-4 py-2 text-theme-primary transition hover:bg-[rgba(var(--color-primary-rgb),0.6)]"
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
