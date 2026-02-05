import { User, LogIn } from "lucide-react";
import useStore from "../store/useStore";

export function LoginModal() {
  const { users, setCurrentUser } = useStore();

  // Filtrer l'utilisateur "unassigned" pour n'afficher que les vrais utilisateurs
  const realUsers = users.filter(u => u.id !== "unassigned");

  const handleSelectUser = (userId: string) => {
    setCurrentUser(userId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 rounded-full mb-4">
            <User className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Bienvenue sur To-DoX
          </h1>
          <p className="text-slate-400 text-sm">
            Connectez-vous pour accéder à vos tâches
          </p>
        </div>

        {/* Liste des utilisateurs */}
        <div className="space-y-4">
          {realUsers.length > 0 ? (
            <>
              <p className="text-slate-300 text-sm font-medium mb-3">
                Sélectionnez votre profil :
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {realUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user.id)}
                    className="w-full flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500/50 rounded-xl transition-all group"
                  >
                    <div className="flex items-center justify-center w-10 h-10 bg-blue-500/10 rounded-full group-hover:bg-blue-500/20 transition-colors">
                      <User className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-white font-medium">{user.name}</div>
                      {user.email && (
                        <div className="text-slate-400 text-sm">{user.email}</div>
                      )}
                    </div>
                    <LogIn className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-400 mb-4">
                Aucun utilisateur disponible. Contactez l'administrateur.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-slate-500 text-xs">
            To-DoX v2.0.0 - Gestion multi-utilisateurs
          </p>
        </div>
      </div>
    </div>
  );
}
