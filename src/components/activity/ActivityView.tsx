import { useEffect } from 'react';
import {
  ArrowRightLeft, CheckSquare, Square, Plus, Trash2, Archive, MessageCircle, UserPlus,
  CheckCircle2, RotateCcw, Pencil, CalendarClock, Flag, Eye, History, type LucideIcon,
} from 'lucide-react';
import useStore from '../../store/useStore';
import useActivityStore from '../../store/useActivityStore';
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from '../../hooks/useTheme';
import { getInitials } from '../../utils';
import type { ActivityType } from '../../types';
import { describeActivity } from './activityText';
import { dayLabel, withOpacity } from '../chat/chatUtils';

const ICONS: Record<ActivityType, LucideIcon> = {
  task_created: Plus, task_deleted: Trash2, task_restored: RotateCcw, task_archived: Archive, task_unarchived: Archive,
  status_changed: ArrowRightLeft, title_changed: Pencil, project_changed: ArrowRightLeft, due_changed: CalendarClock,
  priority_changed: Flag, assignees_changed: UserPlus, reviewers_added: Eye, review_validated: CheckCircle2,
  review_rejected: RotateCcw, subtask_added: Plus, subtask_checked: CheckSquare, subtask_unchecked: Square,
  subtask_renamed: Pencil, subtask_deleted: Trash2, comment_added: MessageCircle,
};

interface ActivityViewProps {
  onOpenTask: (taskId: string) => void;
}

/** Onglet « Activité » : journal des modifications sur les projets où l'on est assigné. */
export function ActivityView({ onOpenTask }: ActivityViewProps) {
  const { users, currentUser, tasks } = useStore(useShallow((s) => ({ users: s.users, currentUser: s.currentUser, tasks: s.tasks })));
  const { logs, projects, project, hasMore, loading, setProject, loadOlder, markSeen } = useActivityStore(useShallow((s) => ({
    logs: s.logs, projects: s.projects, project: s.project, hasMore: s.hasMore, loading: s.loading,
    setProject: s.setProject, loadOlder: s.loadOlder, markSeen: s.markSeen,
  })));
  const { activeTheme } = useTheme();
  const { primary, textMuted } = activeTheme.palette;

  // Ouvrir l'onglet = tout est vu ; les entrées qui arrivent pendant qu'il est ouvert aussi.
  useEffect(() => { markSeen(); }, [logs, markSeen]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 pb-2 shrink-0">
        <select
          value={project ?? ''}
          onChange={(e) => setProject(e.target.value || null)}
          aria-label="Filtrer par projet"
          className="w-full rounded-xl px-3 py-2 text-[12.5px] outline-none"
          style={{ background: withOpacity(primary, 0.08), border: `1px solid ${withOpacity(primary, 0.18)}`, color: 'rgba(var(--overlay-rgb),0.85)' }}
        >
          <option value="">Tous mes projets ({projects.length})</option>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
            <History className="h-8 w-8" style={{ color: withOpacity(primary, 0.3) }} />
            <span className="text-xs tracking-wide" style={{ color: textMuted }}>
              {loading ? 'Chargement…' : projects.length === 0
                ? "Vous n'êtes assigné à aucun projet pour l'instant."
                : 'Aucune activité enregistrée.'}
            </span>
          </div>
        )}

        {logs.map((log, i) => {
          const prev = logs[i - 1];
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(log.createdAt).toDateString();
          const author = users.find((u) => u.id === log.userId)?.name ?? 'Utilisateur inconnu';
          const Icon = ICONS[log.type] ?? Pencil;
          const taskExists = tasks.some((t) => t.id === log.taskId && !t.deletedAt);
          const time = new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={log.id}>
              {newDay && (
                <div className="px-3 pt-3 pb-1 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                  {dayLabel(log.createdAt)}
                </div>
              )}
              <button
                onClick={() => taskExists && onOpenTask(log.taskId)}
                disabled={!taskExists}
                title={taskExists ? 'Ouvrir la tâche' : 'Tâche supprimée ou archivée'}
                className="w-full flex items-start gap-2.5 rounded-xl px-3 py-2 text-left transition-colors enabled:hover:bg-[rgba(var(--overlay-rgb),0.06)]"
              >
                <div className="relative shrink-0">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-black"
                    style={{ background: withOpacity(primary, 0.12), color: primary }}>
                    {getInitials(author)}
                  </div>
                  <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center"
                    style={{ background: activeTheme.palette.bgSecondary, color: primary }}>
                    <Icon className="h-2.5 w-2.5" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] leading-snug" style={{ color: 'rgba(var(--overlay-rgb),0.85)' }}>
                    <b>{log.userId === currentUser ? 'Vous' : author}</b> {describeActivity(log, users)}
                  </p>
                  <p className="text-[11px] truncate mt-0.5" style={{ color: textMuted }}>
                    <span style={{ color: withOpacity(primary, 0.8) }}>{log.project}</span> · {log.taskTitle} · {time}
                  </p>
                </div>
              </button>
            </div>
          );
        })}

        {hasMore && (
          <div className="flex justify-center py-2">
            <button onClick={() => loadOlder().catch(() => {})} className="text-[11.5px] hover:underline" style={{ color: primary }}>
              Afficher plus
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
