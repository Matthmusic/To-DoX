import { Router, Response } from 'express';
import prisma from '../db/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/comments — tous les commentaires non supprimés (chargement initial)
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const comments = await prisma.comment.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, taskId: true, userId: true, text: true, createdAt: true, deletedAt: true },
  });
  res.json(comments);
});

export default router;
