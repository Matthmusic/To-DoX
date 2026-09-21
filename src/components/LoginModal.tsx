import { useState } from 'react';
import { LogIn } from "lucide-react";
import { motion } from "framer-motion";
import useStore from "../store/useStore";
import { useTheme } from "../hooks/useTheme";
import { GlassModal } from "./ui/GlassModal";
import { login, getToken, saveToken, clearToken, apiGet, ApiError } from "../services/api";

function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export function LoginModal() {
  const { users, setCurrentUser, setAuthToken, setAuthError, authError } = useStore();
  const { activeTheme } = useTheme();
  const primary   = activeTheme.palette.primary;
  const secondary = activeTheme.palette.secondary;

  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const lastUsedId = localStorage.getItem('last_login_user_id');

  const realUsers = (() => {
    const filtered = users.filter(u => u.id !== "unassigned");
    if (!lastUsedId) return filtered;
    const last = filtered.find(u => u.id === lastUsedId);
    if (!last) return filtered;
    return [last, ...filtered.filter(u => u.id !== lastUsedId)];
  })();

  async function handlePickUser(userId: string) {
    setAuthError(null);
    const existingToken = await getToken(userId);
    if (existingToken) {
      // Le token stocké est indexé par l'id local (FIXED_USERS), mais currentUser doit
      // porter l'UUID réel du backend (cf handleSubmitPassword) -- on le résout via
      // /api/auth/me. Si le token est périmé/révoqué, on le purge et on retombe sur le
      // prompt mot de passe, comme pour un utilisateur sans session stockée.
      try {
        const { user: backendUser } = await apiGet<{ user: { id: string; email: string; name: string; role: string } }>('/api/auth/me', existingToken);
        localStorage.setItem('last_login_user_id', userId);
        setAuthToken(existingToken);
        setCurrentUser(backendUser.id);
        return;
      } catch {
        await clearToken(userId);
      }
    }
    setPendingUserId(userId);
  }

  async function handleSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingUserId) return;
    const user = users.find(u => u.id === pendingUserId);
    if (!user) return;

    setSubmitting(true);
    setAuthError(null);
    try {
      // `user` (fermeture) est l'entrée locale FIXED_USERS ; `backendUser` est la réponse
      // réelle du serveur -- son `.id` est l'UUID minté par le backend, distinct de l'id
      // local. saveToken() reste indexé par l'id local (voir handlePickUser), mais
      // currentUser doit porter l'UUID réel (cf root cause du bug).
      const { token, user: backendUser } = await login(user.email, password);
      await saveToken(pendingUserId, token);
      localStorage.setItem('last_login_user_id', pendingUserId);
      setAuthToken(token);
      setCurrentUser(backendUser.id);
      setPendingUserId(null);
      setPassword('');
    } catch (e) {
      setAuthError(e instanceof ApiError ? e.message : 'Erreur de connexion au serveur');
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingUserId) {
    const user = users.find(u => u.id === pendingUserId);
    return (
      <GlassModal isOpen={true} onClose={() => {}} size="sm" showCloseButton={false} closeOnBackdrop={false}>
        <form onSubmit={handleSubmitPassword} className="text-center">
          <h1 className="text-xl font-bold mb-2">{user?.name}</h1>
          <p className="text-theme-muted text-sm mb-6">Entrez votre mot de passe</p>
          <input
            type="password"
            autoFocus
            placeholder="Mot de passe"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl border mb-3 bg-transparent text-theme-primary"
            style={{ borderColor: 'var(--border-primary)' }}
          />
          {authError && <p className="text-red-400 text-xs mb-3">{authError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setPendingUserId(null); setPassword(''); setAuthError(null); }}
              className="flex-1 p-2.5 rounded-xl border text-theme-secondary"
            >
              Retour
            </button>
            <button
              type="submit"
              disabled={submitting || !password}
              className="flex-1 p-2.5 rounded-xl text-white font-semibold disabled:opacity-50"
              style={{ backgroundColor: primary }}
            >
              Se connecter
            </button>
          </div>
        </form>
      </GlassModal>
    );
  }

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
                const isLastUsed = user.id === lastUsedId;
                return (
                  <motion.button
                    key={user.id}
                    onClick={() => handlePickUser(user.id)}
                    whileHover={{ scale: 1.02, x: 3 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors group"
                    style={{
                      borderColor: isLastUsed ? `${primary}55` : 'var(--border-primary)',
                      backgroundColor: isLastUsed ? `${primary}10` : 'rgba(255,255,255,0.04)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = `${primary}55`;
                      e.currentTarget.style.backgroundColor = `${primary}12`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = isLastUsed ? `${primary}55` : 'var(--border-primary)';
                      e.currentTarget.style.backgroundColor = isLastUsed ? `${primary}10` : 'rgba(255,255,255,0.04)';
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
                      <div className="flex items-center gap-2">
                        <span className="text-theme-primary font-semibold text-sm">{user.name}</span>
                        {isLastUsed && (
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: `${primary}25`, color: primary }}
                          >
                            Dernier utilisé
                          </span>
                        )}
                      </div>
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
