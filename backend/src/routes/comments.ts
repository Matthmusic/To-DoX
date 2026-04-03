import { Router, Response } from 'express';
import prisma from '../db/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

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

  let comment;
  if (clientId) {
    comment = await prisma.comment.upsert({
      where: { id: clientId },
      update: {},
      create: {
        id: clientId,
        text,
        taskId: req.params.taskId as string,
        userId: req.userId!,
        ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  } else {
    comment = await prisma.comment.create({
      data: { text, taskId: req.params.taskId as string, userId: req.userId! },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }
  res.status(201).json(comment);
});

// DELETE /api/tasks/:taskId/comments/:id (soft delete — réservé à l'auteur)
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id as string } });
    if (!comment) { res.status(404).json({ error: 'Commentaire introuvable' }); return; }
    if (comment.userId !== req.userId!) { res.status(403).json({ error: 'Interdit' }); return; }
    await prisma.comment.update({ where: { id: comment.id }, data: { deletedAt: new Date() } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Commentaire introuvable' });
  }
});

export default router;
