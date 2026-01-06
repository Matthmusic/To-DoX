const { app, BrowserWindow, ipcMain, shell, nativeTheme, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs').promises;
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

// Forcer le thème dark
nativeTheme.themeSource = 'dark';

// Configuration de l'auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#030513', // Fond dark mode par défaut
    frame: false, // Enlève la barre de titre native
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'src/assets/icon.ico'),
    title: 'To-DoX - Gestion de tâches intelligente'
  });

  // Charger l'application
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // Ouvrir les liens externes dans le navigateur
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Gestion du cycle de vie de l'app
app.whenReady().then(() => {
  createWindow();

  // Vérifier les mises à jour au démarrage (seulement en production)
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 3000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Gestion des événements de mise à jour
autoUpdater.on('checking-for-update', () => {
  console.log('Vérification des mises à jour...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Mise à jour disponible:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes
    });
  }
});

autoUpdater.on('update-not-available', () => {
  console.log('Application à jour');
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`Téléchargement: ${Math.round(progressObj.percent)}%`);
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Mise à jour téléchargée, redémarrage...');
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', {
      version: info.version
    });
  }
});

autoUpdater.on('error', (error) => {
  console.error('Erreur lors de la mise à jour:', error);
  if (mainWindow) {
    mainWindow.webContents.send('update-error', {
      message: error.message
    });
  }
});

// IPC handlers pour contrôler les mises à jour depuis le renderer
ipcMain.handle('check-for-updates', async () => {
  if (!isDev) {
    try {
      const result = await autoUpdater.checkForUpdates();
      return result;
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      return null;
    }
  }
  return null;
});

ipcMain.handle('download-update', async () => {
  if (!isDev) {
    try {
      await autoUpdater.downloadUpdate();
      return true;
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      return false;
    }
  }
  return false;
});

ipcMain.handle('install-update', () => {
  if (!isDev) {
    autoUpdater.quitAndInstall(false, true);
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Handler pour ouvrir des dossiers locaux
ipcMain.handle('open-folder', async (event, folderPath) => {
  try {
    await shell.openPath(folderPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Contrôles de la fenêtre personnalisée
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return mainWindow.isMaximized();
  }
  return false;
});

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// Handler pour ouvrir une URL externe (PDF blob)
ipcMain.handle('open-external-url', async (_event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Gestion du stockage de fichiers
const os = require('os');

// Obtenir le chemin OneDrive par défaut
function getDefaultOneDrivePath() {
  const userProfile = os.homedir();
  const oneDrivePath = path.join(userProfile, 'OneDrive - CEA', 'DATA', 'To-Do-X');
  return oneDrivePath;
}

// Créer le dossier s'il n'existe pas
async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error('Erreur lors de la création du dossier:', error);
    return false;
  }
}

// Handler pour obtenir le chemin de stockage par défaut
ipcMain.handle('get-storage-path', () => {
  return getDefaultOneDrivePath();
});

// Handler pour lire les données
ipcMain.handle('read-data', async (event, filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return { success: true, data: JSON.parse(data) };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Fichier n'existe pas encore, c'est normal
      return { success: true, data: null };
    }
    console.error('Erreur lors de la lecture:', error);
    return { success: false, error: error.message };
  }
});

// Handler pour sauvegarder les données
ipcMain.handle('save-data', async (event, filePath, data) => {
  try {
    const dirPath = path.dirname(filePath);
    await ensureDirectory(dirPath);

    // Sauvegarder le fichier principal
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

    // Créer une sauvegarde horodatée (conserver les 5 dernières)
    const backupDir = path.join(dirPath, 'backups');
    await ensureDirectory(backupDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = path.join(backupDir, `backup-${timestamp}.json`);
    await fs.writeFile(backupPath, JSON.stringify(data, null, 2), 'utf-8');

    // Nettoyer les anciennes sauvegardes (garder les 5 plus récentes)
    const backups = await fs.readdir(backupDir);
    const sortedBackups = backups
      .filter(f => f.startsWith('backup-'))
      .sort()
      .reverse();

    for (let i = 5; i < sortedBackups.length; i++) {
      await fs.unlink(path.join(backupDir, sortedBackups[i]));
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    return { success: false, error: error.message };
  }
});

// Handler pour choisir un dossier personnalisé
ipcMain.handle('choose-storage-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choisir le dossier de stockage',
    defaultPath: getDefaultOneDrivePath()
  });

  if (result.canceled) {
    return { success: false, canceled: true };
  }

  return { success: true, path: result.filePaths[0] };
});

// Handler pour sélectionner un dossier projet
ipcMain.handle('select-project-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Sélectionner le dossier du projet'
  });

  if (result.canceled) {
    return { success: false, canceled: true };
  }

  const folderPath = result.filePaths[0];
  const folderName = path.basename(folderPath);

  return { success: true, path: folderPath, name: folderName };
});
