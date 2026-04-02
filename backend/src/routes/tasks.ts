import { Router, Response } from 'express';
import prisma from '../db/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/tasks
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const status = req.query.status as string | undefined;
  const project = req.query.project as string | undefined;
  const archived = req.query.archived as string | undefined;
  const deleted = req.query.deleted as string | undefined;

  const tasks = await prisma.task.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(project ? { project } : {}),
      archived: archived === 'true' ? true : archived === 'false' ? false : undefined,
      deletedAt: deleted === 'true' ? { not: null } : null,
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });

  res.json(tasks);
});

// GET /api/tasks/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id as string },
    include: { comments: { orderBy: { createdAt: 'asc' } } },
  });
  if (!task) { res.status(404).json({ error: 'Tâche introuvable' }); return; }
  res.json(task);
});

// POST /api/tasks
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, project, due, priority, status, notes, assignedTo, subtasks, order } = req.body;
  if (!title || !project) {
    res.status(400).json({ error: 'title et project requis' });
    return;
  }

  const task = await prisma.task.create({
    data: {
      title,
      project: (project as string).toUpperCase(),
      due: due ?? null,
      priority: priority ?? 'MED',
      status: status ?? 'TODO',
      notes: notes ?? '',
      assignedTo: assignedTo ?? [],
      subtasks: subtasks ?? [],
      order: order ?? 0,
      createdById: req.userId!,
    },
  });
  res.status(201).json(task);
});

// PUT /api/tasks/:id
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    title, project, due, priority, status, notes, assignedTo, subtasks,
    archived, archivedAt, favorite, deletedAt, ganttDays, recurrence, order,
    reviewers, reviewValidatedBy, reviewValidatedAt, reviewRejectedBy,
    reviewRejectedAt, rejectionComment, movedToReviewBy, movedToReviewAt,
    parentTaskId, convertedFromSubtask,
  } = req.body;

  const data: any = { updatedAt: new Date() };
  if (title !== undefined) data.title = title;
  if (project !== undefined) data.project = (project as string).toUpperCase();
  if (due !== undefined) data.due = due;
  if (priority !== undefined) data.priority = priority;
  if (status !== undefined) {
    data.status = status;
    if (status === 'DONE' && !req.body.completedAt) data.completedAt = new Date();
    if (status !== 'DONE') data.completedAt = null;
  }
  if (notes !== undefined) data.notes = notes;
  if (assignedTo !== undefined) data.assignedTo = assignedTo;
  if (subtasks !== undefined) data.subtasks = subtasks;
  if (archived !== undefined) {
    data.archived = archived;
    data.archivedAt = archived ? (archivedAt ? new Date(archivedAt) : new Date()) : null;
  }
  if (favorite !== undefined) data.favorite = favorite;
  if (deletedAt !== undefined) data.deletedAt = deletedAt ? new Date(deletedAt) : null;
  if (ganttDays !== undefined) data.ganttDays = ganttDays;
  if (recurrence !== undefined) data.recurrence = recurrence;
  if (order !== undefined) data.order = order;
  if (reviewers !== undefined) data.reviewers = reviewers;
  if (reviewValidatedBy !== undefined) data.reviewValidatedBy = reviewValidatedBy;
  if (reviewValidatedAt !== undefined) data.reviewValidatedAt = reviewValidatedAt ? new Date(reviewValidatedAt) : null;
  if (reviewRejectedBy !== undefined) data.reviewRejectedBy = reviewRejectedBy;
  if (reviewRejectedAt !== undefined) data.reviewRejectedAt = reviewRejectedAt ? new Date(reviewRejectedAt) : null;
  if (rejectionComment !== undefined) data.rejectionComment = rejectionComment;
  if (movedToReviewBy !== undefined) data.movedToReviewBy = movedToReviewBy;
  if (movedToReviewAt !== undefined) data.movedToReviewAt = movedToReviewAt ? new Date(movedToReviewAt) : null;
  if (parentTaskId !== undefined) data.parentTaskId = parentTaskId;
  if (convertedFromSubtask !== undefined) data.convertedFromSubtask = convertedFromSubtask;

  try {
    const task = await prisma.task.update({ where: { id: req.params.id as string }, data });
    res.json(task);
  } catch {
    res.status(404).json({ error: 'Tâche introuvable' });
  }
});

// DELETE /api/tasks/:id (soft delete)
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.task.update({
      where: { id: req.params.id as string },
      data: { deletedAt: new Date() },
    });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Tâche introuvable' });
  }
});

export default router;
