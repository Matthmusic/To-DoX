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

// POST /api/tasks/:taskId/comments
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { text } = req.body;
  if (!text) { res.status(400).json({ error: 'text requis' }); return; }

  const comment = await prisma.comment.create({
    data: { text, taskId: req.params.taskId as string, userId: req.userId! },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.status(201).json(comment);
});

// DELETE /api/tasks/:taskId/comments/:id (soft delete)
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.comment.update({
      where: { id: req.params.id as string },
      data: { deletedAt: new Date() },
    });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Commentaire introuvable' });
  }
});

export default router;
