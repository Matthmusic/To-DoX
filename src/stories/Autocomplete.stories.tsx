import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Autocomplete } from '../components/Autocomplete';
import { FIXED_USERS } from '../constants';

// Wrapper pour gérer le state dans les stories
function UserAutocomplete({ onChange = () => {} }: { onChange?: (id: string) => void }) {
  const [value, setValue] = useState('matthieu');
  return (
    <div className="w-72">
      <Autocomplete<typeof FIXED_USERS[0], string>
        value={value}
        onChange={(v) => { setValue(v); onChange(v); }}
        options={FIXED_USERS.filter(u => u.id !== 'unassigned')}
        getValue={(u) => u.id}
        getLabel={(u) => u.name}
        placeholder="Sélectionner un utilisateur…"
      />
    </div>
  );
}

function StringAutocomplete({ onChange = () => {} }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState('');
  const options = ['PROJET ALPHA', 'PROJET BETA', 'REFONTE UI', 'MAINTENANCE', 'R&D'];
  return (
    <div className="w-72">
      <Autocomplete<string, string>
        value={value}
        onChange={(v) => { setValue(v); onChange(v); }}
        options={options}
        getValue={(s) => s}
        getLabel={(s) => s}
        placeholder="Sélectionner un projet…"
      />
    </div>
  );
}

function EmptyAutocomplete() {
  const [value, setValue] = useState('');
  return (
    <div className="w-72">
      <Autocomplete<string, string>
        value={value}
        onChange={setValue}
        options={[]}
        getValue={(s) => s}
        getLabel={(s) => s}
        placeholder="Aucune option disponible…"
      />
    </div>
  );
}

const meta: Meta = {
  title: 'UI/Autocomplete',
  parameters: {
    layout: 'padded',
  },
};

export default meta;

export const WithUsers: StoryObj = {
  name: 'Avec objets (utilisateurs)',
  render: () => <UserAutocomplete />,
};

export const WithStrings: StoryObj = {
  name: 'Avec chaînes (projets)',
  render: () => <StringAutocomplete />,
};

export const Empty: StoryObj = {
  name: 'Sans options',
  render: () => <EmptyAutocomplete />,
};
