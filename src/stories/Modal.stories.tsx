import type { Meta, StoryObj } from '@storybook/react';

import { Modal } from '../components/ui/Modal';

const meta: Meta<typeof Modal> = {
  title: 'UI/Modal',
  component: Modal,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    onClose: () => {},
    isOpen: true,
  },
};

export default meta;
type Story = StoryObj<typeof Modal>;

export const Default: Story = {
  name: 'Avec titre',
  args: {
    title: 'Titre de la modale',
    children: (
      <div className="p-4 space-y-3">
        <p className="text-theme-secondary text-sm">
          Contenu de la modale. Ici on peut placer n'importe quel composant React.
        </p>
        <p className="text-theme-muted text-xs">
          La modale utilise un React portal pour s'afficher au-dessus de tout le reste,
          avec une animation d'entrée/sortie Framer Motion.
        </p>
      </div>
    ),
  },
};

export const Wide: Story = {
  name: 'Large (max-w-3xl)',
  args: {
    title: 'Rapport hebdomadaire',
    width: 'max-w-3xl',
    children: (
      <div className="p-4">
        <p className="text-theme-secondary text-sm">Modale avec largeur étendue.</p>
      </div>
    ),
  },
};

export const NoTitle: Story = {
  name: 'Sans titre',
  args: {
    children: (
      <div className="p-6">
        <p className="text-theme-secondary text-sm">Modale sans titre – le bouton fermer est toujours présent.</p>
      </div>
    ),
  },
};

export const LongContent: Story = {
  name: 'Contenu scrollable',
  args: {
    title: 'Longue liste',
    children: (
      <div className="p-4 space-y-2">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="rounded-lg border border-white/10 p-3 text-theme-secondary text-sm">
            Élément {i + 1} — Lorem ipsum dolor sit amet consectetur.
          </div>
        ))}
      </div>
    ),
  },
};

export const Closed: Story = {
  name: 'Fermée (invisible)',
  args: {
    isOpen: false,
    title: 'Pas visible',
    children: <div />,
  },
};
