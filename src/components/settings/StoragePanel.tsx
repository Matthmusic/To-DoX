import { User } from "lucide-react";
import useStore from "../../store/useStore";
import { GlassModal } from "../ui/GlassModal";
import { clearToken } from "../../services/api";
import { useTheme } from "../../hooks/useTheme";

interface StoragePanelProps {
    onClose: () => void;
}

export function StoragePanel({ onClose }: StoragePanelProps) {
    const { localAuthUserId, setCurrentUser, setLocalAuthUserId, setAuthToken } = useStore();
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;

    async function handleLogout() {
        // clearToken prend l'id LOCAL (localAuthUserId), pas currentUser (UUID backend) --
        // saveToken() a écrit le token sous l'id local (voir LoginModal.tsx).
        if (localAuthUserId) await clearToken(localAuthUserId);
        setAuthToken(null);
        setCurrentUser(null);
        setLocalAuthUserId(null);
        onClose();
    }

    return (
        <GlassModal isOpen={true} onClose={onClose} title={<><User className="w-6 h-6 mr-2" style={{ color: primaryColor }} />Compte</>} size="sm">
            <div className="space-y-4">
                <div className="rounded-2xl border border-indigo-400/30 bg-indigo-400/5 p-4">
                    <p className="text-sm text-slate-400">
                        Vous êtes connecté au serveur de l'équipe, vos données sont synchronisées automatiquement.
                    </p>
                </div>
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleLogout}
                    className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-slate-100 transition hover:bg-red-500/20 hover:border-red-500/50"
                >
                    Se déconnecter
                </button>
            </div>
        </GlassModal>
    );
}
