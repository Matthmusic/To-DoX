import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { DatePickerModal } from '../components/DatePickerModal';

function DatePickerWrapper({ initialValue = '' }: { initialValue?: string }) {
  const [isOpen, setIsOpen] = useState(true);
  const [value, setValue] = useState(initialValue);
  return (
    <div className="p-4 text-theme-secondary text-sm">
      <p>Date sélectionnée : <strong>{value || '(aucune)'}</strong></p>
      <button
        className="mt-2 rounded-lg bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
        onClick={() => setIsOpen(true)}
      >
        Ouvrir le picker
      </button>
      <DatePickerModal
        isOpen={isOpen}
        value={value}
        onSelect={(d) => { setValue(d); setIsOpen(false); }}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
}

const meta: Meta = {
  title: 'UI/DatePickerModal',
  parameters: { layout: 'fullscreen' },
};

export default meta;

export const Default: StoryObj = {
  name: 'Sans date pré-sélectionnée',
  render: () => <DatePickerWrapper />,
};

export const WithExistingDate: StoryObj = {
  name: 'Avec date existante',
  render: () => <DatePickerWrapper initialValue="2026-02-28" />,
};
