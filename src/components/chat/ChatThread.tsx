import { useEffect, useLayoutEffect, useRef } from 'react';
import { ArrowLeft, Hash } from 'lucide-react';
import useStore from '../../store/useStore';
import useChatStore from '../../store/useChatStore';
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from '../../hooks/useTheme';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatComposer } from './ChatComposer';
import { conversationTitle, dayLabel, withOpacity } from './chatUtils';

// Deux messages du même auteur à moins de 5 min d'écart sont regroupés (nom affiché une fois)
const GROUP_WINDOW_MS = 5 * 60_000;

interface ChatThreadProps {
  conversationId: string;
  onOpenTask: (taskId: string) => void;
}

export function ChatThread({ conversationId, onOpenTask }: ChatThreadProps) {
  const { users, currentUser } = useStore(useShallow((s) => ({ users: s.users, currentUser: s.currentUser })));
  const { conv, messages, hasMore, visible, setActiveConversation, loadMessages, loadOlderMessages, send, markRead } = useChatStore(useShallow((s) => ({
    conv: s.conversations.find((c) => c.id === conversationId),
    messages: s.messages[conversationId],
    hasMore: s.hasMore[conversationId] ?? false,
    visible: s.visible,
    setActiveConversation: s.setActiveConversation,
    loadMessages: s.loadMessages,
    loadOlderMessages: s.loadOlderMessages,
    send: s.send,
    markRead: s.markRead,
  })));
  const { activeTheme } = useTheme();
  const { primary, textMuted } = activeTheme.palette;

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const prevHeightRef = useRef<number | null>(null);

  // Chargement initial de l'historique
  useEffect(() => {
    if (!messages) loadMessages(conversationId).catch(() => {});
  }, [conversationId, messages, loadMessages]);

  // Marquer comme lu quand la conversation est réellement visible
  const unread = conv?.unreadCount ?? 0;
  useEffect(() => {
    if (!visible || unread === 0) return;
    const mark = () => { if (document.hasFocus()) markRead(conversationId).catch(() => {}); };
    mark();
    window.addEventListener('focus', mark);
    return () => window.removeEventListener('focus', mark);
  }, [visible, unread, conversationId, markRead]);

  // Défilement : reste collé en bas pour les nouveaux messages, garde la position quand on charge l'historique
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevHeightRef.current !== null) {
      el.scrollTop = el.scrollHeight - prevHeightRef.current;
      prevHeightRef.current = null;
    } else if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const handleLoadOlder = () => {
    prevHeightRef.current = scrollRef.current?.scrollHeight ?? null;
    loadOlderMessages(conversationId).catch(() => { prevHeightRef.current = null; });
  };

  if (!conv) return null;
  const title = conversationTitle(conv, users, currentUser);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 pb-2 shrink-0">
        <button onClick={() => setActiveConversation(null)} aria-label="Retour aux discussions" title="Retour"
          className="p-1.5 rounded-lg transition-colors hover:bg-[rgba(var(--overlay-rgb),0.08)]" style={{ color: primary }}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        {conv.type === 'project' && <Hash className="h-4 w-4 shrink-0" style={{ color: primary }} />}
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold" style={{ color: 'rgba(var(--overlay-rgb),0.9)' }}>
            {conv.type === 'project' ? conv.project : title}
          </div>
          {conv.type === 'project' && <div className="text-[10.5px]" style={{ color: textMuted }}>Salon du projet · visible par toute l'équipe</div>}
        </div>
      </div>
      <div className="mx-3 h-px shrink-0" style={{ background: withOpacity(primary, 0.15) }} />

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto py-2">
        {hasMore && (
          <div className="flex justify-center py-1">
            <button onClick={handleLoadOlder} className="text-[11.5px] hover:underline" style={{ color: primary }}>Messages précédents</button>
          </div>
        )}
        {!messages && <p className="text-center text-[12px] py-8" style={{ color: textMuted }}>Chargement…</p>}
        {messages?.length === 0 && (
          <p className="text-center text-[12px] py-8 px-6" style={{ color: textMuted }}>
            Aucun message pour l'instant. Écrivez le premier !
          </p>
        )}
        {messages?.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          const showAuthor = newDay || !prev || prev.userId !== m.userId || m.createdAt - prev.createdAt > GROUP_WINDOW_MS;
          return (
            <div key={m.id}>
              {newDay && (
                <div className="flex justify-center pt-3 pb-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>{dayLabel(m.createdAt)}</span>
                </div>
              )}
              <ChatMessageItem message={m} showAuthor={showAuthor} defaultProject={conv.project ?? ''} onOpenTask={onOpenTask} />
            </div>
          );
        })}
      </div>

      <ChatComposer project={conv.project} onSend={(text, taskId) => {
        stickToBottomRef.current = true;
        return send(conversationId, text, taskId);
      }} />
    </div>
  );
}
