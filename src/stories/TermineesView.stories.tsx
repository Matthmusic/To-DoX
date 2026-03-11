import type { Meta, StoryObj } from '@storybook/react';
import { TermineesView } from '../components/TermineesView';
import useStore from '../store/useStore';
import { mockTasks } from './mockData';
import type { Task } from '../types';

const now = Date.now();
const day = 86400000;

// Tâches terminées supplémentaires
const doneTasks: Task[] = [
  {
    id: 'done-1',
    title: 'Mise en place du pipeline CI/CD GitHub Actions',
    project: 'INFRA',
    status: 'done',
    priority: 'high',
    due: null,
    createdBy: 'matthieu',
    assignedTo: ['matthieu', 'william'],
    createdAt: now - day * 20,
    updatedAt: now - day * 5,
    completedAt: now - day * 5,
    notes: '',
    archived: false,
    archivedAt: null,
    subtasks: [],
    favorite: false,
    deletedAt: null,
    reviewValidatedBy: 'william',
    reviewValidatedAt: now - day * 4,
  },
  {
    id: 'done-2',
    title: 'Rédaction de la documentation API v2',
    project: 'INFRA',
    status: 'done',
    priority: 'med',
    due: null,
    createdBy: 'sandro',
    assignedTo: ['sandro'],
    createdAt: now - day * 15,
    updatedAt: now - day * 3,
    completedAt: now - day * 3,
    notes: '',
    archived: false,
    archivedAt: null,
    subtasks: [],
    favorite: false,
    deletedAt: null,
  },
  {
    id: 'done-3',
    title: 'Optimisation des requêtes SQL critiques',
    project: 'PROJET BETA',
    status: 'done',
    priority: 'high',
    due: null,
    createdBy: 'william',
    assignedTo: ['matteo', 'sandro'],
    createdAt: now - day * 25,
    updatedAt: now - day * 8,
    completedAt: now - day * 8,
    notes: '',
    archived: false,
    archivedAt: null,
    subtasks: [],
    favorite: false,
    deletedAt: null,
    reviewValidatedBy: 'william',
    reviewValidatedAt: now - day * 7,
  },
  {
    id: 'done-4',
    title: 'Formation équipe sur les nouveaux outils',
    project: 'PROJET BETA',
    status: 'done',
    priority: 'low',
    due: null,
    createdBy: 'laurent',
    assignedTo: ['laurent'],
    createdAt: now - day * 10,
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

// La tâche done du mockData standard
const standardDoneTask = mockTasks.find(t => t.status === 'done')!;

const meta: Meta = {
  title: 'Views/TermineesView',
  parameters: { layout: 'fullscreen' },
};

export default meta;

export const AvecTachesTerminees: StoryObj = {
  name: 'Avec tâches terminées (multi-projets)',
  render: () => {
    useStore.setState({
      tasks: [...mockTasks.filter(t => t.status !== 'done'), standardDoneTask, ...doneTasks],
      users: [
        { id: 'matthieu', name: 'Matthieu Maurel', email: 'matthieu@test.fr' },
        { id: 'william', name: 'William Cresson', email: 'william@test.fr' },
        { id: 'sandro', name: 'Sandro Menardi', email: 'sandro@test.fr' },
        { id: 'matteo', name: 'Matteo Voltarel', email: 'matteo@test.fr' },
        { id: 'laurent', name: 'Laurent Marques', email: 'laurent@test.fr' },
      ],
    });
    return (
      <div className="flex flex-col h-screen bg-slate-900">
        <TermineesView onTaskClick={() => {}} />
      </div>
    );
  },
};

export const UnSeulProjet: StoryObj = {
  name: 'Un seul projet terminé',
  render: () => {
    useStore.setState({
      tasks: [standardDoneTask, doneTasks[0], doneTasks[1]],
      users: [
        { id: 'matthieu', name: 'Matthieu Maurel', email: 'matthieu@test.fr' },
        { id: 'william', name: 'William Cresson', email: 'william@test.fr' },
      ],
    });
    return (
      <div className="flex flex-col h-screen bg-slate-900">
        <TermineesView onTaskClick={() => {}} />
      </div>
    );
  },
};

export const Vide: StoryObj = {
  name: 'Aucune tâche terminée',
  render: () => {
    useStore.setState({
      tasks: mockTasks.filter(t => t.status !== 'done'),
    });
    return (
      <div className="flex flex-col h-screen bg-slate-900">
        <TermineesView onTaskClick={() => {}} />
      </div>
    );
  },
};
