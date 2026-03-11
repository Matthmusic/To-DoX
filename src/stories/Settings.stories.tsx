import type { Meta, StoryObj } from '@storybook/react';
import { NotificationsPanel } from '../components/settings/NotificationsPanel';
import { ProjectDirs } from '../components/settings/ProjectDirs';
import { ProjectsListPanel } from '../components/settings/ProjectsListPanel';
import { StoragePanel } from '../components/settings/StoragePanel';
import { ThemePanel } from '../components/settings/ThemePanel';
import { UsersPanel } from '../components/settings/UsersPanel';
import { TemplatesPanel } from '../components/settings/TemplatesPanel';
import useStore from '../store/useStore';
import { mockTasks } from './mockData';

const args = { onClose: () => {} };
const fullscreen = { layout: 'fullscreen' as const };

// ─── Notifications ──────────────────────────────────────────────────────────

const notifMeta: Meta<typeof NotificationsPanel> = {
  title: 'Settings/NotificationsPanel',
  component: NotificationsPanel,
  parameters: fullscreen,
  args,
};
export default notifMeta;

export const Notifications: StoryObj<typeof NotificationsPanel> = {
  name: 'Panneau Notifications',
};

// ─── ProjectDirs ─────────────────────────────────────────────────────────────

export const ProjectDirectories: StoryObj = {
  name: 'Panneau Répertoires projets',
  render: () => {
    useStore.setState({
      tasks: mockTasks,
      directories: { 'PROJET ALPHA': 'Z:\\B - AFFAIRES\\115 - ALPHA', 'PROJET BETA': '' },
    });
    return <ProjectDirs onClose={() => {}} />;
  },
};

// ─── ProjectsListPanel ───────────────────────────────────────────────────────

export const ProjectsList: StoryObj = {
  name: 'Panneau Gestion des projets',
  render: () => {
    useStore.setState({ tasks: mockTasks });
    return <ProjectsListPanel onClose={() => {}} />;
  },
};

// ─── StoragePanel ────────────────────────────────────────────────────────────

export const Storage: StoryObj = {
  name: 'Panneau Stockage',
  render: () => {
    useStore.setState({ storagePath: '~/OneDrive - CEA/DATA/To-Do-X' });
    return <StoragePanel onClose={() => {}} />;
  },
};

export const StorageNoPath: StoryObj = {
  name: 'Panneau Stockage – chemin non configuré',
  render: () => {
    useStore.setState({ storagePath: null });
    return <StoragePanel onClose={() => {}} />;
  },
};

// ─── ThemePanel ──────────────────────────────────────────────────────────────

export const Themes: StoryObj = {
  name: 'Panneau Thèmes',
  render: () => <ThemePanel onClose={() => {}} />,
};

// ─── UsersPanel ──────────────────────────────────────────────────────────────

export const Users: StoryObj = {
  name: 'Panneau Utilisateurs',
  render: () => <UsersPanel onClose={() => {}} />,
};

// ─── TemplatesPanel ──────────────────────────────────────────────────────────

export const Templates: StoryObj = {
  name: 'Panneau Templates – avec données',
  render: () => {
    useStore.setState({
      templates: [
        { id: 'tpl-1', name: 'Revue de code', subtaskTitles: ['Lire le PR', 'Tester localement', 'Laisser un commentaire', 'Approuver ou demander corrections'] },
        { id: 'tpl-2', name: 'Déploiement', subtaskTitles: ['Build production', 'Tests de non-régression', 'Mise en prod', 'Vérification monitoring'] },
        { id: 'tpl-3', name: 'Onboarding', subtaskTitles: ['Créer accès VPN', 'Créer compte GitLab', 'Présentation équipe'] },
      ],
    });
    return <TemplatesPanel onClose={() => {}} />;
  },
};

export const TemplatesEmpty: StoryObj = {
  name: 'Panneau Templates – vide',
  render: () => {
    useStore.setState({ templates: [] });
    return <TemplatesPanel onClose={() => {}} />;
  },
};
