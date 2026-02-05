import { LogOut, User } from "lucide-react";
import useStore from "../store/useStore";
import { confirmModal } from "../utils/confirm";

export function UserProfile() {
  const { users, currentUser, setCurrentUser } = useStore();

  const currentUserObj = users.find(u => u.id === currentUser);

  if (!currentUserObj || currentUserObj.id === "unassigned") {
    return null;
  }

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
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-6 h-6 bg-blue-500/20 rounded-full">
          <User className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <span className="text-sm text-slate-300 font-medium">
          {currentUserObj.name}
        </span>
      </div>
      <button
        onClick={handleLogout}
        className="p-1 hover:bg-slate-700 rounded transition-colors"
        title="Se déconnecter"
      >
        <LogOut className="w-4 h-4 text-slate-400 hover:text-red-400" />
      </button>
    </div>
  );
}
