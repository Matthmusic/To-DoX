import { Response } from 'express';
import { EventEmitter } from 'events';

/**
 * Gestionnaire SSE global.
 * Chaque client connecté est stocké avec son userId.
 * Les events sont broadcastés à tous (le frontend filtre les siens).
 */

interface SseClient {
  userId: string;
  res: Response;
}

class SseManager extends EventEmitter {
  private clients: Map<string, SseClient> = new Map();

  /** Retourne le Set des userIds actuellement connectés. */
  get onlineUserIds(): Set<string> {
    const ids = new Set<string>();
    for (const c of this.clients.values()) ids.add(c.userId);
    return ids;
  }

  /** Enregistre un nouveau client SSE. Broadcast user:online si c'est sa 1re connexion. */
  addClient(connectionId: string, userId: string, res: Response): void {
    const wasAlreadyOnline = this.onlineUserIds.has(userId);
    this.clients.set(connectionId, { userId, res });
    if (!wasAlreadyOnline) {
      this.broadcast('user:online', { userId });
    }
  }

  /** Supprime un client SSE. Broadcast user:offline si c'est sa dernière connexion. */
  removeClient(connectionId: string): void {
    const client = this.clients.get(connectionId);
    this.clients.delete(connectionId);
    if (client && !this.onlineUserIds.has(client.userId)) {
      this.broadcast('user:offline', { userId: client.userId });
    }
  }

  /** Envoie un event SSE à tous les clients connectés. */
  broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      try {
        client.res.write(payload);
      } catch {
        // Le client s'est déconnecté entre-temps, ignoré
      }
    }
  }

  get connectedCount(): number {
    return this.clients.size;
  }
}

export const sseManager = new SseManager();
