// Intégration Claude Desktop (serveur MCP To-DoX)
//
// Principe : To-DoX embarque le serveur MCP (mcp-server/, empaqueté en un seul fichier
// todox-mcp.cjs). Claude Desktop le lance avec l'exécutable To-DoX lui-même en mode
// Node (ELECTRON_RUN_AS_NODE=1) : aucune installation de Node.js n'est nécessaire.
//
// Authentification : pas de mot de passe dans la config de Claude. L'app écrit la
// session courante (URL backend + JWT) dans userData/claude-mcp-session.json, que le
// serveur MCP relit à chaque appel. Se reconnecter dans To-DoX suffit donc à rétablir
// l'accès de Claude si le token expire. Le fichier n'est écrit que si l'intégration
// est activée, et il est supprimé à la déconnexion ou à la désactivation.

const { app } = require('electron');
const path = require('path');
const fsSync = require('fs');
const fs = fsSync.promises;
const os = require('os');

const SERVER_KEY = 'todox';
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'claude-mcp.json');
const SESSION_FILE = () => path.join(app.getPath('userData'), 'claude-mcp-session.json');

function mcpBundlePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'mcp', 'todox-mcp.cjs')
    : path.join(__dirname, 'mcp-server', 'dist', 'todox-mcp.cjs');
}

/**
 * Dossiers de configuration possibles de Claude Desktop.
 * Windows : %APPDATA%\Claude, plus la variante Microsoft Store (MSIX) dont les écritures
 * dans AppData\Roaming sont redirigées vers %LOCALAPPDATA%\Packages\Claude_*\LocalCache.
 */
function claudeConfigDirs() {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return [path.join(home, 'Library', 'Application Support', 'Claude')];
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const dirs = [path.join(appData, 'Claude')];
    try {
      const pkgRoot = path.join(localAppData, 'Packages');
      for (const name of fsSync.readdirSync(pkgRoot)) {
        if (/^Claude_/i.test(name)) dirs.push(path.join(pkgRoot, name, 'LocalCache', 'Roaming', 'Claude'));
      }
    } catch {
      /* pas de dossier Packages */
    }
    return dirs;
  }
  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  return [path.join(configHome, 'Claude')];
}

/** Dossiers où Claude Desktop est installé/a déjà tourné (le dossier existe). */
function detectedClaudeDirs() {
  return claudeConfigDirs().filter((d) => fsSync.existsSync(d));
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

async function readSettings() {
  try {
    return await readJson(SETTINGS_FILE(), { enabled: false });
  } catch {
    return { enabled: false };
  }
}

function serverEntry() {
  return {
    command: process.execPath,
    args: [mcpBundlePath()],
    env: {
      ELECTRON_RUN_AS_NODE: '1',
      TODOX_SESSION_FILE: SESSION_FILE(),
    },
  };
}

/**
 * Ajoute (ou met à jour) l'entrée « todox » dans claude_desktop_config.json sans toucher
 * aux autres serveurs MCP. Une config illisible n'est jamais écrasée : on renvoie une erreur.
 */
async function writeClaudeConfig(dir) {
  const file = path.join(dir, 'claude_desktop_config.json');
  let config;
  try {
    config = await readJson(file, {});
  } catch {
    throw new Error(`Le fichier de configuration de Claude est illisible (JSON invalide) : ${file}`);
  }
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error(`Format inattendu pour ${file}`);
  }
  const entry = serverEntry();
  const current = config.mcpServers && config.mcpServers[SERVER_KEY];
  if (current && JSON.stringify(current) === JSON.stringify(entry)) return { file, changed: false };

  if (fsSync.existsSync(file)) await fs.copyFile(file, `${file}.todox-backup`);
  config.mcpServers = { ...(config.mcpServers || {}), [SERVER_KEY]: entry };
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(config, null, 2), 'utf-8');
  return { file, changed: true };
}

