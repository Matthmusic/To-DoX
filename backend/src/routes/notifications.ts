import { Router, Response } from 'express';
import prisma from '../db/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sseManager } from '../sse/sseManager';

const router = Router();
router.use(requireAuth);

// GET /api/notifications — notifications reçues par l'utilisateur courant
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const notifications = await prisma.appNotification.findMany({
    where: {
      toUserId: req.userId!,
      NOT: { deletedBy: { has: req.userId! } },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json(notifications);
});

// POST /api/notifications — client fournit toujours un id (upsert idempotent)
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { id, type, taskId, taskTitle, fromUserId, toUserId, message, createdAt } = req.body;
  if (!id || !type || !taskId || !toUserId || !message) {
    res.status(400).json({ error: 'id, type, taskId, toUserId, message requis' });
    return;
  }

  const notification = await prisma.appNotification.upsert({
    where: { id },
    update: {},
    create: {
      id,
      type,
      taskId,
      taskTitle: taskTitle ?? '',
      fromUserId: fromUserId || req.userId!,
      toUserId,
      message,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
    },
  });
  res.status(201).json(notification);

  // Pousser la notification en temps réel au destinataire via SSE
  sseManager.broadcast('notification:new', {
    notification: {
      ...notification,
      createdAt: new Date(notification.createdAt).getTime(),
      readAt: notification.readAt ? new Date(notification.readAt).getTime() : undefined,
    },
    toUserId: notification.toUserId,
  });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await prisma.appNotification.update({
      where: { id: req.params.id as string },
      data: { readAt: new Date() },
    });
    res.json(notification);
  } catch {
    res.status(404).json({ error: 'Notification introuvable' });
  }
});

// PATCH /api/notifications/:id/delete-for-user
router.patch('/:id/delete-for-user', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notif = await prisma.appNotification.findUnique({ where: { id: req.params.id as string } });
    if (!notif) { res.status(404).json({ error: 'Notification introuvable' }); return; }
    const deletedBy = Array.from(new Set([...notif.deletedBy, req.userId!]));
    const updated = await prisma.appNotification.update({
      where: { id: req.params.id as string },
      data: { deletedBy },
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: 'Notification introuvable' });
  }
});

export default router;
