import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { sseManager } from '../sse/sseManager';

const router = Router();

/**
 * GET /api/events?token=<jwt>
 *
 * Endpoint SSE (Server-Sent Events). EventSource ne supporte pas les headers
 * personnalisés, donc le token JWT est passé en query param.
 */
router.get('/', (req: Request, res: Response): void => {
  const token = req.query.token as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'Token manquant' });
    return;
  }

  let userId: string;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    userId = payload.userId;
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
    return;
  }

  // Headers SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Désactive le buffering nginx si présent
  res.flushHeaders();

  // Event initial de connexion (avant addClient pour capturer la liste avant notre arrivée)
  const connectionId = randomUUID();
  const onlineBefore = Array.from(sseManager.onlineUserIds);
  res.write(`event: connected\ndata: ${JSON.stringify({ connectionId, onlineUsers: onlineBefore })}\n\n`);

  sseManager.addClient(connectionId, userId, res);

  // Keepalive toutes les 30s pour éviter les timeouts réseau/proxy
  const keepalive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepalive);
    }
  }, 30_000);

  req.on('close', () => {
    clearInterval(keepalive);
    sseManager.removeClient(connectionId);
  });
});

export default router;
