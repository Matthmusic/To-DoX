const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Exposer les APIs Electron au renderer de manière sécurisée
contextBridge.exposeInMainWorld('electronAPI', {
  // Gestion des mises à jour
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getSoundUrl: (soundFile) => ipcRenderer.invoke('get-sound-url', soundFile),

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
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  printHtml: (htmlContent) => ipcRenderer.invoke('print-html', htmlContent),

  // Contrôles de la fenêtre
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Gestion du stockage de fichiers
  getStoragePath: () => ipcRenderer.invoke('get-storage-path'),
  readData: (filePath) => ipcRenderer.invoke('read-data', filePath),
  saveData: (filePath, data) => ipcRenderer.invoke('save-data', filePath, data),
  getFileHash: (filePath) => ipcRenderer.invoke('get-file-hash', filePath),
  chooseStorageFolder: () => ipcRenderer.invoke('choose-storage-folder'),
  selectProjectFolder: () => ipcRenderer.invoke('select-project-folder'),

  // Notifications desktop
  sendNotification: (title, body, tag) => ipcRenderer.invoke('send-notification', title, body, tag),
  requestNotificationPermission: () => ipcRenderer.invoke('request-notification-permission'),

  // Error logging
  logError: (errorLog) => ipcRenderer.invoke('log-error', errorLog),

  // Gestion des thèmes
  setNativeTheme: (source) => ipcRenderer.invoke('set-native-theme', source),
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onSystemThemeChanged: (callback) => {
    ipcRenderer.on('system-theme-changed', (event, data) => callback(data));
  },

  // Cast — Google Home / Chromecast
  castDiscover: () => ipcRenderer.invoke('cast:discover'),
  castLaunch: (host, port, appId) => ipcRenderer.invoke('cast:launch', host, port, appId),
  castGetReceiverUrl: () => ipcRenderer.invoke('cast:get-receiver-url'),

  // Récupérer le chemin natif d'un File (fonctionne aussi pour les dossiers)
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // Démarrage automatique avec Windows
  getLoginItem: () => ipcRenderer.invoke('get-login-item'),
  setLoginItem: (openAtLogin) => ipcRenderer.invoke('set-login-item', openAtLogin),

  // Outlook / ICS
  outlook: {
    fetchUrl: (url) => ipcRenderer.invoke('outlook:fetch-url', url),
    writeIcs: (filePath, content) => ipcRenderer.invoke('outlook:write-ics', filePath, content),
    getIcsPath: (storagePath) => ipcRenderer.invoke('outlook:get-ics-path', storagePath),
    startHttpServer: (icsPath) => ipcRenderer.invoke('outlook:start-http-server', icsPath),
    stopHttpServer: () => ipcRenderer.invoke('outlook:stop-http-server'),
    getServerUrl: () => ipcRenderer.invoke('outlook:get-server-url'),
    saveDroppedMail: (storagePath, fileName, bytes) => ipcRenderer.invoke('outlook:save-dropped-mail', storagePath, fileName, bytes),
  },

  // Vérifier si on est dans Electron
  isElectron: true
});
