import type { Meta, StoryObj } from '@storybook/react';
import { KanbanHeaderPremium } from '../components/KanbanHeaderPremium';
import useStore from '../store/useStore';
import { mockTasks } from './mockData';

const noop = () => {};

const defaultArgs = {
  filterProject: '',
  onProjectClick: noop,
  onArchiveProject: noop,
  onOpenWeeklyReport: noop,
  onOpenStorage: noop,
  onOpenUsers: noop,
  onOpenArchive: noop,
  onOpenNotifications: noop,
  notificationsEnabled: true,
  onToggleNotifications: noop,
  onOpenThemes: noop,
  onOpenDirPanel: noop,
  onOpenProjectsList: noop,
  isAdmin: false,
  onOpenAdminProjects: noop,
  onOpenTaskArchive: noop,
  onExport: noop,
  onImport: noop,
  onOpenHelp: noop,
  mentionCount: 0,
  activeView: 'kanban' as const,
  onViewChange: noop,
  filterSearch: '',
  onSearchChange: noop,
  showSearch: false,
};

const meta: Meta<typeof KanbanHeaderPremium> = {
  title: 'Components/KanbanHeaderPremium',
  component: KanbanHeaderPremium,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => {
      useStore.setState({ tasks: mockTasks });
      return (
        <div className="bg-slate-900 min-h-screen">
          <Story />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof KanbanHeaderPremium>;

export const Default: Story = {
  name: 'Vue Kanban – défaut',
  args: defaultArgs,
};

export const VueTimeline: Story = {
  name: 'Vue Timeline active',
  args: { ...defaultArgs, activeView: 'timeline' },
};

export const VueDashboard: Story = {
  name: 'Vue Dashboard active',
  args: { ...defaultArgs, activeView: 'dashboard' },
};

export const VueTerminees: Story = {
  name: 'Vue Terminées active',
  args: { ...defaultArgs, activeView: 'terminées' },
};

export const VuePointage: Story = {
  name: 'Vue Pointage active',
  args: { ...defaultArgs, activeView: 'pointage' },
};

export const AvecMentions: Story = {
  name: 'Avec notifications non lues',
  args: { ...defaultArgs, mentionCount: 3 },
};

export const AvecRecherche: Story = {
  name: 'Recherche active',
  args: {
    ...defaultArgs,
    filterSearch: 'dashboard',
    showSearch: true,
  },
};

export const FiltreParProjet: Story = {
  name: 'Filtré par projet PROJET ALPHA',
  args: { ...defaultArgs, filterProject: 'PROJET ALPHA' },
};

export const ModeAdmin: Story = {
  name: 'Mode administrateur',
  args: { ...defaultArgs, isAdmin: true },
};

export const NotificationsDesactivees: Story = {
  name: 'Notifications désactivées',
  args: { ...defaultArgs, notificationsEnabled: false },
};
