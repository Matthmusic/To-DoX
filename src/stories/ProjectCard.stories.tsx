import type { Meta, StoryObj } from '@storybook/react';

import { ProjectCard } from '../components/ProjectCard';
import { mockTasks } from './mockData';

const alphaTodo = mockTasks.filter(t => t.project === 'PROJET ALPHA' && t.status === 'todo');
const alphaDoing = mockTasks.filter(t => t.project === 'PROJET ALPHA' && t.status === 'doing');
const betaReview = mockTasks.filter(t => t.project === 'PROJET BETA' && t.status === 'review');

const meta: Meta<typeof ProjectCard> = {
  title: 'Components/ProjectCard',
  component: ProjectCard,
  parameters: {
    layout: 'padded',
  },
  args: {
    onToggleCollapse: () => {},
    onDragStartProject: () => {},
    onDragStartTask: () => {},
    onClickTask: () => {},
    onContextMenuTask: () => {},
    onSetProjectDirectory: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof ProjectCard>;

export const Default: Story = {
  name: 'Déplié – 2 tâches',
  args: {
    project: 'PROJET ALPHA',
    status: 'todo',
    tasks: alphaTodo,
    isCollapsed: false,
  },
};

export const Collapsed: Story = {
  name: 'Replié',
  args: {
    project: 'PROJET ALPHA',
    status: 'todo',
    tasks: alphaTodo,
    isCollapsed: true,
  },
};

export const WithDoingTasks: Story = {
  name: 'En cours – tâches avec sous-tâches',
  args: {
    project: 'PROJET ALPHA',
    status: 'doing',
    tasks: alphaDoing,
    isCollapsed: false,
  },
};

export const ReviewColumn: Story = {
  name: 'À réviser – tâche en retard',
  args: {
    project: 'PROJET BETA',
    status: 'review',
    tasks: betaReview,
    isCollapsed: false,
  },
};

export const Empty: Story = {
  name: 'Sans tâches',
  args: {
    project: 'PROJET GAMMA',
    status: 'todo',
    tasks: [],
    isCollapsed: false,
  },
};
