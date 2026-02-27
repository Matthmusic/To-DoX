import type { Meta, StoryObj } from '@storybook/react';
import { LoginModal } from '../components/LoginModal';

const meta: Meta<typeof LoginModal> = {
  title: 'User/LoginModal',
  component: LoginModal,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof LoginModal>;

export const Default: Story = {
  name: 'Sélection utilisateur',
};
