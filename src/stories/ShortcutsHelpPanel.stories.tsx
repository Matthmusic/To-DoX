import type { Meta, StoryObj } from '@storybook/react';
import { ShortcutsHelpPanel } from '../components/ShortcutsHelpPanel';
import type { ShortcutConfig } from '../hooks/useKeyboardShortcuts';

const shortcuts: ShortcutConfig[] = [
  // UI
  { key: 'n', ctrl: true, description: 'Nouvelle tâche (focus QuickAdd)', category: 'ui', action: () => {} },
  { key: 'f', ctrl: true, description: 'Afficher/masquer la recherche', category: 'ui', action: () => {} },
  { key: 'F1', description: 'Afficher l\'aide des raccourcis', category: 'ui', action: () => {} },
  { key: 'Escape', description: 'Fermer panel / modal / recherche', category: 'ui', action: () => {} },
  // Actions
  { key: 'e', ctrl: true, description: 'Export rapide JSON', category: 'actions', action: () => {} },
  { key: 'a', ctrl: true, shift: true, description: 'Ouvrir archives tâches', category: 'actions', action: () => {} },
  { key: 'p', ctrl: true, shift: true, description: 'Ouvrir liste des projets', category: 'actions', action: () => {} },
  // Navigation
  { key: 'ArrowLeft', ctrl: true, description: 'Colonne précédente', category: 'navigation', action: () => {} },
  { key: 'ArrowRight', ctrl: true, description: 'Colonne suivante', category: 'navigation', action: () => {} },
];

const meta: Meta<typeof ShortcutsHelpPanel> = {
  title: 'Feedback/ShortcutsHelpPanel',
  component: ShortcutsHelpPanel,
  parameters: { layout: 'fullscreen' },
  args: {
    onClose: () => {},
    shortcuts,
  },
};

export default meta;
type Story = StoryObj<typeof ShortcutsHelpPanel>;

export const Default: Story = {
  name: 'Panel d\'aide complet',
};

export const FewShortcuts: Story = {
  name: 'Peu de raccourcis',
  args: {
    shortcuts: shortcuts.slice(0, 3),
  },
};
