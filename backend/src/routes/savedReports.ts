import { Router, Response } from 'express';
import prisma from '../db/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/saved-reports
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const reports = await prisma.savedReport.findMany({ orderBy: { generatedAt: 'desc' } });
  res.json(reports);
});

// POST /api/saved-reports — client fournit toujours un id (upsert idempotent)
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { id, generatedAt, generatedBy, periodType, periodLabel, taskCount, reportText } = req.body;
  if (!id || !periodType || !periodLabel || reportText === undefined) {
    res.status(400).json({ error: 'id, periodType, periodLabel, reportText requis' });
    return;
  }

  const report = await prisma.savedReport.upsert({
    where: { id },
    update: {},
    create: {
      id,
      generatedAt: generatedAt ? new Date(generatedAt) : new Date(),
      generatedById: generatedBy || req.userId!,
      periodType,
      periodLabel,
      taskCount: taskCount ?? 0,
      reportText,
    },
  });
  res.status(201).json(report);
});

// DELETE /api/saved-reports/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.savedReport.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Rapport introuvable' });
  }
});

export default router;
