import type { Meta, StoryObj } from '@storybook/react';
import { TaskEditPanel } from '../components/TaskEditPanel';
import { mockTasks } from './mockData';

const meta: Meta<typeof TaskEditPanel> = {
  title: 'Components/TaskEditPanel',
  component: TaskEditPanel,
  parameters: { layout: 'fullscreen' },
  args: {
    position: { x: 300, y: 200 },
    onClose: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof TaskEditPanel>;

export const TodoTask: Story = {
  name: 'Tâche À faire',
  args: { task: mockTasks[0] },
};

export const DoingTask: Story = {
  name: 'Tâche En cours – avec sous-tâches',
  args: { task: mockTasks[2] },
};

export const ReviewOverdue: Story = {
  name: 'Tâche En retard',
  args: { task: mockTasks[4] },
};

export const DoneTask: Story = {
  name: 'Tâche Terminée',
  args: { task: mockTasks[5] },
};

export const NearEdge: Story = {
  name: 'Positionné en bas à droite (overflow)',
  args: {
    task: mockTasks[0],
    position: { x: window.innerWidth - 100, y: window.innerHeight - 100 },
  },
};