async function removeFromClaudeConfig(dir) {
  const file = path.join(dir, 'claude_desktop_config.json');
  let config;
  try {
    config = await readJson(file, null);
  } catch {
    return;
  }
  if (!config || !config.mcpServers || !config.mcpServers[SERVER_KEY]) return;
  delete config.mcpServers[SERVER_KEY];
  await fs.writeFile(file, JSON.stringify(config, null, 2), 'utf-8');
}

async function writeSession(session) {
  if (!session || !session.token || !session.apiUrl) {
    await fs.rm(SESSION_FILE(), { force: true });
    return;
  }
  const data = { apiUrl: session.apiUrl, token: session.token, userId: session.userId || null, updatedAt: Date.now() };
  // 0o600 : lisible uniquement par l'utilisateur (ignoré sous Windows, où userData est
  // déjà dans le profil privé de l'utilisateur).
  await fs.writeFile(SESSION_FILE(), JSON.stringify(data), { encoding: 'utf-8', mode: 0o600 });
}

async function getStatus() {
  const settings = await readSettings();
  const detected = detectedClaudeDirs();
  let configured = false;
  for (const dir of detected) {
    try {
      const config = await readJson(path.join(dir, 'claude_desktop_config.json'), {});
      const entry = config.mcpServers && config.mcpServers[SERVER_KEY];
      if (entry && entry.command === process.execPath) configured = true;
    } catch {
      /* config illisible : considérée non configurée */
    }
  }
  return {
    supported: true,
    enabled: Boolean(settings.enabled),
    claudeDetected: detected.length > 0,
    configured,
    bundleFound: fsSync.existsSync(mcpBundlePath()),
    sessionPresent: fsSync.existsSync(SESSION_FILE()),
  };
}

async function install(session) {
  if (!fsSync.existsSync(mcpBundlePath())) {
    throw new Error("Serveur MCP introuvable dans l'installation de To-DoX (mcp/todox-mcp.cjs).");
  }
  // Claude pas encore lancé une seule fois : on crée la config à l'emplacement standard,
  // Claude la lira à son premier démarrage.
  const dirs = detectedClaudeDirs();
  const targets = dirs.length ? dirs : [claudeConfigDirs()[0]];
  const results = [];
  for (const dir of targets) results.push(await writeClaudeConfig(dir));
  await fs.writeFile(SETTINGS_FILE(), JSON.stringify({ enabled: true }), 'utf-8');
  await writeSession(session);
  return { files: results.map((r) => r.file), changed: results.some((r) => r.changed) };
}

async function uninstall() {
  for (const dir of claudeConfigDirs()) await removeFromClaudeConfig(dir);
  await fs.writeFile(SETTINGS_FILE(), JSON.stringify({ enabled: false }), 'utf-8');
  await writeSession(null);
}

/** Met à jour la session partagée (uniquement si l'intégration est activée). */
async function syncSession(session) {
  const settings = await readSettings();
  if (!settings.enabled) return { written: false };
  await writeSession(session);
  return { written: true };
}

/**
 * Au démarrage : si l'intégration est activée, réaligne la config de Claude sur le
 * chemin actuel de l'exécutable (il peut changer après une mise à jour ou un déplacement).
 */
async function refreshOnStartup() {
  const settings = await readSettings();
  if (!settings.enabled || !fsSync.existsSync(mcpBundlePath())) return;
  for (const dir of detectedClaudeDirs()) {
    try {
      await writeClaudeConfig(dir);
    } catch (e) {
      console.warn('[claude-mcp] mise à jour de la config impossible :', e.message);
    }
  }
}

function registerClaudeIntegration(ipcMain) {
  ipcMain.handle('claude:status', () => getStatus());
  ipcMain.handle('claude:install', async (_event, session) => {
    try {
      return { success: true, ...(await install(session)) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle('claude:uninstall', async () => {
    try {
      await uninstall();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle('claude:sync-session', async (_event, session) => {
    try {
      return { success: true, ...(await syncSession(session)) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

module.exports = { registerClaudeIntegration, refreshOnStartup, claudeConfigDirs, mcpBundlePath };
