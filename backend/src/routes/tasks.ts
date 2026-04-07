import { Router, Response } from 'express';
import prisma from '../db/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sseManager } from '../sse/sseManager';
import { createNotif, buildNextRecurringTask, normalizeTaskForClient } from '../utils/notifHelper';

const router = Router();
router.use(requireAuth);

// GET /api/tasks
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const status   = req.query.status   as string | undefined;
  const project  = req.query.project  as string | undefined;
  const archived = req.query.archived as string | undefined;
  const deleted  = req.query.deleted  as string | undefined;

  const tasks = await prisma.task.findMany({
    where: {
      ...(status  ? { status:  status  as any } : {}),
      ...(project ? { project } : {}),
      archived: archived === 'true' ? true : false,
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

// POST /api/tasks — upsert idempotent : le client fournit son propre id
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { id: clientId, title, project, due, priority, status, notes, assignedTo, subtasks, order } = req.body;
  if (!title || !project) {
    res.status(400).json({ error: 'title et project requis' });
    return;
  }

  const createData = {
    title,
    project:    (project as string).toUpperCase(),
    due:        due   ?? null,
    priority:   priority ?? 'MED',
    status:     status   ?? 'TODO',
    notes:      notes    ?? '',
    assignedTo: assignedTo ?? [],
    subtasks:   subtasks   ?? [],
    order:      order      ?? 0,
    createdById: req.userId!,
  };

  const task = clientId
    ? await prisma.task.upsert({ where: { id: clientId }, update: {}, create: { id: clientId, ...createData } })
    : await prisma.task.create({ data: createData });

  res.status(201).json(task);
  sseManager.broadcast('task:created', { task, updatedBy: req.userId });
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
  if (title      !== undefined) data.title      = title;
  if (project    !== undefined) data.project    = (project as string).toUpperCase();
  if (due        !== undefined) data.due        = due;
  if (priority   !== undefined) data.priority   = priority;
  if (status     !== undefined) {
    data.status = status;
    if (status === 'DONE' && !req.body.completedAt) data.completedAt = new Date();
    if (status !== 'DONE') data.completedAt = null;
  }
  if (notes        !== undefined) data.notes        = notes;
  if (assignedTo   !== undefined) data.assignedTo   = assignedTo;
  if (subtasks     !== undefined) data.subtasks     = subtasks;
  if (archived     !== undefined) {
    data.archived  = archived;
    data.archivedAt = archived ? (archivedAt ? new Date(archivedAt) : new Date()) : null;
  }
  if (favorite         !== undefined) data.favorite         = favorite;
  if (deletedAt        !== undefined) data.deletedAt        = deletedAt ? new Date(deletedAt) : null;
  if (ganttDays        !== undefined) data.ganttDays        = ganttDays;
  if (recurrence       !== undefined) data.recurrence       = recurrence;
  if (order            !== undefined) data.order            = order;
  if (reviewers        !== undefined) data.reviewers        = reviewers;
  if (reviewValidatedBy  !== undefined) data.reviewValidatedBy  = reviewValidatedBy;
  if (reviewValidatedAt  !== undefined) data.reviewValidatedAt  = reviewValidatedAt ? new Date(reviewValidatedAt) : null;
  if (reviewRejectedBy   !== undefined) data.reviewRejectedBy   = reviewRejectedBy;
  if (reviewRejectedAt   !== undefined) data.reviewRejectedAt   = reviewRejectedAt ? new Date(reviewRejectedAt) : null;
  if (rejectionComment   !== undefined) data.rejectionComment   = rejectionComment;
  if (movedToReviewBy    !== undefined) data.movedToReviewBy    = movedToReviewBy;
  if (movedToReviewAt    !== undefined) data.movedToReviewAt    = movedToReviewAt ? new Date(movedToReviewAt) : null;
  if (parentTaskId         !== undefined) data.parentTaskId         = parentTaskId;
  if (convertedFromSubtask !== undefined) data.convertedFromSubtask = convertedFromSubtask;

  try {
    // Lire l'état avant modification pour comparer les changements
    const before = await prisma.task.findUnique({ where: { id: req.params.id as string } });
    if (!before) { res.status(404).json({ error: 'Tâche introuvable' }); return; }

    const task = await prisma.task.update({ where: { id: req.params.id as string }, data });
    res.json(task);
    sseManager.broadcast('task:updated', { task, updatedBy: req.userId });

    const fromUser = await prisma.user.findUnique({ where: { id: req.userId! }, select: { name: true } });
    const fromUserName = fromUser?.name || req.userId!;

    // Tâche passée en REVIEW → notifier les réviseurs
    if (status === 'REVIEW' && before.status !== 'REVIEW' && task.reviewers?.length) {
      for (const reviewerId of task.reviewers) {
        await createNotif({ prisma, type: 'review_requested', taskId: task.id, taskTitle: task.title, fromUserId: req.userId!, toUserId: reviewerId, message: `${fromUserName} t'a assigné comme réviseur sur ${task.title}` });
      }
    }

    // Tâche passée en DONE avec récurrence → créer la prochaine occurrence
    if (status === 'DONE' && before.status !== 'DONE' && task.recurrence) {
      const nextData = buildNextRecurringTask(task, req.userId!);
      if (nextData) {
        const nextTask = await prisma.task.create({ data: nextData });
        sseManager.broadcast('task:created', { task: normalizeTaskForClient(nextTask), updatedBy: 'system' });
      }
    }
  } catch {
    res.status(404).json({ error: 'Tâche introuvable' });
  }
});

// PUT /api/tasks/:id/reviewers — définit les réviseurs et envoie les notifications
router.put('/:id/reviewers', async (req: AuthRequest, res: Response): Promise<void> => {
  const { reviewers } = req.body as { reviewers: string[] };
  if (!Array.isArray(reviewers)) { res.status(400).json({ error: 'reviewers (array) requis' }); return; }

  try {
    const before = await prisma.task.findUnique({ where: { id: req.params.id as string } });
    if (!before) { res.status(404).json({ error: 'Tâche introuvable' }); return; }

    // Auto-assigner les réviseurs non encore affectés
    const newAssignees = reviewers.filter(r => !before.assignedTo.includes(r) && r !== 'unassigned');
    const updatedAssignedTo = newAssignees.length > 0
      ? [...before.assignedTo.filter(id => id !== 'unassigned'), ...newAssignees]
      : before.assignedTo;

    const task = await prisma.task.update({
      where: { id: req.params.id as string },
      data: { reviewers, assignedTo: updatedAssignedTo, updatedAt: new Date() },
    });
    res.json(task);
    sseManager.broadcast('task:updated', { task, updatedBy: req.userId });

    const fromUser = await prisma.user.findUnique({ where: { id: req.userId! }, select: { name: true } });
    const fromUserName = fromUser?.name || req.userId!;

    for (const reviewerId of reviewers) {
      await createNotif({ prisma, type: 'review_requested', taskId: task.id, taskTitle: task.title, fromUserId: req.userId!, toUserId: reviewerId, message: `${fromUserName} t'a assigné comme réviseur sur ${task.title}` });
    }
  } catch {
    res.status(404).json({ error: 'Tâche introuvable' });
  }
});

// POST /api/tasks/:id/validate — valide la tâche et notifie les assignés
router.post('/:id/validate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const before = await prisma.task.findUnique({ where: { id: req.params.id as string } });
    if (!before) { res.status(404).json({ error: 'Tâche introuvable' }); return; }

    const task = await prisma.task.update({
      where: { id: req.params.id as string },
      data: {
        status: 'DONE',
        completedAt: new Date(),
        reviewValidatedBy: req.userId!,
        reviewValidatedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    res.json(task);
    sseManager.broadcast('task:updated', { task, updatedBy: req.userId });

    const fromUser = await prisma.user.findUnique({ where: { id: req.userId! }, select: { name: true } });
    const fromUserName = fromUser?.name || req.userId!;

    // Notifier tous les assignés
    for (const assigneeId of task.assignedTo) {
      await createNotif({ prisma, type: 'review_validated', taskId: task.id, taskTitle: task.title, fromUserId: req.userId!, toUserId: assigneeId, message: `${fromUserName} a validé la tâche ${task.title} ✅` });
    }

    // Créer la prochaine occurrence si récurrente
    if (task.recurrence) {
      const nextData = buildNextRecurringTask(task, req.userId!);
      if (nextData) {
        const nextTask = await prisma.task.create({ data: nextData });
        sseManager.broadcast('task:created', { task: normalizeTaskForClient(nextTask), updatedBy: 'system' });
      }
    }
  } catch {
    res.status(404).json({ error: 'Tâche introuvable' });
  }
});

// POST /api/tasks/:id/corrections — demande des corrections, crée un commentaire, notifie les assignés
router.post('/:id/corrections', async (req: AuthRequest, res: Response): Promise<void> => {
  const { comment: correctionComment } = req.body as { comment: string };
  if (!correctionComment) { res.status(400).json({ error: 'comment requis' }); return; }

  try {
    const task = await prisma.task.update({
      where: { id: req.params.id as string },
      data: {
        status: 'DOING',
        reviewRejectedBy: req.userId!,
        reviewRejectedAt: new Date(),
        rejectionComment: correctionComment,
        updatedAt: new Date(),
      },
    });
    res.json(task);
    sseManager.broadcast('task:updated', { task, updatedBy: req.userId });

    // Créer le commentaire de correction visible dans le fil
    const commentText = `↩️ Corrections demandées : ${correctionComment}`;
    const newComment  = await prisma.comment.create({
      data: { text: commentText, taskId: task.id, userId: req.userId! },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    sseManager.broadcast('comment:added', {
      comment: { id: newComment.id, taskId: newComment.taskId, userId: newComment.userId, text: newComment.text, createdAt: new Date(newComment.createdAt).getTime(), deletedAt: null },
      fromUser: newComment.user,
    });

    const fromUser = await prisma.user.findUnique({ where: { id: req.userId! }, select: { name: true } });
    const fromUserName = fromUser?.name || req.userId!;

    for (const assigneeId of task.assignedTo) {
      await createNotif({ prisma, type: 'review_rejected', taskId: task.id, taskTitle: task.title, fromUserId: req.userId!, toUserId: assigneeId, message: `${fromUserName} demande des corrections sur ${task.title} : ${correctionComment}` });
    }
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
    sseManager.broadcast('task:deleted', { taskId: req.params.id, deletedBy: req.userId });
  } catch {
    res.status(404).json({ error: 'Tâche introuvable' });
  }
});

export default router;
