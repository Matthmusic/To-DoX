/**
 * 🎬 VIEW SWITCHER COMPONENT
 * Toggle entre les différentes vues : Kanban, Timeline, Stats
 * Design: Boutons animés avec glassmorphism
 */

import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Calendar, BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { fadeIn } from '../utils/animations';

export type ViewMode = 'kanban' | 'timeline' | 'stats';

interface ViewSwitcherProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  const views: Array<{ id: ViewMode; label: string; icon: typeof LayoutGrid }> = [
    { id: 'kanban', label: 'Kanban', icon: LayoutGrid },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
    { id: 'stats', label: 'Statistiques', icon: BarChart3 }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 p-1 rounded-xl bg-[#0a0e1a]/80 backdrop-blur-lg border border-white/10"
    >
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = currentView === view.id;

        return (
          <motion.button
            key={view.id}
            onClick={() => onViewChange(view.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative px-4 py-2 rounded-lg transition-colors"
          >
            {/* Active background */}
            <AnimatePresence>
              {isActive && (
                <motion.div
                  layoutId="activeView"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg"
                />
              )}
            </AnimatePresence>

            {/* Content */}
            <div className="relative flex items-center gap-2">
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className={`text-sm font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                {view.label}
              </span>
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
