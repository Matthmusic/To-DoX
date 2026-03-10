import type { Meta, StoryObj } from '@storybook/react';
import { DashboardView } from '../components/DashboardView';
import useStore from '../store/useStore';
import type { Task } from '../types';

const now = Date.now();
const day = 86400000;
const iso = (offset: number) => new Date(now + offset * day).toISOString().split('T')[0];

/** Jeu de tâches riche couvrant plusieurs projets, statuts et utilisateurs */
const richTasks: Task[] = [
  // ── PROJET ALPHA ──
  { id: 'd1', title: 'Réviser les specs d\'authentification', project: 'PROJET ALPHA', status: 'todo', priority: 'high', due: iso(5), createdBy: 'matthieu', assignedTo: ['matthieu', 'william'], createdAt: now - day * 3, updatedAt: now - day, completedAt: null, notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null },
  { id: 'd2', title: 'Intégrer les retours client dashboard', project: 'PROJET ALPHA', status: 'doing', priority: 'med', due: iso(2), createdBy: 'william', assignedTo: ['matthieu'], createdAt: now - day * 7, updatedAt: now - day * 2, completedAt: null, notes: 'Voir doc partagé.', archived: false, archivedAt: null, subtasks: [{ id: 's1', title: 'Modifier graphiques', completed: true, createdAt: now, completedAt: now, completedBy: 'matthieu' }, { id: 's2', title: 'Tester sur mobile', completed: false, createdAt: now, completedAt: null, completedBy: null }], favorite: true, deletedAt: null },
  { id: 'd3', title: 'Rédiger la documentation API v3', project: 'PROJET ALPHA', status: 'doing', priority: 'low', due: iso(8), createdBy: 'matthieu', assignedTo: ['william'], createdAt: now - day * 4, updatedAt: now - day, completedAt: null, notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null },
  { id: 'd4', title: 'Tests d\'intégration module paiement', project: 'PROJET ALPHA', status: 'review', priority: 'high', due: iso(-2), createdBy: 'matthieu', assignedTo: ['matteo'], createdAt: now - day * 10, updatedAt: now - day * 3, completedAt: null, notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null },
  { id: 'd5', title: 'Déploiement infrastructure staging', project: 'PROJET ALPHA', status: 'done', priority: 'high', due: null, createdBy: 'matthieu', assignedTo: ['matthieu', 'sandro'], createdAt: now - day * 20, updatedAt: now - day * 2, completedAt: now - day * 2, notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null },

  // ── PROJET BETA ──
  { id: 'd6', title: 'Migrer la BDD vers PostgreSQL', project: 'PROJET BETA', status: 'doing', priority: 'high', due: iso(7), createdBy: 'sandro', assignedTo: ['sandro', 'matteo'], createdAt: now - day * 10, updatedAt: now - day * 8, completedAt: null, notes: '', archived: false, archivedAt: null, subtasks: [{ id: 's3', title: 'Scripts de migration', completed: true, createdAt: now, completedAt: now, completedBy: 'sandro' }, { id: 's4', title: 'Tests staging', completed: false, createdAt: now, completedAt: null, completedBy: null }], favorite: false, deletedAt: null },
  { id: 'd7', title: 'Audit sécurité API REST', project: 'PROJET BETA', status: 'review', priority: 'high', due: iso(-1), createdBy: 'matthieu', assignedTo: ['sandro'], createdAt: now - day * 14, updatedAt: now - day * 2, completedAt: null, notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null },
  { id: 'd8', title: 'Optimiser les requêtes lentes', project: 'PROJET BETA', status: 'todo', priority: 'med', due: iso(12), createdBy: 'sandro', assignedTo: ['matteo'], createdAt: now - day * 2, updatedAt: now - day, completedAt: null, notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null },
  { id: 'd9', title: 'Mise à jour des dépendances npm', project: 'PROJET BETA', status: 'done', priority: 'low', due: null, createdBy: 'matteo', assignedTo: ['matteo'], createdAt: now - day * 5, updatedAt: now - day * 1, completedAt: now - day * 1, notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null },

  // ── REFONTE UI ──
  { id: 'd10', title: 'Créer les maquettes Figma v2', project: 'REFONTE UI', status: 'doing', priority: 'med', due: iso(3), createdBy: 'william', assignedTo: ['william', 'matthieu'], createdAt: now - day * 5, updatedAt: now - day, completedAt: null, notes: '', archived: false, archivedAt: null, subtasks: [], favorite: true, deletedAt: null },
  { id: 'd11', title: 'Implémenter le nouveau design system', project: 'REFONTE UI', status: 'todo', priority: 'high', due: iso(14), createdBy: 'matthieu', assignedTo: ['william'], createdAt: now - day, updatedAt: now, completedAt: null, notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null },
  { id: 'd12', title: 'Tests accessibilité WCAG 2.1', project: 'REFONTE UI', status: 'todo', priority: 'low', due: iso(20), createdBy: 'william', assignedTo: ['matthieu'], createdAt: now - day * 2, updatedAt: now - day, completedAt: null, notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null },

  // ── INFRASTRUCTURE ──
  { id: 'd13', title: 'Configurer le pipeline CI/CD', project: 'INFRASTRUCTURE', status: 'doing', priority: 'high', due: iso(1), createdBy: 'sandro', assignedTo: ['sandro'], createdAt: now - day * 6, updatedAt: now - day, completedAt: null, notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null },
  { id: 'd14', title: 'Mettre en place les alertes monitoring', project: 'INFRASTRUCTURE', status: 'todo', priority: 'med', due: iso(6), createdBy: 'sandro', assignedTo: ['sandro', 'matteo'], createdAt: now - day * 3, updatedAt: now - day, completedAt: null, notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null },
  { id: 'd15', title: 'Upgrade serveur Node 20 → 22', project: 'INFRASTRUCTURE', status: 'done', priority: 'med', due: null, createdBy: 'sandro', assignedTo: ['sandro'], createdAt: now - day * 8, updatedAt: now - day * 3, completedAt: now - day * 3, notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null },

  // ── FORMATION ──
  { id: 'd16', title: 'Préparer les supports de formation React', project: 'FORMATION', status: 'todo', priority: 'low', due: iso(25), createdBy: 'matthieu', assignedTo: ['matthieu'], createdAt: now - day, updatedAt: now, completedAt: null, notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null },
  { id: 'd17', title: 'Planifier les sessions onboarding', project: 'FORMATION', status: 'doing', priority: 'med', due: iso(-3), createdBy: 'william', assignedTo: ['william'], createdAt: now - day * 5, updatedAt: now - day * 2, completedAt: null, notes: '', archived: false, archivedAt: null, subtasks: [], favorite: false, deletedAt: null },
];

