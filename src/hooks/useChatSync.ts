import { useEffect } from 'react';
import useStore from '../store/useStore';
import useChatStore from '../store/useChatStore';
import useActivityStore from '../store/useActivityStore';
import { openChatStream, type ChatStreamEvent } from '../services/chatApi';
import { playSoundFile } from '../utils/sound';
import type { ChatMessage } from '../types';

// Délais de reconnexion du flux temps réel
const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 30_000;
// Backend pas encore mis à jour (route absente) : on réessaie de temps en temps
const RETRY_UNAVAILABLE_MS = 5 * 60_000;

/** Notification bureau pour un message reçu, si l'utilisateur ne le voit pas déjà à l'écran. */
function notifyIfHidden(message: ChatMessage) {
  const { currentUser, users, notificationSettings } = useStore.getState();
  if (message.userId === currentUser || message.deletedAt) return;
  const chat = useChatStore.getState();
  const isOnScreen = document.hasFocus() && chat.visible && chat.activeConversationId === message.conversationId;
  if (isOnScreen) return;
  if (localStorage.getItem('todox_notif_enabled') === 'false') return;

  const author = users.find((u) => u.id === message.userId)?.name ?? 'Nouveau message';
  const conv = chat.conversations.find((c) => c.id === message.conversationId);
  const title = conv?.type === 'project' && conv.project ? `${author} · ${conv.project}` : author;
  const body = message.text.length > 140 ? `${message.text.slice(0, 140)}…` : message.text;
  window.electronAPI?.sendNotification(title, body, `chat-${message.conversationId}`);
  if (notificationSettings.sound && notificationSettings.soundFile) {
    playSoundFile(notificationSettings.soundFile).catch(() => {});
  }
}

function handleEvent(e: ChatStreamEvent) {
  const chat = useChatStore.getState();
  switch (e.event) {
    case 'ready': {
      chat.setAvailable(true);
      chat.setConnected(true);
      // Rattrapage après une (re)connexion : liste + conversation affichée
      chat.loadConversations().catch(() => {});
      if (chat.activeConversationId) chat.loadMessages(chat.activeConversationId).catch(() => {});
      useActivityStore.getState().load().catch(() => {});
      break;
    }
    case 'message': {
      const known = chat.conversations.some((c) => c.id === e.data.message.conversationId);
      chat.receiveMessage(e.data.message);
      if (known) notifyIfHidden(e.data.message);
      break;
    }
    case 'message_deleted':
      chat.receiveDeletion(e.data.conversationId, e.data.messageId);
      break;
    case 'read':
      chat.receiveRead(e.data.conversationId, e.data.lastReadAt);
      break;
    case 'activity':
      useActivityStore.getState().receive(e.data.activity);
      break;
  }
}

/**
 * Garde ouvert le flux temps réel de la messagerie tant qu'un utilisateur est connecté,
 * et le rouvre automatiquement en cas de coupure.
 */
export function useChatSync() {
  const authToken = useStore((s) => s.authToken);

  useEffect(() => {
    if (!authToken) {
      useChatStore.getState().reset();
      useActivityStore.getState().reset();
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delay = RETRY_MIN_MS;

    const connect = async () => {
      try {
        await openChatStream(authToken, (e) => {
          if (e.event === 'ready') delay = RETRY_MIN_MS;
          handleEvent(e);
        }, controller.signal);
      } catch (err) {
        if (controller.signal.aborted) return;
        const status = (err as { status?: number }).status;
        if (status === 401) return; // jeton expiré : useApiSync renvoie à l'écran de connexion
        if (status === 404) {
          useChatStore.getState().setAvailable(false);
          timer = setTimeout(connect, RETRY_UNAVAILABLE_MS);
          return;
        }
      }
      if (controller.signal.aborted) return;
      useChatStore.getState().setConnected(false);
      timer = setTimeout(connect, delay);
      delay = Math.min(delay * 2, RETRY_MAX_MS);
    };
    connect();

    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
      useChatStore.getState().setConnected(false);
    };
  }, [authToken]);
}
