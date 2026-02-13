/**
 * 🎯 MAIN VIEW COMPONENT
 * Vue principale intégrant Kanban, Timeline et Stats
 * Gère le switch entre les différentes vues avec animations
 */

import { motion, AnimatePresence } from 'framer-motion';
import type { ViewMode } from './ViewSwitcher';
import { KanbanBoard } from './KanbanBoard';
import { TimelineView } from './TimelineView';
import { StatsView } from './StatsView';
import { fadeIn } from '../utils/animations';
import type { Task } from '../types';

interface MainViewProps {
  // View control
  currentView: ViewMode;

  // Kanban props
  grouped: ReturnType<any>; // Type from useFilters
  collapsedProjects: Set<string>;
  onDragStartProject: (e: React.DragEvent, projectName: string) => void;
  onDragStartTask: (e: React.DragEvent, taskId: string) => void;
  onDrop: (e: React.DragEvent, status: 'todo' | 'doing' | 'review' | 'done', projectName?: string) => void;
  onContextMenuTask: (e: React.MouseEvent, task: Task) => void;
  onSetProjectDirectory: () => void;

  // Shared props
  filterProject: string;
}

export function MainView({
  currentView,
  grouped,
  collapsedProjects,
  onDragStartProject,
  onDragStartTask,
  onDrop,
  onContextMenuTask,
  onSetProjectDirectory,
  filterProject
}: MainViewProps) {
  return (
    <div className="flex flex-col h-full">
      {/* View Content - Animated */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {currentView === 'kanban' && (
            <motion.div
              key="kanban"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute inset-0"
            >
              <KanbanBoard
                grouped={grouped}
                collapsedProjects={collapsedProjects}
                onDragStartProject={onDragStartProject}
                onDragStartTask={onDragStartTask}
                onDrop={onDrop}
                onContextMenuTask={onContextMenuTask}
                onSetProjectDirectory={onSetProjectDirectory}
              />
            </motion.div>
          )}

          {currentView === 'timeline' && (
            <motion.div
              key="timeline"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute inset-0"
            >
              <TimelineView
                filterProject={filterProject}
                onTaskClick={onContextMenuTask}
              />
            </motion.div>
          )}

          {currentView === 'stats' && (
            <motion.div
              key="stats"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute inset-0"
            >
              <StatsView filterProject={filterProject} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
