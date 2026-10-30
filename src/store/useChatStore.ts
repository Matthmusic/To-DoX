import { create } from 'zustand';
import type { ChatConversation, ChatMessage } from '../types';
import * as chatApi from '../services/chatApi';
import useStore from './useStore';

/**
 * État de la messagerie instantanée, séparé du store principal (useStore) : il n'est
 * ni persisté ni synchronisé par useApiSync -- il vit au rythme du flux temps réel
 * (voir hooks/useChatSync.ts).
 */
interface ChatState {
  /** null = pas encore connu ; false = backend sans messagerie (pas encore mis à jour) */
  available: boolean | null;
  connected: boolean;
  conversations: ChatConversation[];
  /** Messages chargés, par conversation (ordre chronologique) */
  messages: Record<string, ChatMessage[]>;
  /** Conversation affichée (null = liste des conversations) */
  activeConversationId: string | null;
  /** Plus d'historique à charger, par conversation */
  hasMore: Record<string, boolean>;
  /** Le panneau de chat est ouvert à l'écran */
  visible: boolean;

  setAvailable: (available: boolean) => void;
  setConnected: (connected: boolean) => void;
  setVisible: (visible: boolean) => void;
  reset: () => void;

  loadConversations: () => Promise<void>;
  openDirect: (userId: string) => Promise<void>;
  openProject: (project: string) => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  loadMessages: (conversationId: string) => Promise<void>;
  loadOlderMessages: (conversationId: string) => Promise<void>;
  send: (conversationId: string, text: string, taskId?: string | null) => Promise<void>;
  remove: (messageId: string) => Promise<void>;
  markRead: (conversationId: string) => Promise<void>;

  /** Événements du flux temps réel */
  receiveMessage: (message: ChatMessage) => void;
  receiveDeletion: (conversationId: string, messageId: string) => void;
  receiveRead: (conversationId: string, lastReadAt: number) => void;
}

const PAGE_SIZE = 50;

function token(): string {
  const t = useStore.getState().authToken;
  if (!t) throw new Error('Non connecté');
  return t;
}

function me(): string | null {
  return useStore.getState().currentUser;
}

/** Ajoute un message à une liste triée, sans doublon (le message envoyé revient aussi par le flux). */
function upsertMessage(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  const existing = list.findIndex((m) => m.id === message.id);
  if (existing >= 0) {
    const next = [...list];
    next[existing] = message;
    return next;
  }
  return [...list, message].sort((a, b) => a.createdAt - b.createdAt);
}

function sortConversations(list: ChatConversation[]): ChatConversation[] {
  return [...list].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

function upsertConversation(list: ChatConversation[], conv: ChatConversation): ChatConversation[] {
  return sortConversations([...list.filter((c) => c.id !== conv.id), conv]);
}

const initialState = {
  available: null,
  connected: false,
  conversations: [],
  messages: {},
  activeConversationId: null,
  hasMore: {},
  visible: false,
};

const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,

  setAvailable: (available) => set({ available }),
  setConnected: (connected) => set({ connected }),
  setVisible: (visible) => set({ visible }),
  reset: () => set(initialState),

  loadConversations: async () => {
    const conversations = await chatApi.fetchConversations(token());
    set({ conversations: sortConversations(conversations) });
  },

  openDirect: async (userId) => {
    const conv = await chatApi.openDirectConversation(userId, token());
    set((s) => ({ conversations: upsertConversation(s.conversations, conv), activeConversationId: conv.id }));
  },

  openProject: async (project) => {
    const conv = await chatApi.openProjectConversation(project, token());
    set((s) => ({ conversations: upsertConversation(s.conversations, conv), activeConversationId: conv.id }));
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  loadMessages: async (conversationId) => {
    const list = await chatApi.fetchMessages(conversationId, token());
    set((s) => ({
      messages: { ...s.messages, [conversationId]: list },
      hasMore: { ...s.hasMore, [conversationId]: list.length >= PAGE_SIZE },
    }));
  },

  loadOlderMessages: async (conversationId) => {
    const current = get().messages[conversationId] ?? [];
    if (current.length === 0) return;
    const older = await chatApi.fetchMessages(conversationId, token(), current[0].createdAt);
    set((s) => ({
      messages: { ...s.messages, [conversationId]: [...older, ...(s.messages[conversationId] ?? [])] },
      hasMore: { ...s.hasMore, [conversationId]: older.length >= PAGE_SIZE },
    }));
  },

  send: async (conversationId, text, taskId = null) => {
    const message = await chatApi.sendMessage(conversationId, text, taskId, token());
    get().receiveMessage(message);
  },

  remove: async (messageId) => {
    await chatApi.deleteMessage(messageId, token());
  },

  markRead: async (conversationId) => {
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (!conv || conv.unreadCount === 0) return;
    // Mise à jour immédiate du badge, puis confirmation serveur
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
    }));
    const { lastReadAt } = await chatApi.markConversationRead(conversationId, token());
    get().receiveRead(conversationId, lastReadAt);
  },

  receiveMessage: (message) => {
    const { conversations, messages } = get();
    const conv = conversations.find((c) => c.id === message.conversationId);
    if (!conv) {
      // Nouvelle conversation (quelqu'un nous écrit pour la première fois) : on recharge la liste.
      get().loadConversations().catch(() => {});
      return;
    }
    const alreadyKnown = (messages[conv.id] ?? []).some((m) => m.id === message.id)
      || conv.lastMessage?.id === message.id;
    const fromOther = message.userId !== me();
    const updated: ChatConversation = {
      ...conv,
      lastMessage: message,
      lastMessageAt: Math.max(conv.lastMessageAt, message.createdAt),
      // Compté comme non lu même si la conversation est affichée : c'est la vue
      // (ChatThread) qui le marque lu côté serveur quand elle est réellement visible.
      unreadCount: conv.unreadCount + (fromOther && !alreadyKnown ? 1 : 0),
    };
    set((s) => ({
      conversations: upsertConversation(s.conversations, updated),
      // On n'ajoute qu'aux conversations dont l'historique est déjà chargé
      messages: s.messages[conv.id]
        ? { ...s.messages, [conv.id]: upsertMessage(s.messages[conv.id], message) }
        : s.messages,
    }));
  },

  receiveDeletion: (conversationId, messageId) => {
    const markDeleted = (m: ChatMessage): ChatMessage =>
      m.id === messageId ? { ...m, text: '', deletedAt: m.deletedAt ?? Date.now() } : m;
    set((s) => ({
      messages: s.messages[conversationId]
        ? { ...s.messages, [conversationId]: s.messages[conversationId].map(markDeleted) }
        : s.messages,
      conversations: s.conversations.map((c) =>
        c.id === conversationId && c.lastMessage ? { ...c, lastMessage: markDeleted(c.lastMessage) } : c,
      ),
    }));
  },

  receiveRead: (conversationId, lastReadAt) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, lastReadAt, unreadCount: 0 } : c,
      ),
    }));
  },
}));

/** Total des messages non lus (badge). */
export function selectUnreadTotal(s: ChatState): number {
  return s.conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}

export default useChatStore;
