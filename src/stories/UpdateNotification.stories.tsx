import type { Meta, StoryObj } from '@storybook/react';
import { UpdateNotification } from '../components/UpdateNotification';

// Pour simuler les états de mise à jour, on override les callbacks electronAPI dans des décorateurs
const withUpdateAvailable = (Story: () => React.ReactElement) => {
  if (window.electronAPI) {
    window.electronAPI.isElectron = true;
    window.electronAPI.getAppVersion = async () => '2.0.2';
    window.electronAPI.onUpdateAvailable = (cb) => {
      setTimeout(() => cb({ version: '2.1.0', releaseNotes: '## Nouveautés\n- **Vue Timeline** ajoutée\n- `Storybook` intégré\n- Corrections de bugs' }), 100);
    };
    window.electronAPI.onDownloadProgress = () => {};
    window.electronAPI.onUpdateDownloaded = () => {};
    window.electronAPI.onUpdateError = () => {};
  }
  return Story();
};

const withUpdateDownloaded = (Story: () => React.ReactElement) => {
  if (window.electronAPI) {
    window.electronAPI.isElectron = true;
    window.electronAPI.getAppVersion = async () => '2.0.2';
    window.electronAPI.onUpdateAvailable = () => {};
    window.electronAPI.onDownloadProgress = () => {};
    window.electronAPI.onUpdateDownloaded = (cb) => {
      setTimeout(() => cb({ version: '2.1.0' }), 100);
    };
    window.electronAPI.onUpdateError = () => {};
  }
  return Story();
};

const withNoElectron = (Story: () => React.ReactElement) => {
  if (window.electronAPI) {
    window.electronAPI.isElectron = false;
    window.electronAPI.onUpdateAvailable = () => {};
    window.electronAPI.onDownloadProgress = () => {};
    window.electronAPI.onUpdateDownloaded = () => {};
    window.electronAPI.onUpdateError = () => {};
  }
  return Story();
};

const meta: Meta<typeof UpdateNotification> = {
  title: 'Components/UpdateNotification',
  component: UpdateNotification,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof UpdateNotification>;

export const NoUpdate: Story = {
  name: 'Pas de mise à jour (mode web)',
  decorators: [withNoElectron],
};

export const UpdateAvailable: Story = {
  name: 'Mise à jour disponible',
  decorators: [withUpdateAvailable],
};

export const UpdateDownloaded: Story = {
  name: 'Mise à jour téléchargée – prête à installer',
  decorators: [withUpdateDownloaded],
};
