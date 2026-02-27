import type { Meta, StoryObj } from '@storybook/react';

import { TaskCard } from '../components/TaskCard';
import { mockTasks } from './mockData';

const meta: Meta<typeof TaskCard> = {
  title: 'Components/TaskCard',
  component: TaskCard,
  parameters: {
    layout: 'padded',
  },
  args: {
    onDragStart: () => {},
    onClick: () => {},
    onContextMenu: () => {},
    onSetProjectDirectory: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof TaskCard>;

export const Todo: Story = {
  name: 'À faire – haute priorité',
  args: {
    task: mockTasks[0], // PROJET ALPHA, priority high, pas de deadline
  },
};

export const DoingWithDeadline: Story = {
  name: 'En cours – deadline dans 2 jours + sous-tâches',
  args: {
    task: mockTasks[2], // PROJET ALPHA, doing, med, 1/3 sous-tâches, favori
  },
};

export const DoingStale: Story = {
  name: 'En cours – stagnante depuis 8 jours',
  args: {
    task: mockTasks[3], // PROJET BETA, doing, high, 4 sous-tâches, pas de mouvement
  },
};

export const ReviewOverdue: Story = {
  name: 'À réviser – en retard + lien fichier',
  args: {
    task: mockTasks[4], // PROJET BETA, review, high, deadline hier, notes avec chemin fichier
  },
};

export const Done: Story = {
  name: 'Terminée – multi-assignés',
  args: {
    task: mockTasks[5], // REFONTE UI, done, high, 3 assignés
  },
};

export const LowPriority: Story = {
  name: 'Priorité basse – sans assigné',
  args: {
    task: mockTasks[1], // PROJET ALPHA, todo, low, 0 assignés
  },
};
