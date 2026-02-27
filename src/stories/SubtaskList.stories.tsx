import type { Meta, StoryObj } from '@storybook/react';
import { SubtaskList } from '../components/SubtaskList';
import { mockTasks } from './mockData';

// task avec sous-tâches mixtes
const taskWithSubtasks = mockTasks[2]; // doing, 1/3 complétées
// task avec toutes les sous-tâches terminées
const taskAllDone = mockTasks[4]; // review, 2/2 complétées
// task avec beaucoup de sous-tâches
const taskManySubtasks = mockTasks[3]; // doing, 0/4 complétées
// task sans sous-tâches
const taskNoSubtasks = mockTasks[0];

const meta: Meta<typeof SubtaskList> = {
  title: 'Components/SubtaskList',
  component: SubtaskList,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof SubtaskList>;

export const MixedCompletion: Story = {
  name: '1/3 complétées',
  args: { task: taskWithSubtasks },
};

export const AllDone: Story = {
  name: '2/2 – toutes terminées',
  args: { task: taskAllDone },
};

export const NoneCompleted: Story = {
  name: '0/4 – aucune terminée',
  args: { task: taskManySubtasks },
};

export const NoSubtasks: Story = {
  name: 'Sans sous-tâches (formulaire vide)',
  args: { task: taskNoSubtasks },
};
