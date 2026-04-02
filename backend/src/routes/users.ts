import { Router, Response } from 'express';
import prisma from '../db/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/users — liste tous les utilisateurs (sans password)
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

// GET /api/users/me
router.get('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, name: true, email: true },
  });
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable' }); return; }
  res.json(user);
});

export default router;
