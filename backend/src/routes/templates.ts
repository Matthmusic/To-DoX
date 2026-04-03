import { Router, Response } from 'express';
import prisma from '../db/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/templates
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const templates = await prisma.taskTemplate.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(templates);
});

// POST /api/templates — client fournit toujours un id (upsert idempotent)
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { id, name, subtaskTitles } = req.body;
  if (!id || !name) { res.status(400).json({ error: 'id et name requis' }); return; }

  const template = await prisma.taskTemplate.upsert({
    where: { id },
    update: {},
    create: { id, name, subtaskTitles: subtaskTitles ?? [] },
  });
  res.status(201).json(template);
});

// DELETE /api/templates/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.taskTemplate.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Template introuvable' });
  }
});

export default router;
