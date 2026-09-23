import { useState } from "react";
import { User } from "lucide-react";
import useStore from "../../store/useStore";
import { useShallow } from 'zustand/react/shallow';
import { GlassModal } from "../ui/GlassModal";
import { clearToken, changePassword, ApiError } from "../../services/api";
import { useTheme } from "../../hooks/useTheme";

const MIN_PASSWORD_LENGTH = 8; // doit rester synchro avec la validation serveur (todox-backend/src/routes/auth.ts)

interface AccountPanelProps {
    onClose: () => void;
}

export function AccountPanel({ onClose }: AccountPanelProps) {
    const { localAuthUserId, authToken, setCurrentUser, setLocalAuthUserId, setAuthToken } = useStore(useShallow((s) => ({ localAuthUserId: s.localAuthUserId, authToken: s.authToken, setCurrentUser: s.setCurrentUser, setLocalAuthUserId: s.setLocalAuthUserId, setAuthToken: s.setAuthToken })));
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;

    const [showChangePassword, setShowChangePassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    async function handleLogout() {
        // clearToken prend l'id LOCAL (localAuthUserId), pas currentUser (UUID backend) --
        // saveToken() a écrit le token sous l'id local (voir LoginModal.tsx).
        if (localAuthUserId) await clearToken(localAuthUserId);
        setAuthToken(null);
        setCurrentUser(null);
        setLocalAuthUserId(null);
        onClose();
    }

    function resetPasswordForm() {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
    }

    async function handleSubmitPasswordChange(e: React.FormEvent) {
        e.preventDefault();
        setFormError(null);
        setFormSuccess(false);

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setFormError(`Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
            return;
        }
        if (newPassword !== confirmPassword) {
            setFormError("Les nouveaux mots de passe ne correspondent pas.");
            return;
        }
        if (!authToken) return; // ne devrait pas arriver (panel accessible seulement connecté)

        setSubmitting(true);
        try {
            await changePassword(currentPassword, newPassword, authToken);
            setFormSuccess(true);
            resetPasswordForm();
        } catch (err) {
            setFormError(err instanceof ApiError ? err.message : "Erreur de connexion au serveur");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <GlassModal isOpen={true} onClose={onClose} title={<><User className="w-6 h-6 mr-2" style={{ color: primaryColor }} />Mon compte</>} size="sm">
            <div className="space-y-4">
                <div className="rounded-2xl border border-indigo-400/30 bg-indigo-400/5 p-4">
                    <p className="text-sm text-slate-400">
                        Vous êtes connecté au serveur de l'équipe, vos données sont synchronisées automatiquement.
                    </p>
                </div>

                {!showChangePassword && (
                    <button
                        type="button"
                        onClick={() => { setShowChangePassword(true); setFormError(null); setFormSuccess(false); }}
                        className="text-sm text-slate-400 hover:text-violet-400 transition underline underline-offset-2"
                    >
                        Changer le mot de passe
                    </button>
                )}

                {showChangePassword && (
                    <form onSubmit={handleSubmitPasswordChange} className="space-y-3 rounded-2xl border border-[rgba(var(--overlay-rgb),0.1)] bg-[rgba(var(--overlay-rgb),0.05)] p-4">
                        <div className="space-y-1">
                            <label htmlFor="current-password" className="text-xs text-slate-400">Mot de passe actuel</label>
                            <input
                                id="current-password"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-transparent px-3 py-2 text-sm text-slate-100"
                                autoComplete="current-password"
                            />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="new-password" className="text-xs text-slate-400">Nouveau mot de passe</label>
                            <input
                                id="new-password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-transparent px-3 py-2 text-sm text-slate-100"
                                autoComplete="new-password"
                            />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="confirm-password" className="text-xs text-slate-400">Confirmer le nouveau mot de passe</label>
                            <input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-transparent px-3 py-2 text-sm text-slate-100"
                                autoComplete="new-password"
                            />
                        </div>

                        {formError && <p className="text-xs text-rose-400">{formError}</p>}
                        {formSuccess && <p className="text-xs text-emerald-400">Mot de passe changé avec succès.</p>}

                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { setShowChangePassword(false); resetPasswordForm(); setFormError(null); setFormSuccess(false); }}
                                className="rounded-xl px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="rounded-xl border border-violet-400/40 bg-violet-400/10 px-3 py-1.5 text-sm text-violet-100 transition hover:bg-violet-400/20 disabled:opacity-50"
                            >
                                Valider le changement
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleLogout}
                    className="rounded-2xl border border-[rgba(var(--overlay-rgb),0.2)] bg-[rgba(var(--overlay-rgb),0.05)] px-4 py-2 text-slate-100 transition hover:bg-red-500/20 hover:border-red-500/50"
                >
                    Se déconnecter
                </button>
            </div>
        </GlassModal>
    );
}
