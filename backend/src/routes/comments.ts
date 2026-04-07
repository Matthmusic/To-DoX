import { Router, Response } from 'express';
import prisma from '../db/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sseManager } from '../sse/sseManager';
import { createNotif } from '../utils/notifHelper';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// GET /api/tasks/:taskId/comments
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const comments = await prisma.comment.findMany({
    where: { taskId: req.params.taskId as string, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.json(comments);
});

// POST /api/tasks/:taskId/comments — client fournit un id (upsert idempotent)
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { text, id: clientId, createdAt } = req.body;
  if (!text) { res.status(400).json({ error: 'text requis' }); return; }

  const taskId = req.params.taskId as string;

  let comment;
  if (clientId) {
    comment = await prisma.comment.upsert({
      where: { id: clientId },
      update: {},
      create: {
        id: clientId,
        text,
        taskId,
        userId: req.userId!,
        ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  } else {
    comment = await prisma.comment.create({
      data: { text, taskId, userId: req.userId! },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  res.status(201).json(comment);

  // Broadcaster le nouveau commentaire à tous les clients SSE
  sseManager.broadcast('comment:added', {
    comment: {
      id: comment.id,
      taskId: comment.taskId,
      userId: comment.userId,
      text: comment.text,
      createdAt: new Date(comment.createdAt).getTime(),
      deletedAt: null,
    },
    fromUser: comment.user,
  });

  // Créer les notifications (mentions + assignés/réviseurs)
  const [task, allUsers] = await Promise.all([
    prisma.task.findUnique({ where: { id: taskId } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  if (!task) return;

  const fromUser = allUsers.find(u => u.id === req.userId);
  const fromUserName = fromUser?.name || req.userId!;
  const taskTitle = task.title;

  // Détecter les @mentions
  const mentionedUsers = allUsers.filter(u => u.id !== req.userId && text.includes(`@${u.name}`));
  const mentionedIds = new Set(mentionedUsers.map(u => u.id));

  for (const user of mentionedUsers) {
    await createNotif({ prisma, type: 'comment_mention', taskId, taskTitle, fromUserId: req.userId!, toUserId: user.id, message: `${fromUserName} vous a mentionné dans "${taskTitle}" : ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}` });
  }

  // Notifier assignés et réviseurs non mentionnés
  const involved = [...new Set([...(task.assignedTo || []), ...(task.reviewers || [])])]
    .filter(id => id !== req.userId && !mentionedIds.has(id));

  for (const toUserId of involved) {
    await createNotif({ prisma, type: 'comment_added', taskId, taskTitle, fromUserId: req.userId!, toUserId, message: `${fromUserName} a commenté "${taskTitle}" : ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}` });
  }
});

// DELETE /api/tasks/:taskId/comments/:id (soft delete — réservé à l'auteur)
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id as string } });
    if (!comment) { res.status(404).json({ error: 'Commentaire introuvable' }); return; }
    if (comment.userId !== req.userId!) { res.status(403).json({ error: 'Interdit' }); return; }
    await prisma.comment.update({ where: { id: comment.id }, data: { deletedAt: new Date() } });
    res.status(204).send();

    sseManager.broadcast('comment:deleted', {
      commentId: comment.id,
      taskId: comment.taskId,
      deletedAt: Date.now(),
    });
  } catch {
    res.status(404).json({ error: 'Commentaire introuvable' });
  }
});

export default router;
