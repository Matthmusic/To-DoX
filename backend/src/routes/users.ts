import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db/prisma';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const USER_SELECT = { id: true, name: true, email: true, isAdmin: true } as const;

// GET /api/users — liste tous les utilisateurs
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

// GET /api/users/me
router.get('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: USER_SELECT,
  });
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable' }); return; }
  res.json(user);
});

// PATCH /api/users/:id/password — réinitialise le mot de passe (admin uniquement)
router.patch('/:id/password', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { password } = req.body as { password?: string };
  if (!password || password.length < 6) {
    res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
    return;
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: req.params.id as string },
      data: { password: hash },
    });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'Utilisateur introuvable' });
  }
});

// PATCH /api/users/:id/admin — passe un user en admin ou retire les droits (admin uniquement)
router.patch('/:id/admin', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { isAdmin } = req.body as { isAdmin?: boolean };
  if (typeof isAdmin !== 'boolean') {
    res.status(400).json({ error: 'isAdmin (boolean) requis' });
    return;
  }
  // On ne peut pas retirer ses propres droits admin
  if (req.params.id === req.userId && !isAdmin) {
    res.status(400).json({ error: 'Impossible de retirer vos propres droits admin' });
    return;
  }
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { isAdmin },
      select: USER_SELECT,
    });
    res.json(user);
  } catch {
    res.status(404).json({ error: 'Utilisateur introuvable' });
  }
});

export default router;
