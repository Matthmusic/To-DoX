import { LogOut } from "lucide-react";
import useStore from "../store/useStore";
import { confirmModal } from "../utils/confirm";
import { useTheme } from "../hooks/useTheme";

function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export function UserProfile() {
  const { users, currentUser, setCurrentUser } = useStore();
  const { activeTheme } = useTheme();
  const primary = activeTheme.palette.primary;

  const currentUserObj = users.find(u => u.id === currentUser);

  if (!currentUserObj || currentUserObj.id === "unassigned") {
    return null;
  }

  const initials = getUserInitials(currentUserObj.name);
  const firstName = currentUserObj.name.split(' ')[0];

  const handleLogout = async () => {
    const confirmed = await confirmModal(
      `Voulez-vous vraiment vous déconnecter ?\n\nVous devrez vous reconnecter au prochain lancement.`
    );
    if (confirmed) {
      setCurrentUser(null);
      localStorage.removeItem('current_user_id');
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all"
      style={{
        borderColor: `${primary}35`,
        backgroundColor: `${primary}10`,
      }}
    >
      {/* Avatar + nom */}
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white flex-shrink-0"
          style={{ backgroundColor: primary }}
        >
          {initials}
        </div>
        <span className="text-sm font-semibold text-theme-primary">
          {firstName}
        </span>
      </div>

      {/* Bouton déconnexion */}
      <button
        onClick={handleLogout}
        className="p-1 rounded-lg transition-colors text-theme-muted hover:text-red-400 hover:bg-red-500/10"
        title="Se déconnecter"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
