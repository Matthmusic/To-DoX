import { Router, Response } from 'express';
import prisma from '../db/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const ALLOWED_KEYS = [
  'projectHistory',
  'projectColors',
  'directories',
  'notificationSettings',
  'themeSettings',
  'outlookConfig',
];

// GET /api/settings/:key
router.get('/:key', async (req: AuthRequest, res: Response): Promise<void> => {
  const key = req.params.key as string;
  if (!ALLOWED_KEYS.includes(key)) {
    res.status(400).json({ error: 'Clé invalide' });
    return;
  }
  const setting = await prisma.appSettings.findUnique({ where: { key } });
  res.json(setting?.value ?? null);
});

// PUT /api/settings/:key
router.put('/:key', async (req: AuthRequest, res: Response): Promise<void> => {
  const key = req.params.key as string;
  if (!ALLOWED_KEYS.includes(key)) {
    res.status(400).json({ error: 'Clé invalide' });
    return;
  }
  const setting = await prisma.appSettings.upsert({
    where: { key },
    update: { value: req.body },
    create: { key, value: req.body },
  });
  res.json(setting.value);
});

export default router;
