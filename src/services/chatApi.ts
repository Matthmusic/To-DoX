import { apiGet, apiPost, apiDelete, getApiBaseUrl } from './api';
import type { ActivityLog, ChatConversation, ChatMessage } from '../types';

// Client de la messagerie (backend : todox-backend/src/routes/chat.ts).

export const fetchConversations = (token: string) =>
  apiGet<ChatConversation[]>('/api/chat/conversations', token);

export const openDirectConversation = (userId: string, token: string) =>
  apiPost<ChatConversation>('/api/chat/conversations/direct', { userId }, token);

export const openProjectConversation = (project: string, token: string) =>
  apiPost<ChatConversation>('/api/chat/conversations/project', { project }, token);

export function fetchMessages(conversationId: string, token: string, before?: number): Promise<ChatMessage[]> {
  const query = before ? `?before=${before}` : '';
  return apiGet<ChatMessage[]>(`/api/chat/conversations/${conversationId}/messages${query}`, token);
}

export const sendMessage = (conversationId: string, text: string, taskId: string | null, token: string) =>
  apiPost<ChatMessage>(`/api/chat/conversations/${conversationId}/messages`, { text, taskId }, token);

export const markConversationRead = (conversationId: string, token: string) =>
  apiPost<{ ok: true; lastReadAt: number }>(`/api/chat/conversations/${conversationId}/read`, {}, token);

export const deleteMessage = (messageId: string, token: string) =>
  apiDelete(`/api/chat/messages/${messageId}`, token);

// ── Flux temps réel (Server-Sent Events) ────────────────────────────────────

export type ChatStreamEvent =
  | { event: 'ready'; data: { ok: true } }
  | { event: 'message'; data: { message: ChatMessage } }
  | { event: 'message_deleted'; data: { conversationId: string; messageId: string } }
  | { event: 'read'; data: { conversationId: string; lastReadAt: number } }
  | { event: 'activity'; data: { activity: ActivityLog } };

/** Découpe un flux SSE en événements ; renvoie le reste non terminé du tampon. */
export function parseSseChunk(buffer: string, onEvent: (e: ChatStreamEvent) => void): string {
  let idx: number;
  while ((idx = buffer.indexOf('\n\n')) >= 0) {
    const block = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 2);
    let event = '';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7);
      else if (line.startsWith('data: ')) data += line.slice(6);
    }
    if (!event || !data) continue; // commentaire « : ping » ou bloc incomplet
    try {
      onEvent({ event, data: JSON.parse(data) } as ChatStreamEvent);
    } catch {
      /* événement illisible : ignoré */
    }
  }
  return buffer;
}

/**
 * Ouvre le flux temps réel. On utilise fetch() plutôt qu'EventSource, qui ne permet pas
 * d'envoyer l'en-tête Authorization (il faudrait mettre le jeton dans l'URL).
 * La promesse se résout quand le flux se ferme (coupure réseau, serveur redémarré...) ;
 * elle est rejetée si la connexion échoue. 401 -> ApiError-like { status: 401 }.
 */
export async function openChatStream(
  token: string,
  onEvent: (e: ChatStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/chat/stream`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
    signal,
  });
  if (!res.ok || !res.body) {
    throw Object.assign(new Error(`Flux de messagerie indisponible (${res.status})`), { status: res.status });
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer = parseSseChunk(buffer + decoder.decode(value, { stream: true }), onEvent);
  }
}
