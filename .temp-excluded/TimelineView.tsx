/**
 * 📅 TIMELINE VIEW COMPONENT
 * Vue chronologique des tâches avec animations premium
 * Design: Timeline verticale avec dots animés et cartes glassmorphism
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, User, CheckCircle2, Circle, AlertCircle, Star, FolderOpen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { timelineItemVariants, timelineDotPulse } from '../utils/animations';
import { businessDayDelta, getProjectColor, getInitials } from '../utils';
import useStore from '../store/useStore';
import type { Task } from '../types';
import { GlassCard } from './ui/GlassModal';

interface TimelineViewProps {
  onTaskClick?: (task: Task) => void;
  filterProject?: string;
}

type TimelineGroup = {
  label: string;
  tasks: Task[];
  color: string;
  icon: typeof Circle;
};

export function TimelineView({ onTaskClick, filterProject = 'all' }: TimelineViewProps) {
  const { tasks, users, directories, projectColors } = useStore();
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'high' | 'med' | 'low'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'todo' | 'doing' | 'review' | 'done'>('all');

  // Grouper les tâches par date d'échéance
  const timelineGroups = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Filtrer les tâches
    let filtered = tasks.filter(t => !t.deletedAt && !t.archived);

    if (filterProject !== 'all') {
      filtered = filtered.filter(t => t.project === filterProject);
    }

    if (selectedPriority !== 'all') {
      filtered = filtered.filter(t => t.priority === selectedPriority);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(t => t.status === selectedStatus);
    }

    // Trier par date d'échéance (puis par date de création si pas de due)
    const sorted = [...filtered].sort((a, b) => {
      const aDate = a.due ? new Date(a.due).getTime() : a.createdAt;
      const bDate = b.due ? new Date(b.due).getTime() : b.createdAt;
      return aDate - bDate;
    });

    const groups: TimelineGroup[] = [];

    // Groupe: En retard
    const overdue = sorted.filter(t => {
      if (!t.due || t.status === 'done') return false;
      return businessDayDelta(t.due) < 0;
    });
    if (overdue.length > 0) {
      groups.push({
        label: '🚨 En retard',
        tasks: overdue,
        color: 'text-rose-400',
        icon: AlertCircle
      });
    }

    // Groupe: Aujourd'hui
    const today = sorted.filter(t => {
      if (!t.due || t.status === 'done') return false;
      return businessDayDelta(t.due) === 0;
    });
    if (today.length > 0) {
      groups.push({
        label: '⚡ Aujourd\'hui',
        tasks: today,
        color: 'text-amber-400',
        icon: Clock
      });
    }

    // Groupe: Cette semaine (J+1 à J+7)
    const thisWeek = sorted.filter(t => {
      if (!t.due || t.status === 'done') return false;
      const days = businessDayDelta(t.due);
      return days >= 1 && days <= 7;
    });
    if (thisWeek.length > 0) {
      groups.push({
        label: '📅 Cette semaine',
        tasks: thisWeek,
        color: 'text-cyan-400',
        icon: Calendar
      });
    }

    // Groupe: Plus tard (>7 jours)
    const later = sorted.filter(t => {
      if (!t.due || t.status === 'done') return false;
      return businessDayDelta(t.due) > 7;
    });
    if (later.length > 0) {
      groups.push({
        label: '🔮 Plus tard',
        tasks: later,
        color: 'text-purple-400',
        icon: Circle
      });
    }

    // Groupe: Sans date
    const noDate = sorted.filter(t => !t.due && t.status !== 'done');
    if (noDate.length > 0) {
      groups.push({
        label: '📌 Sans date limite',
        tasks: noDate,
        color: 'text-slate-400',
        icon: Circle
      });
    }

    // Groupe: Terminées récemment (7 derniers jours)
    const recentlyDone = sorted.filter(t => {
      if (t.status !== 'done') return false;
      const completedTime = t.completedAt || t.updatedAt;
      return completedTime && (now - completedTime) <= (7 * oneDayMs);
    });
    if (recentlyDone.length > 0) {
      groups.push({
        label: '✅ Terminées récemment',
        tasks: recentlyDone,
        color: 'text-emerald-400',
        icon: CheckCircle2
      });
    }

    return groups;
  }, [tasks, filterProject, selectedPriority, selectedStatus]);

  return (
    <div className="flex flex-col h-full">
      {/* Filters Bar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/10 bg-[#0a0e1a]/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-slate-400">Priorité:</label>
          <div className="flex gap-1">
            {(['all', 'high', 'med', 'low'] as const).map((priority) => (
              <motion.button
                key={priority}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedPriority(priority)}
                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                  selectedPriority === priority
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/50'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {priority === 'all' ? 'Toutes' : priority === 'high' ? 'Haute' : priority === 'med' ? 'Moyenne' : 'Basse'}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-slate-400">Statut:</label>
          <div className="flex gap-1">
            {(['all', 'todo', 'doing', 'review', 'done'] as const).map((status) => (
              <motion.button
                key={status}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                  selectedStatus === status
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {status === 'all' ? 'Tous' : status === 'todo' ? 'À faire' : status === 'doing' ? 'En cours' : status === 'review' ? 'Review' : 'Fait'}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="ml-auto text-sm text-slate-400">
          {timelineGroups.reduce((sum, g) => sum + g.tasks.length, 0)} tâches
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {timelineGroups.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full text-slate-400"
            >
              <Calendar className="w-20 h-20 mb-4 opacity-20" />
              <p className="text-lg font-semibold">Aucune tâche à afficher</p>
              <p className="text-sm">Modifiez vos filtres pour voir plus de tâches</p>
            </motion.div>
          ) : (
            <div className="max-w-5xl mx-auto">
              {timelineGroups.map((group, groupIndex) => (
                <motion.div
                  key={group.label}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: groupIndex * 0.1 }}
                  className="mb-12"
                >
                  {/* Group Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <group.icon className={`w-6 h-6 ${group.color}`} />
                    <h3 className={`text-xl font-bold ${group.color}`}>
                      {group.label}
                    </h3>
                    <span className="ml-2 px-2 py-1 rounded-full bg-white/10 text-xs font-bold text-slate-400">
                      {group.tasks.length}
                    </span>
                  </div>

                  {/* Timeline Items */}
                  <div className="relative pl-8 border-l-2 border-white/10">
                    {group.tasks.map((task, taskIndex) => (
                      <TimelineItem
                        key={task.id}
                        task={task}
                        index={taskIndex}
                        onClick={() => onTaskClick?.(task)}
                        users={users}
                        directories={directories}
                        projectColors={projectColors}
                      />
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Timeline Item Component
 */
interface TimelineItemProps {
  task: Task;
  index: number;
  onClick: () => void;
  users: ReturnType<typeof useStore>['users'];
  directories: ReturnType<typeof useStore>['directories'];
  projectColors: ReturnType<typeof useStore>['projectColors'];
}

function TimelineItem({ task, index, onClick, users, directories, projectColors }: TimelineItemProps) {
  const remainingDays = task.due ? businessDayDelta(task.due) : null;
  const isOverdue = remainingDays !== null && remainingDays < 0;
  const isDueToday = remainingDays === 0;

  const projectColor = task.project ? getProjectColor(task.project, projectColors) : { border: '', bg: '', text: '' };
  const projectDir = task.project ? directories[task.project] : null;

  const assignedUsers = task.assignedTo.map(userId => users.find(u => u.id === userId)).filter(Boolean);
  const creatorUser = users.find(u => u.id === task.createdBy);

  // Dot color based on status
  const dotColor = task.status === 'done' ? 'bg-emerald-400' :
                   task.status === 'doing' ? 'bg-cyan-400' :
                   task.status === 'review' ? 'bg-purple-400' :
                   isOverdue ? 'bg-rose-400' :
                   isDueToday ? 'bg-amber-400' : 'bg-slate-500';

  return (
    <motion.div
      custom={index}
      variants={timelineItemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="relative mb-8"
    >
      {/* Timeline Dot */}
      <motion.div
        animate={task.status === 'doing' ? timelineDotPulse : undefined}
        className={`absolute -left-[33px] top-3 w-4 h-4 rounded-full border-2 border-[#0a0e1a] ${dotColor}`}
      />

      {/* Card */}
      <GlassCard hoverable onClick={onClick} className="cursor-pointer">
        <div className="flex items-start justify-between gap-4">
          {/* Left Content */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {task.favorite && (
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              )}
              <h4 className="text-lg font-bold text-slate-100">{task.title}</h4>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              {task.project && (
                <span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase ${projectColor.bg} ${projectColor.border} ${projectColor.text}`}>
                  {task.project}
                </span>
              )}

              <span className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase ${
                task.priority === 'high' ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white' :
                task.priority === 'med' ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-black' :
                'bg-gradient-to-r from-emerald-400 to-lime-400 text-black'
              }`}>
                {task.priority === 'high' ? 'HAUTE' : task.priority === 'med' ? 'MOYENNE' : 'BASSE'}
              </span>

              {projectDir && (
                <span className="flex items-center gap-1 text-xs text-indigo-400">
                  <FolderOpen className="w-3 h-3" />
                  Lié
                </span>
              )}
            </div>

            {task.notes && (
              <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                {task.notes}
              </p>
            )}

            {/* Subtasks */}
            {task.subtasks.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>{task.subtasks.filter(st => st.completed).length}/{task.subtasks.length} sous-tâches</span>
              </div>
            )}
          </div>

          {/* Right Content */}
          <div className="flex flex-col items-end gap-2">
            {/* Due Date */}
            {remainingDays !== null && task.status !== 'done' && (
              <span className={`text-xs font-bold ${
                remainingDays < 0 ? 'text-rose-400' :
                remainingDays < 3 ? 'text-rose-400' :
                remainingDays <= 7 ? 'text-amber-400' :
                'text-emerald-400'
              }`}>
                {remainingDays < 0 ? `J${remainingDays}` : `J-${remainingDays} ouvrés`}
              </span>
            )}

            {task.status === 'done' && (
              <span className="text-xs font-bold text-emerald-400">✓ Terminée</span>
            )}

            {/* Users */}
            <div className="flex items-center gap-1">
              {creatorUser && (
                <div
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-300/15 text-emerald-200 text-[10px] font-bold"
                  title={`Créée par ${creatorUser.name}`}
                >
                  {getInitials(creatorUser.name)}
                </div>
              )}
              {assignedUsers.map(user => (
                <div
                  key={user!.id}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-300/40 bg-blue-300/15 text-blue-200 text-[10px] font-bold"
                  title={`Assignée à ${user!.name}`}
                >
                  {getInitials(user!.name)}
                </div>
              ))}
              {assignedUsers.length === 0 && (
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-500/30 bg-slate-700/20 text-slate-500">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
