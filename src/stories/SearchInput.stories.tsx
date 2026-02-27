import type { Meta, StoryObj } from '@storybook/react';
import { useRef, useState } from 'react';
import { SearchInput } from '../components/SearchInput';

function SearchWrapper({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<{ focus: () => void }>(null);
  return (
    <div className="flex flex-col gap-3 w-72">
      <SearchInput ref={ref} value={value} onChange={setValue} placeholder="Rechercher…" />
      <div className="flex gap-2">
        <button
          className="rounded-lg bg-white/10 px-3 py-1 text-xs text-theme-secondary hover:bg-white/20"
          onClick={() => ref.current?.focus()}
        >
          Focus programmatique
        </button>
        <button
          className="rounded-lg bg-white/10 px-3 py-1 text-xs text-theme-secondary hover:bg-white/20"
          onClick={() => setValue('')}
        >
          Vider
        </button>
      </div>
      {value && <p className="text-xs text-theme-muted">Recherche : "{value}"</p>}
    </div>
  );
}

const meta: Meta = {
  title: 'UI/SearchInput',
  parameters: { layout: 'centered' },
};

export default meta;

export const Empty: StoryObj = {
  name: 'Vide',
  render: () => <SearchWrapper />,
};

export const WithValue: StoryObj = {
  name: 'Avec valeur',
  render: () => <SearchWrapper initialValue="audit API" />,
};
