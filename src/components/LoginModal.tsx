import { LogIn } from "lucide-react";
import { motion } from "framer-motion";
import useStore from "../store/useStore";
import { useTheme } from "../hooks/useTheme";
import { GlassModal } from "./ui/GlassModal";

function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export function LoginModal() {
  const { users, setCurrentUser } = useStore();
  const { activeTheme } = useTheme();
  const primary   = activeTheme.palette.primary;
  const secondary = activeTheme.palette.secondary;

  const realUsers = users.filter(u => u.id !== "unassigned");

  return (
    <GlassModal
      isOpen={true}
      onClose={() => {}}
      size="sm"
      showCloseButton={false}
      closeOnBackdrop={false}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ backgroundColor: `${primary}20`, border: `1.5px solid ${primary}45` }}
        >
          <svg
            viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor"
            className="w-8 h-8"
            style={{ color: primary }}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        </div>
        <h1
          className="text-2xl font-bold bg-clip-text text-transparent mb-2"
          style={{ backgroundImage: `linear-gradient(to right, ${primary}, ${secondary})` }}
        >
          Bienvenue sur To-DoX
        </h1>
        <p className="text-theme-muted text-sm">
          Connectez-vous pour accéder à vos tâches
        </p>
      </div>

      {/* Liste utilisateurs */}
      <div>
        {realUsers.length > 0 ? (
          <>
            <p className="text-theme-secondary text-xs font-semibold uppercase tracking-wider mb-3 opacity-60">
              Sélectionnez votre profil
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
              {realUsers.map((user, i) => {
                const avatarColor = i % 2 === 0 ? primary : secondary;
                const initials = getUserInitials(user.name);
                return (
                  <motion.button
                    key={user.id}
                    onClick={() => setCurrentUser(user.id)}
                    whileHover={{ scale: 1.02, x: 3 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors group"
                    style={{
                      borderColor: 'var(--border-primary)',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = `${primary}55`;
                      e.currentTarget.style.backgroundColor = `${primary}12`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border-primary)';
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm text-white flex-shrink-0"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {initials}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <div className="text-theme-primary font-semibold text-sm">{user.name}</div>
                      {user.email && (
                        <div className="text-theme-muted text-xs truncate">{user.email}</div>
                      )}
                    </div>

                    {/* Icône */}
                    <LogIn
                      className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: primary }}
                    />
                  </motion.button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-theme-muted text-sm">
              Aucun utilisateur disponible.<br />
              <span className="text-xs opacity-60">Contactez l'administrateur.</span>
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-5 border-t border-theme-primary text-center">
        <p className="text-theme-muted text-xs" style={{ opacity: 0.4 }}>
          To-DoX · Gestion multi-utilisateurs
        </p>
      </div>
    </GlassModal>
  );
}
