import { Router, Response } from 'express';
import prisma from '../db/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/time-entries?project=X&date=YYYY-MM-DD
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const project = req.query.project as string | undefined;
  const date = req.query.date as string | undefined;
  const entries = await prisma.timeEntry.findMany({
    where: {
      ...(project ? { project } : {}),
      ...(date ? { date } : {}),
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  });
  res.json(entries);
});

// POST /api/time-entries
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { project, date, hours, note } = req.body;
  if (!project || !date || hours === undefined) {
    res.status(400).json({ error: 'project, date et hours requis' });
    return;
  }

  const entry = await prisma.timeEntry.create({
    data: { project: (project as string).toUpperCase(), date, hours, note, userId: req.userId! },
    include: { user: { select: { id: true, name: true } } },
  });
  res.status(201).json(entry);
});

// PUT /api/time-entries/:id
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { hours, note } = req.body;
  try {
    const entry = await prisma.timeEntry.update({
      where: { id: req.params.id as string },
      data: { ...(hours !== undefined ? { hours } : {}), ...(note !== undefined ? { note } : {}) },
    });
    res.json(entry);
  } catch {
    res.status(404).json({ error: 'Entrée introuvable' });
  }
});

// DELETE /api/time-entries/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.timeEntry.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Entrée introuvable' });
  }
});

export default router;
