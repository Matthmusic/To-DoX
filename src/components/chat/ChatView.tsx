import { useEffect } from 'react';
import useChatStore from '../../store/useChatStore';
import { ChatConversationList } from './ChatConversationList';
import { ChatThread } from './ChatThread';

interface ChatViewProps {
  /** Ouvre une tâche liée (et referme le panneau) */
  onOpenTask: (taskId: string) => void;
}

/** Onglet « Chat » du panneau latéral : liste des discussions ou conversation ouverte. */
export function ChatView({ onOpenTask }: ChatViewProps) {
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setVisible = useChatStore((s) => s.setVisible);

  // Sert à savoir si un message arrivant est vu à l'écran (notifications, non-lus)
  useEffect(() => {
    setVisible(true);
    return () => setVisible(false);
  }, [setVisible]);

  return activeConversationId
    ? <ChatThread key={activeConversationId} conversationId={activeConversationId} onOpenTask={onOpenTask} />
    : <ChatConversationList />;
}
