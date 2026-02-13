/**
 * 📊 STATS VIEW COMPONENT
 * Dashboard de statistiques visuelles avec graphiques animés
 * Design: Charts cyberpunk avec glassmorphism et animations premium
 */

import { motion } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  TrendingUp, Target, Clock, CheckCircle2, AlertTriangle,
  Users, FolderKanban, Zap, Award, Calendar
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { GlassCard, GlassPanel } from './ui/GlassModal';
import { listContainer, listItem, counterAnimation, fadeIn } from '../utils/animations';
import useStore from '../store/useStore';
import type { Task } from '../types';
import { businessDayDelta } from '../utils';

interface StatsViewProps {
  filterProject?: string;
}

export function StatsView({ filterProject = 'all' }: StatsViewProps) {
  const { tasks, users, currentUser } = useStore();
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week');

  // Filtrer les tâches
  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(t => !t.deletedAt && !t.archived);
    if (filterProject !== 'all') {
      filtered = filtered.filter(t => t.project === filterProject);
    }
    return filtered;
  }, [tasks, filterProject]);

  // ============================================
  // CALCULS DES STATISTIQUES
  // ============================================

  const stats = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const periodMs = selectedPeriod === 'week' ? 7 * oneDayMs :
                     selectedPeriod === 'month' ? 30 * oneDayMs :
                     Infinity;

    // Filtrer par période
    const periodTasks = filteredTasks.filter(t => {
      if (selectedPeriod === 'all') return true;
      return (now - t.createdAt) <= periodMs;
    });

    const total = periodTasks.length;
    const done = periodTasks.filter(t => t.status === 'done').length;
    const doing = periodTasks.filter(t => t.status === 'doing').length;
    const todo = periodTasks.filter(t => t.status === 'todo').length;
    const review = periodTasks.filter(t => t.status === 'review').length;

    const overdue = periodTasks.filter(t => {
      if (!t.due || t.status === 'done') return false;
      return businessDayDelta(t.due) < 0;
    }).length;

    const dueToday = periodTasks.filter(t => {
      if (!t.due || t.status === 'done') return false;
      return businessDayDelta(t.due) === 0;
    }).length;

    const high = periodTasks.filter(t => t.priority === 'high' && t.status !== 'done').length;
    const med = periodTasks.filter(t => t.priority === 'med' && t.status !== 'done').length;
    const low = periodTasks.filter(t => t.priority === 'low' && t.status !== 'done').length;

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    // Tâches complétées dans la période
    const completedInPeriod = periodTasks.filter(t => {
      if (t.status !== 'done') return false;
      const completedTime = t.completedAt || t.updatedAt;
      return completedTime && (now - completedTime) <= periodMs;
    }).length;

    // Projets actifs
    const activeProjects = new Set(periodTasks.filter(t => t.status !== 'done').map(t => t.project)).size;

    return {
      total,
      done,
      doing,
      todo,
      review,
      overdue,
      dueToday,
      high,
      med,
      low,
      completionRate,
      completedInPeriod,
      activeProjects
    };
  }, [filteredTasks, selectedPeriod]);

  // Données pour le graphique de statut (Pie Chart)
  const statusData = [
    { name: 'Terminées', value: stats.done, color: '#10b981' },
    { name: 'En cours', value: stats.doing, color: '#00e5ff' },
    { name: 'À faire', value: stats.todo, color: '#94a3b8' },
    { name: 'Review', value: stats.review, color: '#b794f6' }
  ].filter(d => d.value > 0);

  // Données pour le graphique de priorité (Bar Chart)
  const priorityData = [
    { name: 'Haute', value: stats.high, color: '#f43f5e' },
    { name: 'Moyenne', value: stats.med, color: '#fbbf24' },
    { name: 'Basse', value: stats.low, color: '#10b981' }
  ];

  // Données pour l'évolution (Line Chart) - 7 derniers jours
  const evolutionData = useMemo(() => {
    const days = [];
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (let i = 6; i >= 0; i--) {
      const dayStart = now - (i * oneDayMs);
      const dayEnd = dayStart + oneDayMs;
      const date = new Date(dayStart);

      const completedThatDay = filteredTasks.filter(t => {
        const completedTime = t.completedAt || (t.status === 'done' ? t.updatedAt : 0);
        return completedTime >= dayStart && completedTime < dayEnd;
      }).length;

      const createdThatDay = filteredTasks.filter(t => {
        return t.createdAt >= dayStart && t.createdAt < dayEnd;
      }).length;

      days.push({
        name: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
        completées: completedThatDay,
        créées: createdThatDay
      });
    }

    return days;
  }, [filteredTasks]);

  // Données par projet (Top 5)
  const projectsData = useMemo(() => {
    const projectMap = new Map<string, { total: number; done: number }>();

    filteredTasks.forEach(t => {
      const proj = t.project || 'Sans projet';
      if (!projectMap.has(proj)) {
        projectMap.set(proj, { total: 0, done: 0 });
      }
      const data = projectMap.get(proj)!;
      data.total++;
      if (t.status === 'done') data.done++;
    });

    return Array.from(projectMap.entries())
      .map(([name, data]) => ({
        name,
        tâches: data.total,
        terminées: data.done,
        taux: data.total > 0 ? Math.round((data.done / data.total) * 100) : 0
      }))
      .sort((a, b) => b.tâches - a.tâches)
      .slice(0, 5);
  }, [filteredTasks]);

  // Données par utilisateur
  const usersData = useMemo(() => {
    const userMap = new Map<string, { total: number; done: number; name: string }>();

    filteredTasks.forEach(t => {
      t.assignedTo.forEach(userId => {
        const user = users.find(u => u.id === userId);
        const userName = user?.name || 'Non assignée';

        if (!userMap.has(userId)) {
          userMap.set(userId, { total: 0, done: 0, name: userName });
        }
        const data = userMap.get(userId)!;
        data.total++;
        if (t.status === 'done') data.done++;
      });
    });

    return Array.from(userMap.values())
      .map(data => ({
        name: data.name,
        total: data.total,
        terminées: data.done,
        taux: data.total > 0 ? Math.round((data.done / data.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredTasks, users]);

  return (
    <div className="flex flex-col h-full">
      {/* Header avec sélecteur de période */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0a0e1a]/80 backdrop-blur-sm">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
          Statistiques & Analytics
        </h2>

        <div className="flex gap-2">
          {(['week', 'month', 'all'] as const).map((period) => (
            <motion.button
              key={period}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                selectedPeriod === period
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/50'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {period === 'week' ? 'Cette semaine' : period === 'month' ? 'Ce mois' : 'Tout'}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="visible"
          className="max-w-7xl mx-auto space-y-6"
        >
          {/* KPI Cards */}
          <motion.div variants={listItem} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={CheckCircle2}
              label="Taux de complétion"
              value={`${stats.completionRate}%`}
              color="emerald"
              trend={stats.completedInPeriod > 0 ? `+${stats.completedInPeriod} cette période` : undefined}
            />
            <StatCard
              icon={Zap}
              label="Tâches actives"
              value={stats.doing.toString()}
              color="cyan"
              trend={`${stats.todo} à faire`}
            />
            <StatCard
              icon={AlertTriangle}
              label="En retard"
              value={stats.overdue.toString()}
              color="rose"
              trend={stats.dueToday > 0 ? `${stats.dueToday} pour aujourd'hui` : undefined}
            />
            <StatCard
              icon={FolderKanban}
              label="Projets actifs"
              value={stats.activeProjects.toString()}
              color="purple"
              trend={`${stats.total} tâches total`}
            />
          </motion.div>

          {/* Charts Row 1 */}
          <motion.div variants={listItem} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <GlassPanel>
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-cyan-400" />
                  Distribution des statuts
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      animationBegin={0}
                      animationDuration={800}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(19, 24, 37, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </GlassPanel>

            {/* Priority Distribution */}
            <GlassPanel>
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  Priorités en attente
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={priorityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(19, 24, 37, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={800}>
                      {priorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassPanel>
          </motion.div>

          {/* Evolution Chart */}
          <motion.div variants={listItem}>
            <GlassPanel>
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  Évolution (7 derniers jours)
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(19, 24, 37, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="completées"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', r: 4 }}
                      animationDuration={1000}
                    />
                    <Line
                      type="monotone"
                      dataKey="créées"
                      stroke="#00e5ff"
                      strokeWidth={2}
                      dot={{ fill: '#00e5ff', r: 4 }}
                      animationDuration={1000}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassPanel>
          </motion.div>

          {/* Projects & Users */}
          <motion.div variants={listItem} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Projects */}
            <GlassPanel>
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-cyan-400" />
                  Top 5 Projets
                </h3>
                <div className="space-y-3">
                  {projectsData.map((proj, idx) => (
                    <motion.div
                      key={proj.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-slate-200">{proj.name}</span>
                          <span className="text-xs font-bold text-slate-400">{proj.tâches} tâches</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${proj.taux}%` }}
                              transition={{ delay: idx * 0.1 + 0.3, duration: 0.6 }}
                              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                            />
                          </div>
                          <span className="text-xs font-bold text-cyan-400">{proj.taux}%</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </GlassPanel>

            {/* Users Performance */}
            <GlassPanel>
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  Performance par utilisateur
                </h3>
                <div className="space-y-3">
                  {usersData.map((user, idx) => (
                    <motion.div
                      key={user.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-slate-200">{user.name}</span>
                          <span className="text-xs font-bold text-slate-400">{user.terminées}/{user.total}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${user.taux}%` }}
                              transition={{ delay: idx * 0.1 + 0.3, duration: 0.6 }}
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                            />
                          </div>
                          <span className="text-xs font-bold text-emerald-400">{user.taux}%</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </GlassPanel>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * Stat Card Component
 */
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'emerald' | 'cyan' | 'rose' | 'purple' | 'amber';
  trend?: string;
}

function StatCard({ icon: Icon, label, value, color, trend }: StatCardProps) {
  const colorClasses = {
    emerald: {
      icon: 'text-emerald-400',
      bg: 'from-emerald-500/20 to-teal-500/20',
      glow: 'hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]'
    },
    cyan: {
      icon: 'text-cyan-400',
      bg: 'from-cyan-500/20 to-blue-500/20',
      glow: 'hover:shadow-[0_0_40px_rgba(0,229,255,0.3)]'
    },
    rose: {
      icon: 'text-rose-400',
      bg: 'from-rose-500/20 to-red-500/20',
      glow: 'hover:shadow-[0_0_40px_rgba(244,63,94,0.3)]'
    },
    purple: {
      icon: 'text-purple-400',
      bg: 'from-purple-500/20 to-pink-500/20',
      glow: 'hover:shadow-[0_0_40px_rgba(183,148,246,0.3)]'
    },
    amber: {
      icon: 'text-amber-400',
      bg: 'from-amber-500/20 to-orange-500/20',
      glow: 'hover:shadow-[0_0_40px_rgba(251,191,36,0.3)]'
    }
  };

  const colors = colorClasses[color];

  return (
    <GlassCard hoverable={false} className={`transition-shadow duration-300 ${colors.glow}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-400 mb-2">{label}</p>
          <motion.p
            {...counterAnimation}
            className="text-3xl font-bold text-white mb-1"
          >
            {value}
          </motion.p>
          {trend && (
            <p className="text-xs text-slate-500">{trend}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colors.bg}`}>
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
      </div>
    </GlassCard>
  );
}
