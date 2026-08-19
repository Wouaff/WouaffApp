const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;
let splashWindow = null;
let discordClient = null;
let presenceActivity = null;
let presenceTimer = null;

/* ── Discord Rich Presence (optionnel : nécessite discord-rpc + DISCORD_CLIENT_ID) ── */
function initDiscordPresence() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) return;
  let RPC;
  try {
    RPC = require('discord-rpc');
  } catch {
    return;
  }
  discordClient = new RPC.Client({ transport: 'ipc' });
  discordClient.on('ready', () => {
    const update = () => {
      if (!discordClient || !presenceActivity) return;
      discordClient.setActivity(presenceActivity).catch(() => {});
    };
    presenceTimer = setInterval(update, 15000);
    update();
  });
  discordClient.login({ clientId }).catch(() => {
    discordClient = null;
  });
}

function updatePresence(page) {
  if (!discordClient) return;
  const map = {
    home: { details: 'Parcourt son fil', state: 'Wouaff' },
    login: { details: 'Connexion', state: 'Wouaff' },
    register: { details: 'Crée son compte', state: 'Wouaff' },
    settings: { details: 'Paramètres', state: 'Wouaff' },
  };
  const { details, state } = map[page] || map.home;
  presenceActivity = {
    details,
    state,
    startTimestamp: Date.now(),
    largeImageKey: 'wouaff_logo',
    largeImageText: 'Wouaff — ton fil, pas leur algo',
  };
  discordClient.setActivity(presenceActivity).catch(() => {});
}

/* ── Splash screen (dist/splash.html généré par scripts/gen_splash.cjs) ── */
function createSplash() {
  const splashPath = path.join(__dirname, '..', 'dist', 'splash.html');
  if (!fs.existsSync(splashPath)) return null;
  splashWindow = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    resizable: false,
    show: false,
    alwaysOnTop: true,
    backgroundColor: '#0b0b11',
    skipTaskbar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  splashWindow.loadFile(splashPath);
  splashWindow.once('ready-to-show', () => splashWindow.show());
  return splashWindow;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    show: false,
    backgroundColor: '#0b0b11',
    icon: path.join(
      __dirname,
      '..',
      'public',
      'assets',
      'logo',
      process.platform === 'win32' ? 'icon.ico' : 'logo.png',
    ),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_URL || 'http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  });

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized-changed', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized-changed', false));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

/* ── IPC (TitleBar, présence Discord) ── */
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());
ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);
ipcMain.on('discord:presence', (_event, page) => updatePresence(page));

/* ── Cycle de vie ── */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    splashWindow = createSplash();
    createWindow();
    initDiscordPresence();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (presenceTimer) clearInterval(presenceTimer);
    if (discordClient) discordClient.destroy().catch(() => {});
    if (process.platform !== 'darwin') app.quit();
  });
}
