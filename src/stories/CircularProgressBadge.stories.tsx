import type { Meta, StoryObj } from '@storybook/react';
import { CircularProgressBadge } from '../components/CircularProgressBadge';

const projectColors = { 'PROJET ALPHA': 0, 'PROJET BETA': 2, 'REFONTE UI': 5 };

const meta: Meta<typeof CircularProgressBadge> = {
  title: 'UI/CircularProgressBadge',
  component: CircularProgressBadge,
  parameters: { layout: 'centered' },
  args: {
    projectColors,
    onClick: () => {},
    isSelected: false,
  },
};

export default meta;
type Story = StoryObj<typeof CircularProgressBadge>;

export const Empty: Story = {
  name: '0% – aucune tâche terminée',
  args: { project: 'PROJET ALPHA', percentage: 0, total: 5, done: 0 },
};

export const InProgress: Story = {
  name: '33% – en cours',
  args: { project: 'PROJET ALPHA', percentage: 33, total: 6, done: 2 },
};

export const MostlyDone: Story = {
  name: '75% – presque terminé',
  args: { project: 'PROJET BETA', percentage: 75, total: 8, done: 6 },
};

export const Complete: Story = {
  name: '100% – tout terminé',
  args: { project: 'REFONTE UI', percentage: 100, total: 4, done: 4 },
};

export const Selected: Story = {
  name: 'Sélectionné (filtre actif)',
  args: { project: 'PROJET ALPHA', percentage: 50, total: 4, done: 2, isSelected: true },
};
