import type { Meta, StoryObj } from '@storybook/react';
import { TimelineView } from '../components/TimelineView';
import useStore from '../store/useStore';
import { mockTasks } from './mockData';
import type { Task } from '../types';

const now = Date.now();
const day = 86400000;

// Tâches avec des deadlines variées pour la vue Gantt
const tasksWithDates: Task[] = [
  ...mockTasks,
  {
    id: 'tl-1',
    title: 'Refactoring du module de paiement',
    project: 'REFONTE UI',
    status: 'doing',
    priority: 'high',
    due: new Date(now + day * 10).toISOString().split('T')[0],
    createdBy: 'matthieu',
    assignedTo: ['matthieu'],
    createdAt: now - day * 5,
    updatedAt: now - day * 2,
    completedAt: null,
    notes: '',
    archived: false,
    archivedAt: null,
    subtasks: [],
    favorite: false,
    deletedAt: null,
  },
  {
    id: 'tl-2',
    title: 'Tests d\'intégration API v3',
    project: 'PROJET ALPHA',
    status: 'todo',
    priority: 'med',
    due: new Date(now + day * 5).toISOString().split('T')[0],
    createdBy: 'william',
    assignedTo: ['william', 'sandro'],
    createdAt: now - day * 3,
    updatedAt: now - day,
    completedAt: null,
    notes: '',
    archived: false,
    archivedAt: null,
    subtasks: [],
    favorite: false,
    deletedAt: null,
  },
  {
    id: 'tl-3',
    title: 'Migration vers TypeScript strict',
    project: 'INFRA',
    status: 'review',
    priority: 'high',
    due: new Date(now + day * 3).toISOString().split('T')[0],
    createdBy: 'matteo',
    assignedTo: ['matteo'],
    createdAt: now - day * 20,
    updatedAt: now - day * 1,
    completedAt: null,
    notes: '',
    archived: false,
    archivedAt: null,
    subtasks: [],
    favorite: false,
    deletedAt: null,
  },
  {
    id: 'tl-4',
    title: 'Mise à jour des dépendances critiques',
    project: 'INFRA',
    status: 'todo',
    priority: 'low',
    due: new Date(now + day * 21).toISOString().split('T')[0],
    createdBy: 'sandro',
    assignedTo: [],
    createdAt: now - day * 1,
    updatedAt: now - day * 1,
    completedAt: null,
    notes: '',
    archived: false,
    archivedAt: null,
    subtasks: [],
    favorite: false,
    deletedAt: null,
  },
  {
    id: 'tl-5',
    title: 'Revue de code sprint 12',
    project: 'PROJET BETA',
    status: 'done',
    priority: 'med',
    due: new Date(now - day * 2).toISOString().split('T')[0],
    createdBy: 'laurent',
    assignedTo: ['laurent', 'matthieu'],
    createdAt: now - day * 15,
    updatedAt: now - day * 2,
    completedAt: now - day * 2,
    notes: '',
    archived: false,
    archivedAt: null,
    subtasks: [],
    favorite: false,
    deletedAt: null,
  },
];

const meta: Meta<typeof TimelineView> = {
  title: 'Views/TimelineView',
  component: TimelineView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => {
      useStore.setState({
        tasks: tasksWithDates,
        users: [
          { id: 'matthieu', name: 'Matthieu Maurel', email: 'matthieu@test.fr' },
          { id: 'william', name: 'William Cresson', email: 'william@test.fr' },
          { id: 'sandro', name: 'Sandro Menardi', email: 'sandro@test.fr' },
          { id: 'matteo', name: 'Matteo Voltarel', email: 'matteo@test.fr' },
          { id: 'laurent', name: 'Laurent Marques', email: 'laurent@test.fr' },
        ],
        projectColors: {
          'PROJET ALPHA': 0,
          'PROJET BETA': 1,
          'REFONTE UI': 2,
          'INFRA': 3,
        },
      });
      return (
        <div className="flex flex-col h-screen bg-slate-900">
          <Story />
        </div>
      );
    },
  ],
  args: {
    onTaskClick: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof TimelineView>;

export const ToutesLesTaches: Story = {
  name: 'Toutes les tâches (multi-projets)',
  args: {
    filteredTasks: tasksWithDates,
  },
};

export const UnSeulProjet: Story = {
  name: 'Un seul projet',
  args: {
    filteredTasks: tasksWithDates.filter(t => t.project === 'PROJET ALPHA'),
  },
};

export const TachesEnCours: Story = {
  name: 'Tâches en cours uniquement',
  args: {
    filteredTasks: tasksWithDates.filter(t => t.status === 'doing' || t.status === 'review'),
  },
};

export const SansDates: Story = {
  name: 'Tâches sans dates (mockData standard)',
  args: {
    filteredTasks: mockTasks,
  },
};

export const Vide: Story = {
  name: 'Aucune tâche',
  args: {
    filteredTasks: [],
  },
};
