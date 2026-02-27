import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ProjectAutocomplete } from '../components/ProjectAutocomplete';

const projectHistory = ['PROJET ALPHA', 'PROJET BETA', 'REFONTE UI', 'MAINTENANCE', 'R&D'];

function ProjectAutocompleteWrapper({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <div className="flex flex-col gap-3 w-80">
      <ProjectAutocomplete
        value={value}
        onChange={setValue}
        projectHistory={projectHistory}
        placeholder="Nom du projet…"
      />
      {value && <p className="text-xs text-theme-muted">Projet : "{value}"</p>}
    </div>
  );
}

const meta: Meta = {
  title: 'UI/ProjectAutocomplete',
  parameters: { layout: 'centered' },
};

export default meta;

export const Empty: StoryObj = {
  name: 'Vide – historique disponible',
  render: () => <ProjectAutocompleteWrapper />,
};

export const WithValue: StoryObj = {
  name: 'Avec projet sélectionné',
  render: () => <ProjectAutocompleteWrapper initialValue="PROJET ALPHA" />,
};

export const NewProject: StoryObj = {
  name: 'Nouveau projet (hors historique)',
  render: () => <ProjectAutocompleteWrapper initialValue="NOUVEAU PROJET" />,
};

export const EmptyHistory: StoryObj = {
  name: 'Historique vide',
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="w-80">
        <ProjectAutocomplete
          value={value}
          onChange={setValue}
          projectHistory={[]}
          placeholder="Aucun projet récent…"
        />
      </div>
    );
  },
};
