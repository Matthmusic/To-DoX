const { contextBridge, ipcRenderer } = require('electron');

// Exposer les APIs Electron au renderer de manière sécurisée
contextBridge.exposeInMainWorld('electronAPI', {
  // Gestion des mises à jour
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Listeners pour les événements de mise à jour
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, data) => callback(data));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, data) => callback(data));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (event, data) => callback(data));
  },

  // Utilitaires
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),

  // Contrôles de la fenêtre
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Gestion du stockage de fichiers
  getStoragePath: () => ipcRenderer.invoke('get-storage-path'),
  readData: (filePath) => ipcRenderer.invoke('read-data', filePath),
  saveData: (filePath, data) => ipcRenderer.invoke('save-data', filePath, data),
  chooseStorageFolder: () => ipcRenderer.invoke('choose-storage-folder'),
  selectProjectFolder: () => ipcRenderer.invoke('select-project-folder'),

  // Vérifier si on est dans Electron
  isElectron: true
});
