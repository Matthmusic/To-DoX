import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../services/chatApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/chatApi')>()),
  fetchConversations: vi.fn(async () => []),
  markConversationRead: vi.fn(async () => ({ ok: true, lastReadAt: 1000 })),
  sendMessage: vi.fn(),
}));

import useChatStore, { selectUnreadTotal } from './useChatStore';
import useStore from './useStore';
import * as chatApi from '../services/chatApi';
import { parseSseChunk, type ChatStreamEvent } from '../services/chatApi';
import type { ChatConversation, ChatMessage } from '../types';

const conv = (over: Partial<ChatConversation> = {}): ChatConversation => ({
  id: 'c1', type: 'direct', project: null, participantIds: ['me', 'bob'],
  lastMessageAt: 0, lastReadAt: null, unreadCount: 0, lastMessage: null, ...over,
});
const msg = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1', conversationId: 'c1', userId: 'bob', text: 'salut', taskId: null, createdAt: 10, deletedAt: null, ...over,
});

describe('useChatStore', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
    useStore.setState({ currentUser: 'me', authToken: 'tok' });
  });

  it('compte un message reçu une seule fois, même s\'il revient par le flux', () => {
    useChatStore.setState({ conversations: [conv()], messages: { c1: [] } });
    useChatStore.getState().receiveMessage(msg());
    useChatStore.getState().receiveMessage(msg());
    const s = useChatStore.getState();
    expect(s.messages.c1).toHaveLength(1);
    expect(s.conversations[0].unreadCount).toBe(1);
    expect(selectUnreadTotal(s)).toBe(1);
  });

  it('ne compte pas ses propres messages comme non lus', () => {
    useChatStore.setState({ conversations: [conv()] });
    useChatStore.getState().receiveMessage(msg({ userId: 'me' }));
    expect(useChatStore.getState().conversations[0].unreadCount).toBe(0);
    expect(useChatStore.getState().conversations[0].lastMessage?.text).toBe('salut');
  });

  it('trie les conversations par dernier message', () => {
    useChatStore.setState({ conversations: [conv({ id: 'a', lastMessageAt: 5 }), conv({ id: 'c1', lastMessageAt: 1 })] });
    useChatStore.getState().receiveMessage(msg({ createdAt: 50 }));
    expect(useChatStore.getState().conversations.map((c) => c.id)).toEqual(['c1', 'a']);
  });

  it('recharge la liste quand un message arrive d\'une conversation inconnue', () => {
    useChatStore.getState().receiveMessage(msg({ conversationId: 'nouvelle' }));
    expect(chatApi.fetchConversations).toHaveBeenCalled();
  });

  it('masque le texte d\'un message supprimé', () => {
    useChatStore.setState({ conversations: [conv({ lastMessage: msg() })], messages: { c1: [msg()] } });
    useChatStore.getState().receiveDeletion('c1', 'm1');
    const s = useChatStore.getState();
    expect(s.messages.c1[0].text).toBe('');
    expect(s.messages.c1[0].deletedAt).not.toBeNull();
    expect(s.conversations[0].lastMessage?.text).toBe('');
  });

  it('remet le badge à zéro en marquant lu', async () => {
    useChatStore.setState({ conversations: [conv({ unreadCount: 3 })] });
    await useChatStore.getState().markRead('c1');
    expect(chatApi.markConversationRead).toHaveBeenCalledWith('c1', 'tok');
    expect(useChatStore.getState().conversations[0]).toMatchObject({ unreadCount: 0, lastReadAt: 1000 });
  });
});

describe('parseSseChunk', () => {
  it('découpe les événements, ignore les pings et garde la fin incomplète', () => {
    const events: ChatStreamEvent[] = [];
    const rest = parseSseChunk(
      'event: ready\ndata: {"ok":true}\n\n: ping\n\nevent: read\ndata: {"conversationId":"c1","lastReadAt":5}\n\nevent: mess',
      (e) => events.push(e),
    );
    expect(events.map((e) => e.event)).toEqual(['ready', 'read']);
    expect(rest).toBe('event: mess');
  });
});
