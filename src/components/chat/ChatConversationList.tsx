import { useMemo, useState } from 'react';
import { Hash, MessageSquarePlus, Search, WifiOff } from 'lucide-react';
import useStore from '../../store/useStore';
import useChatStore from '../../store/useChatStore';
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from '../../hooks/useTheme';
import { getInitials } from '../../utils';
import { conversationTitle, shortTime, withOpacity } from './chatUtils';

/** Liste des conversations + démarrage d'une nouvelle discussion (personne ou projet). */
export function ChatConversationList() {
  const { users, currentUser, tasks, projectHistory } = useStore(useShallow((s) => ({
    users: s.users, currentUser: s.currentUser, tasks: s.tasks, projectHistory: s.projectHistory,
  })));
  const { conversations, connected, setActiveConversation, openDirect, openProject } = useChatStore(useShallow((s) => ({
    conversations: s.conversations, connected: s.connected,
    setActiveConversation: s.setActiveConversation, openDirect: s.openDirect, openProject: s.openProject,
  })));
  const { activeTheme } = useTheme();
  const { primary, textMuted } = activeTheme.palette;

  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Projets actifs : ceux des tâches non archivées, puis l'historique
  const projects = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) if (!t.archived && !t.deletedAt && t.project) set.add(t.project);
    for (const p of projectHistory) set.add(p);
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [tasks, projectHistory]);

  const q = query.trim().toUpperCase();
  const matchingUsers = q
    ? users.filter((u) => u.id !== currentUser && u.id !== 'unassigned' && u.name.toUpperCase().includes(q))
    : [];
  const matchingProjects = q ? projects.filter((p) => p.includes(q)).slice(0, 8) : [];

  const start = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
      setQuery('');
    } catch {
      setError("Impossible d'ouvrir la discussion");
    }
  };

  const rowStyle = { color: 'rgba(var(--overlay-rgb),0.85)' };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Recherche / nouvelle discussion */}
      <div className="px-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: withOpacity(primary, 0.08), border: `1px solid ${withOpacity(primary, 0.18)}` }}>
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: withOpacity(primary, 0.6) }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Écrire à quelqu'un ou à un projet…"
            aria-label="Rechercher une personne ou un projet"
            className="flex-1 min-w-0 bg-transparent text-[12.5px] outline-none placeholder:opacity-60"
            style={rowStyle}
          />
        </div>
        {!connected && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: textMuted }}>
            <WifiOff className="h-3 w-3" /> Connexion au chat en cours…
          </div>
        )}
        {error && <p className="mt-2 text-[11.5px] text-rose-400">{error}</p>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
        {/* Résultats de recherche */}
        {q && (
          <div className="flex flex-col gap-0.5 mb-3">
            {matchingUsers.map((u) => (
              <button key={u.id} onClick={() => start(() => openDirect(u.id))}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-[rgba(var(--overlay-rgb),0.06)]" style={rowStyle}>
                <Avatar label={getInitials(u.name)} primary={primary} />
                <span className="truncate">{u.name}</span>
              </button>
            ))}
            {matchingProjects.map((p) => (
              <button key={p} onClick={() => start(() => openProject(p))}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-[rgba(var(--overlay-rgb),0.06)]" style={rowStyle}>
                <Avatar label={<Hash className="h-3.5 w-3.5" />} primary={primary} />
                <span className="truncate">Salon {p}</span>
              </button>
            ))}
            {matchingUsers.length === 0 && matchingProjects.length === 0 && (
              <p className="px-3 py-2 text-[12px]" style={{ color: textMuted }}>Aucune personne ni projet trouvé</p>
            )}
          </div>
        )}

        {/* Conversations existantes */}
        {!q && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
            <MessageSquarePlus className="h-8 w-8" style={{ color: withOpacity(primary, 0.3) }} />
            <span className="text-xs tracking-wide" style={{ color: textMuted }}>
              Aucune discussion. Cherchez une personne ou un projet ci-dessus pour commencer.
            </span>
          </div>
        )}
        {!q && conversations.map((c) => {
          const title = conversationTitle(c, users, currentUser);
          const author = c.lastMessage ? users.find((u) => u.id === c.lastMessage?.userId)?.name : null;
          const preview = !c.lastMessage
            ? 'Aucun message'
            : c.lastMessage.deletedAt
              ? 'Message supprimé'
              : `${c.lastMessage.userId === currentUser ? 'Vous' : (author?.split(' ')[0] ?? '')} : ${c.lastMessage.text}`;
          const unread = c.unreadCount > 0;
          return (
            <button key={c.id} onClick={() => setActiveConversation(c.id)}
              className="w-full flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[rgba(var(--overlay-rgb),0.06)]"
              style={{ background: unread ? withOpacity(primary, 0.06) : undefined }}>
              <Avatar label={c.type === 'project' ? <Hash className="h-3.5 w-3.5" /> : getInitials(title)} primary={primary} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={`truncate text-[12.5px] ${unread ? 'font-bold' : 'font-semibold'}`} style={rowStyle}>{title}</span>
                  {c.lastMessage && <span className="ml-auto shrink-0 text-[10.5px]" style={{ color: textMuted }}>{shortTime(c.lastMessage.createdAt)}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="truncate text-[12px]" style={{ color: unread ? 'rgba(var(--overlay-rgb),0.75)' : textMuted }}>{preview}</span>
                  {unread && (
                    <span className="ml-auto shrink-0 flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[9px] font-black text-white px-1"
                      style={{ backgroundColor: primary }}>
                      {c.unreadCount > 99 ? '99+' : c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Avatar({ label, primary }: { label: React.ReactNode; primary: string }) {
  return (
    <div className="shrink-0 h-8 w-8 rounded-xl flex items-center justify-center text-[11px] font-black"
      style={{ background: withOpacity(primary, 0.12), color: primary, boxShadow: `inset 0 0 0 1px ${withOpacity(primary, 0.25)}` }}>
      {label}
    </div>
  );
}
