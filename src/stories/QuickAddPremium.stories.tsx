import type { Meta, StoryObj } from '@storybook/react';
import { useRef } from 'react';
import { QuickAddPremium } from '../components/QuickAddPremium';

// Wrapper pour fournir la ref imperative handle
function QuickAddWrapper() {
  const ref = useRef<{ focus: () => void }>(null);
  return (
    <div className="w-full max-w-2xl p-4">
      <QuickAddPremium ref={ref} />
    </div>
  );
}

const meta: Meta = {
  title: 'Components/QuickAddPremium',
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'cyberpunk-dark',
    },
  },
};

export default meta;

export const Default: StoryObj = {
  name: 'Par défaut',
  render: () => <QuickAddWrapper />,
};
