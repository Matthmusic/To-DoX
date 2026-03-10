import type { Preview, Decorator } from '@storybook/react';
import '../src/index.css';
import useStore from '../src/store/useStore';
import { FIXED_USERS } from '../src/constants';
import { mockTasks } from '../src/stories/mockData';
import { DEFAULT_THEME } from '../src/themes/presets';

// Mock window.electronAPI globally (Storybook runs in browser, pas Electron)
if (typeof window !== 'undefined') {
  window.electronAPI = {
    isElectron: false,
    readData: async () => ({ success: true, data: { tasks: [], directories: {}, projectHistory: [], projectColors: {}, users: [], storagePath: null, notificationSettings: undefined as never, themeSettings: undefined as never } }),
    saveData: async () => ({ success: true }),
    getStoragePath: async () => '~/OneDrive/DATA/To-Do-X',
    getFileHash: async () => ({ success: true, hash: null }),
    chooseStorageFolder: async () => ({ success: false }),
    openFolder: async () => {},
    openExternalUrl: async () => {},
    printHtml: async () => {},
    checkForUpdates: async () => ({ version: '2.0.2' }),
    downloadUpdate: async () => true,
    installUpdate: () => {},
    getAppVersion: async () => '2.0.2',
    getSoundUrl: async () => ({ success: false }),
    onUpdateAvailable: () => {},
    onDownloadProgress: () => {},
    onUpdateDownloaded: () => {},
    onUpdateError: () => {},
    windowMinimize: async () => {},
    windowMaximize: async () => false,
    windowClose: async () => {},
    windowIsMaximized: async () => false,
    selectProjectFolder: async () => ({ success: false, canceled: true }),
    sendNotification: async () => {},
    requestNotificationPermission: async () => false,
    logError: async () => ({ success: true }),
    setNativeTheme: async () => true,
    getSystemTheme: async () => 'dark',
    onSystemThemeChanged: () => {},
  };
}

// Décorateur global : initialise le store Zustand avec des données de démo
const withStore: Decorator = (Story) => {
  useStore.setState({
    tasks: mockTasks,
    users: FIXED_USERS,
    projectColors: { 'PROJET ALPHA': 0, 'PROJET BETA': 2, 'REFONTE UI': 5 },
    projectHistory: ['PROJET ALPHA', 'PROJET BETA', 'REFONTE UI', 'MAINTENANCE'],
    currentUser: 'matthieu',
    isLoadingData: false,
    themeSettings: {
      mode: 'dark',
      activeThemeId: DEFAULT_THEME.id,
      customThemes: [],
      customAccentColor: undefined,
    },
  });
  return Story();
};

const preview: Preview = {
  decorators: [withStore],

  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date/ } },
    backgrounds: {
      options: {
        "cyberpunk-dark": { name: 'cyberpunk-dark', value: '#050b1f' },
        card: { name: 'card', value: '#0a0e1a' }
      }
    },
  },

  initialGlobals: {
    backgrounds: {
      value: 'cyberpunk-dark'
    }
  }
};

export default preview;
