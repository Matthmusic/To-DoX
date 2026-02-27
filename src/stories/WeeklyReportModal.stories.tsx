import type { Meta, StoryObj } from '@storybook/react';
import { WeeklyReportModal } from '../components/WeeklyReportModal';
import useStore from '../store/useStore';
import { mockTasks } from './mockData';

const meta: Meta<typeof WeeklyReportModal> = {
  title: 'Components/WeeklyReportModal',
  component: WeeklyReportModal,
  parameters: { layout: 'fullscreen' },
  args: { onClose: () => {} },
};

export default meta;
type Story = StoryObj<typeof WeeklyReportModal>;

export const WithTasks: Story = {
  name: 'Rapport avec tâches terminées',
  decorators: [
    (Story) => {
      useStore.setState({ tasks: mockTasks, currentUser: 'matthieu' });
      return Story();
    },
  ],
};

export const NoCompletedTasks: Story = {
  name: 'Semaine vide (aucune tâche terminée)',
  decorators: [
    (Story) => {
      useStore.setState({
        tasks: mockTasks.filter(t => t.status !== 'done'),
        currentUser: 'matthieu',
      });
      return Story();
    },
  ],
};

export const NoUser: Story = {
  name: 'Sans utilisateur connecté',
  decorators: [
    (Story) => {
      useStore.setState({ tasks: mockTasks, currentUser: null });
      return Story();
    },
  ],
};
