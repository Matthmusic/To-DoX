import type { Meta, StoryObj } from '@storybook/react';
import { ProjectArchivePanel } from '../components/archive/ProjectArchivePanel';
import { TaskArchivePanel } from '../components/archive/TaskArchivePanel';
import useStore from '../store/useStore';
import { mockTasks } from './mockData';
import type { Task } from '../types';

const now = Date.now();
const day = 86400000;

// Tâches archivées pour la démo
const archivedTasks: Task[] = [
  {
    id: 'arch-1',
    title: 'Mise en place de l\'environnement Docker',
    project: 'PROJET ALPHA',
    status: 'done',
    priority: 'high',
    due: null,
    createdBy: 'matthieu',
    assignedTo: ['matthieu'],
    createdAt: now - day * 60,
    updatedAt: now - day * 30,
    completedAt: now - day * 30,
    notes: '',
    archived: true,
    archivedAt: now - day * 28,
    subtasks: [],
    favorite: false,
    deletedAt: null,
  },
  {
    id: 'arch-2',
    title: 'Rédaction du cahier des charges v1',
    project: 'PROJET BETA',
    status: 'done',
    priority: 'med',
    due: null,
    createdBy: 'william',
    assignedTo: ['william', 'matthieu'],
    createdAt: now - day * 90,
    updatedAt: now - day * 45,
    completedAt: now - day * 45,
    notes: '',
    archived: true,
    archivedAt: now - day * 40,
    subtasks: [],
    favorite: false,
    deletedAt: null,
  },
  {
    id: 'arch-3',
    title: 'Prototype interface mobile',
    project: 'REFONTE UI',
    status: 'done',
    priority: 'low',
    due: null,
    createdBy: 'matteo',
    assignedTo: ['matteo'],
    createdAt: now - day * 120,
    updatedAt: now - day * 60,
    completedAt: now - day * 60,
    notes: '',
    archived: true,
    archivedAt: now - day * 55,
    subtasks: [],
    favorite: false,
    deletedAt: null,
  },
];

const meta: Meta = {
  title: 'Archive',
  parameters: { layout: 'fullscreen' },
};

export default meta;

export const ArchivedTasks: StoryObj = {
  name: 'TaskArchivePanel – tâches archivées',
  render: () => {
    useStore.setState({ tasks: [...mockTasks, ...archivedTasks] });
    return <TaskArchivePanel onClose={() => {}} />;
  },
};

export const ArchivedTasksEmpty: StoryObj = {
  name: 'TaskArchivePanel – aucune tâche archivée',
  render: () => {
    useStore.setState({ tasks: mockTasks });
    return <TaskArchivePanel onClose={() => {}} />;
  },
};

export const ArchivedProjects: StoryObj = {
  name: 'ProjectArchivePanel – projets archivés',
  render: () => {
    // Simuler un projet archivé : toutes ses tâches sont archived
    const archivedProjectTasks: Task[] = [
      {
        id: 'proj-arch-1',
        title: 'Feature A finalisée',
        project: 'ANCIEN PROJET',
        status: 'done',
        priority: 'med',
        due: null,
        createdBy: 'matthieu',
        assignedTo: [],
        createdAt: now - day * 200,
        updatedAt: now - day * 100,
        completedAt: now - day * 100,
        notes: '',
        archived: true,
        archivedAt: now - day * 90,
        subtasks: [],
        favorite: false,
        deletedAt: null,
      },
    ];
    useStore.setState({ tasks: [...mockTasks, ...archivedProjectTasks] });
    return <ProjectArchivePanel onClose={() => {}} />;
  },
};

export const ArchivedProjectsEmpty: StoryObj = {
  name: 'ProjectArchivePanel – aucun projet archivé',
  render: () => {
    useStore.setState({ tasks: mockTasks });
    return <ProjectArchivePanel onClose={() => {}} />;
  },
};
