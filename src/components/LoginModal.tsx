import { useState, useEffect, useRef } from "react";
import { LogIn, Lock, ChevronLeft, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useStore from "../store/useStore";
import { useTheme } from "../hooks/useTheme";
import { GlassModal } from "./ui/GlassModal";
import { IS_API_MODE } from "../api/client";
import { apiLogin, apiGetPublicUsers } from "../api/auth";
import type { User } from "../types";

function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

// ── Sélecteur + mot de passe (mode API) ──────────────────────────────────────

function ApiLoginFlow({ primary, secondary }: { primary: string; secondary: string }) {
  const { setCurrentUser, setUsers } = useStore();

  const [apiUsers, setApiUsers]       = useState<Pick<User, 'id' | 'name' | 'email'>[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selected, setSelected]       = useState<Pick<User, 'id' | 'name' | 'email'> | null>(null);
  const [password, setPassword]       = useState('');
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const passwordRef                   = useRef<HTMLInputElement>(null);

  const lastUsedId = localStorage.getItem('last_login_user_id');

  // Charger la liste des users depuis l'API au montage
  useEffect(() => {
    apiGetPublicUsers()
      .then(users => {
        const sorted = [...users].sort((a, b) => {
          if (a.id === lastUsedId) return -1;
          if (b.id === lastUsedId) return 1;
          return a.name.localeCompare(b.name);
        });
        setApiUsers(sorted);
      })
      .catch(() => setApiUsers([]))
      .finally(() => setLoadingUsers(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus automatique sur le champ mot de passe quand un user est sélectionné
  useEffect(() => {
    if (selected) setTimeout(() => passwordRef.current?.focus(), 100);
  }, [selected]);

  function handleSelectUser(user: typeof selected) {
    setSelected(user);
    setPassword('');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !password) return;
    setLoading(true);
    setError(null);
    try {
      const { user } = await apiLogin(selected.email, password);
      localStorage.setItem('last_login_user_id', user.id);
      setUsers(apiUsers.map(u => ({ ...u })));
      setCurrentUser(user.id);
    } catch (err: any) {
      setError(err?.message ?? 'Mot de passe incorrect');
      setPassword('');
      setTimeout(() => passwordRef.current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  }

  // ── Étape 1 : liste des users ────────────────────────────────────────────
  if (!selected) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="user-list"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
        >
          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: `${primary}30`, borderTopColor: primary }} />
            </div>
          ) : apiUsers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-theme-muted text-sm">Impossible de charger les utilisateurs.<br /><span className="text-xs opacity-60">Vérifiez la connexion au serveur.</span></p>
            </div>
          ) : (
            <>
              <p className="text-theme-secondary text-xs font-semibold uppercase tracking-wider mb-3 opacity-60">
                Sélectionnez votre profil
              </p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                {apiUsers.map((user, i) => {
                  const avatarColor = i % 2 === 0 ? primary : secondary;
                  const isLast = user.id === lastUsedId;
                  return (
                    <motion.button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      whileHover={{ scale: 1.02, x: 3 }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors group"
                      style={{
                        borderColor: isLast ? `${primary}55` : 'var(--border-primary)',
                        backgroundColor: isLast ? `${primary}10` : 'rgba(255,255,255,0.04)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = `${primary}55`; e.currentTarget.style.backgroundColor = `${primary}12`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = isLast ? `${primary}55` : 'var(--border-primary)'; e.currentTarget.style.backgroundColor = isLast ? `${primary}10` : 'rgba(255,255,255,0.04)'; }}
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm text-white flex-shrink-0" style={{ backgroundColor: avatarColor }}>
                        {getUserInitials(user.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-theme-primary font-semibold text-sm">{user.name}</span>
                          {isLast && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${primary}25`, color: primary }}>
                              Dernier utilisé
                            </span>
                          )}
                        </div>
                        <div className="text-theme-muted text-xs truncate">{user.email}</div>
                      </div>
                      <LogIn className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: primary }} />
                    </motion.button>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Étape 2 : saisie du mot de passe ────────────────────────────────────
  const avatarColor = apiUsers.findIndex(u => u.id === selected.id) % 2 === 0 ? primary : secondary;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="password-form"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
      >
        {/* User sélectionné (recap) */}
        <div className="flex items-center gap-3 p-3.5 rounded-xl border mb-5" style={{ borderColor: `${primary}55`, backgroundColor: `${primary}10` }}>
          <div className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm text-white flex-shrink-0" style={{ backgroundColor: avatarColor }}>
            {getUserInitials(selected.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-theme-primary font-semibold text-sm">{selected.name}</div>
            <div className="text-theme-muted text-xs truncate">{selected.email}</div>
          </div>
          <button
            onClick={() => { setSelected(null); setError(null); }}
            className="text-theme-muted hover:text-theme-primary transition-colors"
            title="Changer d'utilisateur"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Mot de passe */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-theme-secondary text-xs font-semibold uppercase tracking-wider mb-1.5 block opacity-60">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted opacity-50" />
              <input
                ref={passwordRef}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-transparent text-sm text-theme-primary placeholder-theme-muted focus:outline-none transition-colors"
                style={{ borderColor: 'var(--border-primary)' }}
                onFocus={e => { e.currentTarget.style.borderColor = `${primary}80`; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; }}
              />
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <motion.button
            type="submit"
            disabled={loading || !password}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity disabled:opacity-50"
            style={{ background: `linear-gradient(to right, ${primary}, ${secondary})` }}
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <LogIn className="w-4 h-4" />
            }
            {loading ? 'Connexion…' : 'Se connecter'}
          </motion.button>
        </form>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Sélecteur de profil (mode local) ─────────────────────────────────────────

function LocalUserPicker({ primary, secondary }: { primary: string; secondary: string }) {
  const { users, setCurrentUser } = useStore();
  const lastUsedId = localStorage.getItem('last_login_user_id');

  const realUsers = (() => {
    const filtered = users.filter(u => u.id !== "unassigned");
    if (!lastUsedId) return filtered;
    const last = filtered.find(u => u.id === lastUsedId);
    if (!last) return filtered;
    return [last, ...filtered.filter(u => u.id !== lastUsedId)];
  })();

  if (realUsers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-theme-muted text-sm">
          Aucun utilisateur disponible.<br />
          <span className="text-xs opacity-60">Contactez l'administrateur.</span>
        </p>
      </div>
    );
  }

  return (
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
              onClick={() => { localStorage.setItem('last_login_user_id', user.id); setCurrentUser(user.id); }}
              whileHover={{ scale: 1.02, x: 3 }}
              whileTap={{ scale: 0.97 }}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors group"
              style={{
                borderColor: isLastUsed ? `${primary}55` : 'var(--border-primary)',
                backgroundColor: isLastUsed ? `${primary}10` : 'rgba(255,255,255,0.04)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${primary}55`; e.currentTarget.style.backgroundColor = `${primary}12`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isLastUsed ? `${primary}55` : 'var(--border-primary)'; e.currentTarget.style.backgroundColor = isLastUsed ? `${primary}10` : 'rgba(255,255,255,0.04)'; }}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm text-white flex-shrink-0" style={{ backgroundColor: avatarColor }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-theme-primary font-semibold text-sm">{user.name}</span>
                  {isLastUsed && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${primary}25`, color: primary }}>
                      Dernier utilisé
                    </span>
                  )}
                </div>
                {user.email && <div className="text-theme-muted text-xs truncate">{user.email}</div>}
              </div>
              <LogIn className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: primary }} />
            </motion.button>
          );
        })}
      </div>
    </>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function LoginModal() {
  const { activeTheme } = useTheme();
  const primary   = activeTheme.palette.primary;
  const secondary = activeTheme.palette.secondary;

  return (
    <GlassModal
      isOpen={true}
      onClose={() => {}}
      size="sm"
      showCloseButton={false}
      closeOnBackdrop={false}
    >
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ backgroundColor: `${primary}20`, border: `1.5px solid ${primary}45` }}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8" style={{ color: primary }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold bg-clip-text text-transparent mb-2" style={{ backgroundImage: `linear-gradient(to right, ${primary}, ${secondary})` }}>
          Bienvenue sur To-DoX
        </h1>
        <p className="text-theme-muted text-sm">Connectez-vous pour accéder à vos tâches</p>
      </div>

      {IS_API_MODE
        ? <ApiLoginFlow primary={primary} secondary={secondary} />
        : <LocalUserPicker primary={primary} secondary={secondary} />
      }

      <div className="mt-6 pt-5 border-t border-theme-primary text-center">
        <p className="text-theme-muted text-xs" style={{ opacity: 0.4 }}>
          To-DoX · {IS_API_MODE ? 'Mode connecté' : 'Gestion multi-utilisateurs'}
        </p>
      </div>
    </GlassModal>
  );
}
