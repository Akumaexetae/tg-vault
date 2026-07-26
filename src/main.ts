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

// --- One-click login -------------------------------------------------------
// Opens the service in a dedicated window whose session is isolated PER
// ACCOUNT (persist:acct-<id>), so multiple accounts on the same service stay
// logged in side by side. Fills the login form when one is present; never
// auto-submits.
const autofillScript = (username: string, password: string) => `
(() => {
  const USERNAME = ${JSON.stringify(username)};
  const PASSWORD = ${JSON.stringify(password)};
  const setVal = (el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const tryFill = () => {
    const pw = [...document.querySelectorAll('input[type=password]')].find(i => i.offsetParent);
    if (!pw) return false;
    const inputs = [...document.querySelectorAll('input')].filter(
      i => ['text', 'email', 'tel', 'username'].includes(i.type) && i.offsetParent
    );
    const user = inputs.filter(i => i.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING).pop() || inputs[0];
    if (user) setVal(user, USERNAME);
    setVal(pw, PASSWORD);
    pw.focus();
    return true;
  };
  // SPA login forms often render late — retry for ~6s.
  let attempts = 0;
  const timer = setInterval(() => {
    if (tryFill() || ++attempts > 12) clearInterval(timer);
  }, 500);
  tryFill();
})();
`;

ipcMain.handle(
  'login:open',
  (
    _event,
    opts: { id: string; url: string; username: string; password: string },
  ) => {
    if (!/^https?:\/\//i.test(opts.url)) return;
    const win = new BrowserWindow({
      width: 1150,
      height: 820,
      title: `T&G Vault — ${opts.username}`,
      autoHideMenuBar: true,
      webPreferences: {
        partition: `persist:acct-${opts.id}`,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    win.webContents.on('did-finish-load', () => {
      win.webContents
        .executeJavaScript(autofillScript(opts.username, opts.password))
        .catch(() => {});
    });
    win.loadURL(opts.url);
  },
);

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
