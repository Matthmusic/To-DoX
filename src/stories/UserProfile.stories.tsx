import type { Meta, StoryObj } from '@storybook/react';
import { UserProfile } from '../components/UserProfile';
import useStore from '../store/useStore';

const meta: Meta<typeof UserProfile> = {
  title: 'User/UserProfile',
  component: UserProfile,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof UserProfile>;

export const LoggedIn: Story = {
  name: 'Utilisateur connecté',
  decorators: [
    (Story) => {
      useStore.setState({ currentUser: 'matthieu' });
      return Story();
    },
  ],
};

export const NoUser: Story = {
  name: 'Aucun utilisateur connecté',
  decorators: [
    (Story) => {
      useStore.setState({ currentUser: null });
      return Story();
    },
  ],
};

export const DifferentUser: Story = {
  name: 'Autre utilisateur (Sandro)',
  decorators: [
    (Story) => {
      useStore.setState({ currentUser: 'sandro' });
      return Story();
    },
  ],
};
