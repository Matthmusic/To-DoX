import type { Meta, StoryObj } from '@storybook/react';
import { TimesheetView } from '../components/TimesheetView';
import useStore from '../store/useStore';
import { mockTasks } from './mockData';

// Semaine courante (lundi)
function getMonday(offset = 0): string {
  const today = new Date();
  const dow = today.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday + offset * 7);
  return monday.toISOString().split('T')[0];
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

const monday = getMonday();

const now = Date.now();

const mockTimeEntries = [
  // Matthieu - semaine courante
  { id: 'te-1', project: 'PROJET ALPHA', date: monday, hours: 3, userId: 'matthieu', createdAt: now, updatedAt: now },
  { id: 'te-2', project: 'PROJET BETA', date: monday, hours: 2, userId: 'matthieu', createdAt: now, updatedAt: now },
  { id: 'te-3', project: 'PROJET ALPHA', date: addDays(monday, 1), hours: 4, userId: 'matthieu', createdAt: now, updatedAt: now },
  { id: 'te-4', project: 'REFONTE UI', date: addDays(monday, 1), hours: 4, userId: 'matthieu', createdAt: now, updatedAt: now },
  { id: 'te-5', project: 'PROJET BETA', date: addDays(monday, 2), hours: 7.5, userId: 'matthieu', createdAt: now, updatedAt: now },
  { id: 'te-6', project: 'PROJET ALPHA', date: addDays(monday, 3), hours: 3.5, userId: 'matthieu', createdAt: now, updatedAt: now },
  { id: 'te-7', project: 'REFONTE UI', date: addDays(monday, 3), hours: 3.5, userId: 'matthieu', createdAt: now, updatedAt: now },
  { id: 'te-8', project: 'PROJET ALPHA', date: addDays(monday, 4), hours: 2, userId: 'matthieu', createdAt: now, updatedAt: now },
  { id: 'te-9', project: 'INFRA', date: addDays(monday, 4), hours: 6, userId: 'matthieu', createdAt: now, updatedAt: now },
];

const meta: Meta<typeof TimesheetView> = {
  title: 'Views/TimesheetView',
  component: TimesheetView,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof TimesheetView>;

export const AvecPointages: Story = {
  name: 'Semaine avec pointages saisis',
  render: () => {
    useStore.setState({
      currentUser: 'matthieu',
      viewAsUser: null,
      tasks: mockTasks,
      timeEntries: mockTimeEntries,
      users: [
        { id: 'matthieu', name: 'Matthieu Maurel', email: 'matthieu@test.fr' },
        { id: 'william', name: 'William Cresson', email: 'william@test.fr' },
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
        <TimesheetView />
      </div>
    );
  },
};

export const SemaineSansPointages: Story = {
  name: 'Semaine vide (aucun pointage)',
  render: () => {
    useStore.setState({
      currentUser: 'matthieu',
      viewAsUser: null,
      tasks: mockTasks,
      timeEntries: [],
      users: [
        { id: 'matthieu', name: 'Matthieu Maurel', email: 'matthieu@test.fr' },
      ],
      projectColors: {
        'PROJET ALPHA': 0,
        'PROJET BETA': 1,
        'REFONTE UI': 2,
      },
    });
    return (
      <div className="flex flex-col h-screen bg-slate-900">
        <TimesheetView />
      </div>
    );
  },
};

export const NonConnecte: Story = {
  name: 'Non connecté',
  render: () => {
    useStore.setState({
      currentUser: null,
      viewAsUser: null,
      tasks: mockTasks,
      timeEntries: [],
      users: [
        { id: 'matthieu', name: 'Matthieu Maurel', email: 'matthieu@test.fr' },
      ],
    });
    return (
      <div className="flex flex-col h-screen bg-slate-900">
        <TimesheetView />
      </div>
    );
  },
};

export const VueAdmin: Story = {
  name: 'Vue en tant que (admin)',
  render: () => {
    useStore.setState({
      currentUser: 'matthieu',
      viewAsUser: 'william',
      tasks: mockTasks,
      timeEntries: [
        { id: 'te-w1', project: 'PROJET BETA', date: monday, hours: 4, userId: 'william', createdAt: now, updatedAt: now },
        { id: 'te-w2', project: 'INFRA', date: addDays(monday, 1), hours: 7, userId: 'william', createdAt: now, updatedAt: now },
      ],
      users: [
        { id: 'matthieu', name: 'Matthieu Maurel', email: 'matthieu@test.fr' },
        { id: 'william', name: 'William Cresson', email: 'william@test.fr' },
      ],
      projectColors: {
        'PROJET ALPHA': 0,
        'PROJET BETA': 1,
        'INFRA': 3,
      },
    });
    return (
      <div className="flex flex-col h-screen bg-slate-900">
        <TimesheetView />
      </div>
    );
  },
};
