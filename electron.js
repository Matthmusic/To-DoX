const { app, BrowserWindow, ipcMain, shell, nativeTheme, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const isDev = process.env.NODE_ENV === 'development';

// Charger autoUpdater seulement en production
let autoUpdater = null;
if (!isDev) {
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
}

let mainWindow;

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
    icon: path.join(__dirname, 'src/assets/icon.png'),
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
  // Forcer le thème dark
  nativeTheme.themeSource = 'dark';

  createWindow();

  // Vérifier les mises à jour au démarrage (seulement en production)
  if (!isDev && autoUpdater) {
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

// Gestion des événements de mise à jour (seulement en production)
if (autoUpdater) {
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
}

// IPC handlers pour contrôler les mises à jour depuis le renderer
ipcMain.handle('check-for-updates', async () => {
  if (!isDev && autoUpdater) {
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
  if (!isDev && autoUpdater) {
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
  if (!isDev && autoUpdater) {
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

// Handler pour imprimer du HTML directement
ipcMain.handle('print-html', async (_event, htmlContent) => {
  let printWindow = null;
  try {
    printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    await new Promise(resolve => {
      printWindow.webContents.on('did-finish-load', resolve);
    });

    // Ouvrir la boîte de dialogue d'impression Windows
    printWindow.webContents.print({
      silent: false,
      printBackground: true,
      deviceName: ''
    }, (success, errorType) => {
      if (!success) {
        console.error('Erreur d\'impression:', errorType);
      }
      printWindow.close();
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur lors de l\'impression:', error);
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.close();
    }
    return { success: false, error: error.message };
  }
});

// Gestion du stockage de fichiers
const os = require('os');
const lockfile = require('proper-lockfile');

// Obtenir le chemin de stockage par défaut (Z:\F - UTILITAIRES\TODOX)
function getDefaultOneDrivePath() {
  // Chemin du serveur partagé
  return 'Z:\\F - UTILITAIRES\\TODOX';
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
  const storagePath = getDefaultOneDrivePath();
  console.log('📂 [ELECTRON MAIN] get-storage-path appelé, retour:', storagePath);
  return storagePath;
});

// Handler pour lire les données
ipcMain.handle('read-data', async (event, filePath) => {
  console.log('📄 [ELECTRON MAIN] read-data appelé, filePath:', filePath);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsedData = JSON.parse(data);
    console.log('✅ [ELECTRON MAIN] Fichier lu avec succès, tâches:', parsedData.tasks?.length || 0);
    return { success: true, data: parsedData };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Fichier n'existe pas encore, c'est normal
      console.log('ℹ️ [ELECTRON MAIN] Fichier n\'existe pas encore (ENOENT)');
      return { success: true, data: null };
    }
    console.error('❌ [ELECTRON MAIN] Erreur lors de la lecture:', error);
    return { success: false, error: error.message };
  }
});

// Handler pour sauvegarder les données avec verrouillage
ipcMain.handle('save-data', async (event, filePath, data) => {
  console.log('💾 [ELECTRON MAIN] save-data DÉBUT, filePath:', filePath);
  let release = null;
  try {
    const dirPath = path.dirname(filePath);
    await ensureDirectory(dirPath);

    // VERROUILLAGE: Acquérir le verrou sur le fichier
    // Attendre max 5 secondes si un autre utilisateur est en train de sauver
    try {
      release = await lockfile.lock(filePath, {
        retries: {
          retries: 10,
          minTimeout: 100,
          maxTimeout: 500
        },
        stale: 10000 // Considérer le verrou comme périmé après 10 secondes
      });
    } catch (lockError) {
      console.warn('Impossible d\'acquérir le verrou, sauvegarde sans verrouillage:', lockError.message);
    }

    // ATOMIC WRITE: Écrire dans un fichier temporaire puis renommer
    const tempFilePath = filePath + '.tmp';
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(tempFilePath, jsonContent, 'utf-8');

    // Renommer atomiquement (remplace l'ancien fichier)
    await fs.rename(tempFilePath, filePath);

    // IMPORTANT: Attendre que le système de fichiers réseau se synchronise
    // Les lecteurs réseau Windows (SMB) peuvent avoir un cache qui met 500ms-1s à se rafraîchir
    await new Promise(resolve => setTimeout(resolve, 800));

    // Créer une sauvegarde horodatée (conserver les 5 dernières)
    const backupDir = path.join(dirPath, 'backups');
    await ensureDirectory(backupDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = path.join(backupDir, `backup-${timestamp}.json`);
    await fs.writeFile(backupPath, jsonContent, 'utf-8');

    // Nettoyer les anciennes sauvegardes (garder les 5 plus récentes)
    try {
      const backups = await fs.readdir(backupDir);
      const sortedBackups = backups
        .filter(f => f.startsWith('backup-'))
        .sort()
        .reverse();

      for (let i = 5; i < sortedBackups.length; i++) {
        await fs.unlink(path.join(backupDir, sortedBackups[i]));
      }
    } catch (backupError) {
      console.warn('Erreur nettoyage backups:', backupError.message);
    }

    console.log('✅ [ELECTRON MAIN] save-data TERMINÉ avec succès');
    return { success: true };
  } catch (error) {
    console.error('❌ [ELECTRON MAIN] save-data ERREUR:', error);
    return { success: false, error: error.message };
  } finally {
    // LIBÉRER LE VERROU
    if (release) {
      try {
        await release();
      } catch (unlockError) {
        console.warn('Erreur lors de la libération du verrou:', unlockError.message);
      }
    }
  }
});

// Handler pour calculer le hash SHA-256 d'un fichier (détection de conflits)
ipcMain.handle('get-file-hash', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    console.log('🔍 [ELECTRON MAIN] get-file-hash: SHA-256 calculé', hash.substring(0, 16) + '...');
    return { success: true, hash };
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('ℹ️ [ELECTRON MAIN] get-file-hash: fichier n\'existe pas (ENOENT)');
      return { success: true, hash: null };
    }
    console.error('❌ [ELECTRON MAIN] get-file-hash ERREUR:', error);
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