const meta: Meta<typeof DashboardView> = {
  title: 'Views/DashboardView',
  component: DashboardView,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof DashboardView>;

export const Default: Story = {
  name: 'Vue d\'ensemble — données riches',
  render: () => {
    useStore.setState({
      tasks: richTasks,
      currentUser: 'matthieu',
      projectColors: {
        'PROJET ALPHA': 0,
        'PROJET BETA': 4,
        'REFONTE UI': 2,
        'INFRASTRUCTURE': 6,
        'FORMATION': 3,
      },
    });
    return (
      <div className="h-screen flex flex-col bg-theme-primary text-theme-primary">
        <DashboardView />
      </div>
    );
  },
};

export const FiltreMoi: Story = {
  name: 'Vue filtrée — Moi (matthieu)',
  render: () => {
    useStore.setState({
      tasks: richTasks,
      currentUser: 'matthieu',
      projectColors: { 'PROJET ALPHA': 0, 'PROJET BETA': 4, 'REFONTE UI': 2, 'INFRASTRUCTURE': 6, 'FORMATION': 3 },
    });
    return (
      <div className="h-screen flex flex-col bg-theme-primary text-theme-primary">
        <DashboardView />
      </div>
    );
  },
};

export const SansRetards: Story = {
  name: 'Vue sans retards',
  render: () => {
    const futureTasks = richTasks.map(t => ({
      ...t,
      due: t.due && t.due < new Date().toISOString().split('T')[0] ? iso(5) : t.due,
    }));
    useStore.setState({
      tasks: futureTasks,
      currentUser: 'matthieu',
      projectColors: { 'PROJET ALPHA': 0, 'PROJET BETA': 4, 'REFONTE UI': 2 },
    });
    return (
      <div className="h-screen flex flex-col bg-theme-primary text-theme-primary">
        <DashboardView />
      </div>
    );
  },
};

export const Vide: Story = {
  name: 'Vue vide — aucune tâche',
  render: () => {
    useStore.setState({ tasks: [], currentUser: 'matthieu', projectColors: {} });
    return (
      <div className="h-screen flex flex-col bg-theme-primary text-theme-primary">
        <DashboardView />
      </div>
    );
  },
};
