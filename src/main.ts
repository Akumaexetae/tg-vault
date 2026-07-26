import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// --- Local cache: last-synced snapshot for offline reads -------------------
const cachePath = () => path.join(app.getPath('userData'), 'vault-cache.json');

ipcMain.handle('cache:save', (_event, data: string) => {
  try {
    fs.writeFileSync(cachePath(), data, 'utf-8');
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('cache:load', () => {
  try {
    return fs.readFileSync(cachePath(), 'utf-8');
  } catch {
    return null;
  }
});

// Open external links (service "open site" buttons) in the default browser.
ipcMain.handle('open-external', (_event, url: string) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
});

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 620,
    title: 'T&G Vault',
    backgroundColor: '#eaf7fe',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
