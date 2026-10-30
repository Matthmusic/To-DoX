import type { ActivityLog, User } from '../../types';
import { STATUSES, PRIORITIES } from '../../constants';

// Phrases du journal d'activité (sujet = auteur, affiché à part).

const statusLabel = (id: unknown) => STATUSES.find((s) => s.id === id)?.label ?? String(id ?? '');
const priorityLabel = (id: unknown) => PRIORITIES.find((p) => p.id === id)?.label ?? String(id ?? '');

function dateLabel(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'aucune';
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function names(ids: unknown, users: User[]): string {
  if (!Array.isArray(ids)) return '';
  return ids.map((id) => users.find((u) => u.id === id)?.name ?? 'un utilisateur').join(', ');
}

const q = (v: unknown) => `« ${String(v ?? '')} »`;

export function describeActivity(log: ActivityLog, users: User[]): string {
  const d = log.details;
  switch (log.type) {
    case 'task_created': return 'a créé la tâche';
    case 'task_deleted': return 'a supprimé la tâche';
    case 'task_restored': return 'a restauré la tâche';
    case 'task_archived': return 'a archivé la tâche';
    case 'task_unarchived': return 'a désarchivé la tâche';
    case 'status_changed': return `a déplacé la tâche : ${statusLabel(d.from)} → ${statusLabel(d.to)}`;
    case 'title_changed': return `a renommé la tâche (avant : ${q(d.from)})`;
    case 'project_changed': return `a changé le projet : ${String(d.from)} → ${String(d.to)}`;
    case 'due_changed': return `a changé l'échéance : ${dateLabel(d.from)} → ${dateLabel(d.to)}`;
    case 'priority_changed': return `a changé la priorité : ${priorityLabel(d.from)} → ${priorityLabel(d.to)}`;
    case 'assignees_changed': {
      const parts: string[] = [];
      if (Array.isArray(d.added) && d.added.length) parts.push(`a assigné ${names(d.added, users)}`);
      if (Array.isArray(d.removed) && d.removed.length) parts.push(`a retiré ${names(d.removed, users)}`);
      return parts.join(' et ') || 'a modifié les assignés';
    }
    case 'reviewers_added': return `a demandé une révision à ${names(d.added, users)}`;
    case 'review_validated': return 'a validé la tâche';
    case 'review_rejected': return d.comment ? `a demandé des corrections : ${q(d.comment)}` : 'a demandé des corrections';
    case 'subtask_added': return `a ajouté la sous-tâche ${q(d.title)}`;
    case 'subtask_checked': return `a coché ${q(d.title)}`;
    case 'subtask_unchecked': return `a décoché ${q(d.title)}`;
    case 'subtask_renamed': return `a renommé la sous-tâche ${q(d.from)} en ${q(d.to)}`;
    case 'subtask_deleted': return `a supprimé la sous-tâche ${q(d.title)}`;
    case 'comment_added': return `a commenté : ${q(d.excerpt)}`;
    default: return 'a modifié la tâche';
  }
}
