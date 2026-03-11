const { app, BrowserWindow, ipcMain, shell, nativeTheme, dialog, Notification, protocol } = require('electron');
const path = require('path');
const fsSync = require('fs');
const fs = fsSync.promises;
const { pathToFileURL } = require('url');
const isDev = process.env.NODE_ENV === 'development';

function toFileUrl(filePath) {
  return pathToFileURL(filePath).toString();
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

function sanitizeSoundFileName(soundFile) {
  if (typeof soundFile !== 'string') return null;
  const cleanFileName = path.basename(soundFile).trim();
  return cleanFileName.length > 0 ? cleanFileName : null;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveSoundUrl(soundFile) {
  const safeSoundFile = sanitizeSoundFileName(soundFile);
  if (!safeSoundFile) {
    throw new Error('Nom de fichier son invalide');
  }

  if (isDev) {
    return `http://localhost:5173/sounds/${encodeURIComponent(safeSoundFile)}`;
  }

  // En production, utiliser le protocole app:// pour éviter les restrictions file://
  const appUrl = `app://sounds/${encodeURIComponent(safeSoundFile)}`;

  console.log('🔍 [ELECTRON] Résolution son:', safeSoundFile);
  console.log('🔊 [ELECTRON] appUrl:', appUrl);

  return appUrl;
}

// Enregistrer le protocole app:// comme privilégié (avant app.ready)
if (!isDev) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: false
      }
    }
  ]);
}

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
      autoplayPolicy: 'no-user-gesture-required',
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
    mainWindow.loadURL('app://./index.html');
  }

  // Ouvrir les liens externes dans le navigateur
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Gestion du cycle de vie de l'app
app.whenReady().then(() => {
  // Enregistrer le protocole app:// pour servir les fichiers locaux
  if (!isDev) {
    protocol.handle('app', async (request) => {
      const parsedUrl = new URL(request.url);
      const hostSegment = parsedUrl.host && parsedUrl.host !== '.' ? parsedUrl.host : '';
      const pathSegment = parsedUrl.pathname.replace(/^\/+/, ''); // Supprimer leading slashes
      const relativePath = hostSegment ? `${hostSegment}/${pathSegment}` : pathSegment;
      const normalizedRelativePath = decodeURIComponent(relativePath);

      let filePath;
      // Les fichiers sons sont dans app.asar.unpacked car ils sont exclus de l'asar
      if (normalizedRelativePath.startsWith('sounds/')) {
        filePath = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', normalizedRelativePath);
      } else {
        filePath = path.join(__dirname, 'dist', normalizedRelativePath);
      }

      console.log('🌐 [PROTOCOL] app://', request.url, '→', normalizedRelativePath, '→', filePath);

      try {
        // Lire le fichier directement au lieu d'utiliser net.fetch
        const data = await fs.readFile(filePath);
        const mimeType = getMimeType(filePath);

        console.log('✅ [PROTOCOL] File loaded:', filePath, 'size:', data.length, 'type:', mimeType);

        return new Response(data, {
          headers: {
            'Content-Type': mimeType,
            'Content-Length': data.length.toString(),
          },
        });
      } catch (error) {
        console.error('❌ [PROTOCOL] Error loading file:', filePath, error);
        return new Response('File not found', { status: 404 });
      }
    });
  }

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

ipcMain.handle('get-login-item', () => {
  return app.getLoginItemSettings();
});

ipcMain.handle('set-login-item', (_event, openAtLogin) => {
  app.setLoginItemSettings({ openAtLogin });
  return true;
});

ipcMain.handle('get-sound-url', async (_event, soundFile) => {
  try {
    const url = await resolveSoundUrl(soundFile);
    return { success: true, url };
  } catch (error) {
    console.error('❌ [ELECTRON] Erreur résolution son:', error);
    return { success: false, error: error.message };
  }
});

// Handlers pour le système de thèmes
ipcMain.handle('set-native-theme', (event, source) => {
  // source = 'light' | 'dark' | 'system'
  nativeTheme.themeSource = source;
  return nativeTheme.shouldUseDarkColors;
});

ipcMain.handle('get-system-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

// Écouter les changements du thème système et notifier le renderer
nativeTheme.on('updated', () => {
  if (mainWindow) {
    mainWindow.webContents.send('system-theme-changed', {
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors
    });
  }
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

// Handler pour détecter les changements d'un fichier.
// Utilise fs.stat (mtime + size) plutôt que SHA-256 sur le contenu :
// sur les lecteurs réseau SMB (Z:\...), fs.readFile retourne du contenu mis en cache
// par le client Windows, ce qui peut masquer les changements pendant plusieurs minutes.
// fs.stat interroge directement le serveur pour les métadonnées → pas de cache contenu.
ipcMain.handle('get-file-hash', async (event, filePath) => {
  try {
    const stats = await fs.stat(filePath);
    const fingerprint = `${stats.mtimeMs}-${stats.size}`;
    console.log('🔍 [ELECTRON MAIN] get-file-hash: stat fingerprint', fingerprint);
    return { success: true, hash: fingerprint };
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

// ============================================
// HANDLERS POUR LES NOTIFICATIONS DESKTOP
// ============================================

// Handler pour envoyer une notification native
ipcMain.handle('send-notification', async (_event, title, body, tag) => {
  try {
    // Vérifier si les notifications sont supportées
    if (!Notification.isSupported()) {
      console.warn('⚠️ Notifications non supportées sur ce système');
      return { success: false, error: 'Notifications not supported' };
    }

    // Créer et afficher la notification
    const notification = new Notification({
      title,
      body,
      icon: path.join(__dirname, 'src/assets/icon.png'),
      tag, // Évite les doublons avec le même tag
      silent: true, // Pas de son système (on joue notre propre son)
    });

    notification.show();

    // Log pour debug
    console.log(`🔔 [ELECTRON] Notification envoyée: "${title}"`);

    // Gérer le clic sur la notification (focus sur la fenêtre)
    notification.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    return { success: true };
  } catch (error) {
    console.error('❌ [ELECTRON] Erreur notification:', error);
    return { success: false, error: error.message };
  }
});

// Handler pour demander la permission de notifications
ipcMain.handle('request-notification-permission', async () => {
  try {
    // Sur Electron, les notifications sont toujours autorisées si supportées
    const hasPermission = Notification.isSupported();
    console.log(`🔔 [ELECTRON] Permission notifications: ${hasPermission ? 'accordée' : 'refusée'}`);
    return hasPermission;
  } catch (error) {
    console.error('❌ [ELECTRON] Erreur permission:', error);
    return false;
  }
});

// ============================================
// CAST — Google Home / Chromecast integration
// ============================================
const castService = require('./cast-service');

// Découverte des appareils Cast sur le réseau local (mDNS)
ipcMain.handle('cast:discover', async () => {
  try {
    const devices = await castService.discoverDevices(5000);
    return { success: true, devices };
  } catch (error) {
    console.error('[CAST] Erreur découverte:', error);
    return { success: false, devices: [], error: error.message };
  }
});

// Lancement du cast vers un appareil (host, port, appId?)
ipcMain.handle('cast:launch', async (_event, host, port, appId) => {
  try {
    const localIP = castService.getLocalIP();
    let appUrl;

    if (isDev) {
      appUrl = `http://${localIP}:5173`;
    } else {
      const distPath = path.join(__dirname, 'dist');
      const castPort = await castService.startCastServer(distPath);
      appUrl = `http://${localIP}:${castPort}`;
    }

    console.log(`[CAST] → ${host}:${port || 8009}  URL: ${appUrl}  appId: ${appId || 'défaut'}`);
    const result = await castService.castUrl(host, port, appUrl, appId || null);
    return { success: true, url: appUrl, ...result };
  } catch (error) {
    console.error('[CAST] Erreur lancement:', error);
    return { success: false, error: error.message };
  }
});

// Retourne l'URL du receiver pour l'enregistrement Google Cast
ipcMain.handle('cast:get-receiver-url', async () => {
  try {
    const localIP = castService.getLocalIP();
    let receiverUrl;
    if (isDev) {
      receiverUrl = `http://${localIP}:5173/cast-receiver.html`;
    } else {
      const distPath = path.join(__dirname, 'dist');
      const castPort = await castService.startCastServer(distPath);
      receiverUrl = `http://${localIP}:${castPort}/cast-receiver.html`;
    }
    return { success: true, receiverUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Arrêter le serveur Cast HTTP (utile quand l'app se ferme)
app.on('before-quit', () => {
  castService.stopCastServer();
});

// Handler pour logger les erreurs dans un fichier
ipcMain.handle('log-error', async (_event, errorLog) => {
  try {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    const logFile = path.join(logsDir, 'errors.log');

    // Créer le dossier logs s'il n'existe pas
    await fs.mkdir(logsDir, { recursive: true });

    // Formater l'erreur
    const formattedError = `
================================================================================
[${errorLog.timestamp}] ${errorLog.boundary}
================================================================================
Message: ${errorLog.message}

Stack Trace:
${errorLog.stack}

Component Stack:
${errorLog.componentStack}

================================================================================

`;

    // Ajouter au fichier de log (append)
    await fs.appendFile(logFile, formattedError, 'utf8');

    console.log('🪵 [ELECTRON] Erreur loggée dans:', logFile);
    return { success: true, logPath: logFile };
  } catch (error) {
    console.error('❌ [ELECTRON] Impossible de logger l\'erreur:', error);
    return { success: false, error: error.message };
  }
});
