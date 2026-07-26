import {
  app,
  autoUpdater,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  shell,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { parseProxy } from './lib/proxy';

/**
 * Auto-update straight from GitHub releases.
 *
 * `/releases/latest/download/` always resolves to the newest published
 * release, so Squirrel can read RELEASES and the .nupkg from it with no
 * update server in the middle. (update.electronjs.org would also work, but
 * it caches lookups for long enough to be unreliable right after a release.)
 */
const FEED_URL =
  'https://github.com/Akumaexetae/tg-vault/releases/latest/download';
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

let updateReady = false;

function initAutoUpdate(): void {
  // Squirrel only exists in an installed build, never in `npm start`.
  if (!app.isPackaged) return;
  try {
    autoUpdater.setFeedURL({ url: FEED_URL });
  } catch {
    return; // unsupported platform — app runs fine without updates
  }

  // Update problems are never the user's problem: stay silent, retry later.
  autoUpdater.on('error', () => {});
  autoUpdater.on('update-downloaded', () => {
    updateReady = true;
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('update:ready');
    }
  });

  autoUpdater.checkForUpdates();
  setInterval(() => {
    if (!updateReady) autoUpdater.checkForUpdates();
  }, UPDATE_INTERVAL_MS);
}

app.on('ready', initAutoUpdate);

// Renderer asks on load, in case the update landed before the window existed.
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('update:status', () => updateReady);
ipcMain.handle('update:restart', () => {
  if (updateReady) autoUpdater.quitAndInstall();
});

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
// logged in side by side. Fills login and 2FA forms when present; never
// auto-submits.
const autofillScript = (
  username: string,
  password: string,
  totp: string | null,
) => `
(() => {
  const USERNAME = ${JSON.stringify(username)};
  const PASSWORD = ${JSON.stringify(password)};
  const TOTP = ${JSON.stringify(totp)};
  const setVal = (el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const visible = (i) => i.offsetParent !== null;

  const fillLogin = () => {
    const pw = [...document.querySelectorAll('input[type=password]')].find(visible);
    if (!pw || pw.dataset.tgFilled) return false;
    const inputs = [...document.querySelectorAll('input')].filter(
      i => ['text', 'email', 'tel', 'username'].includes(i.type) && visible(i)
    );
    const user = inputs.filter(i => i.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING).pop() || inputs[0];
    if (user) setVal(user, USERNAME);
    setVal(pw, PASSWORD);
    pw.dataset.tgFilled = '1';
    pw.focus();
    return true;
  };

  // 2FA pages: a short numeric field (or 6 single-digit boxes) and no password field.
  const fill2fa = () => {
    if (!TOTP) return false;
    if ([...document.querySelectorAll('input[type=password]')].some(visible)) return false;
    const candidates = [...document.querySelectorAll('input')].filter(i =>
      visible(i) && !i.value && ['text', 'tel', 'number', ''].includes(i.type)
    );
    const boxes = candidates.filter(i => i.maxLength === 1);
    if (boxes.length >= TOTP.length) {
      TOTP.split('').forEach((d, n) => setVal(boxes[n], d));
      boxes[boxes.length - 1].focus();
      return true;
    }
    const field = candidates.find(i => {
      const hint = ((i.name || '') + (i.id || '') + (i.autocomplete || '') + (i.placeholder || '') + (i.getAttribute('aria-label') || '')).toLowerCase();
      return /otp|2fa|two|code|token|auth|verif/.test(hint) || (i.maxLength >= 6 && i.maxLength <= 8);
    });
    if (!field || field.dataset.tgFilled) return false;
    setVal(field, TOTP);
    field.dataset.tgFilled = '1';
    field.focus();
    return true;
  };

  // SPA forms render late and 2FA appears after submit — keep watching ~60s.
  let ticks = 0;
  const timer = setInterval(() => {
    fillLogin();
    fill2fa();
    if (++ticks > 120) clearInterval(timer);
  }, 500);
  fillLogin();
})();
`;

// Proxy credentials, keyed by partition — supplied when the proxy challenges.
const proxyCreds = new Map<string, { username: string; password: string }>();

app.on('login', (event, webContents, _details, authInfo, callback) => {
  if (!authInfo.isProxy || !webContents) return;
  const partition = webContents.session.storagePath ?? '';
  const found = [...proxyCreds.entries()].find(([key]) => partition.includes(key));
  if (found) {
    event.preventDefault();
    callback(found[1].username, found[1].password);
  }
});

ipcMain.handle(
  'login:open',
  async (
    _event,
    opts: {
      id: string;
      url: string;
      username: string;
      password: string;
      totp: string | null;
      proxy: string | null;
    },
  ) => {
    if (!/^https?:\/\//i.test(opts.url)) return;
    const partition = `persist:acct-${opts.id}`;

    if (opts.proxy) {
      const parsed = parseProxy(opts.proxy);
      if (parsed) {
        await session.fromPartition(partition).setProxy({ proxyRules: parsed.rules });
        if (parsed.username) {
          proxyCreds.set(`acct-${opts.id}`, {
            username: parsed.username,
            password: parsed.password ?? '',
          });
        }
      }
    }

    const win = new BrowserWindow({
      width: 1150,
      height: 820,
      title: `T&G Vault — ${opts.username}`,
      autoHideMenuBar: true,
      webPreferences: {
        partition,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    win.webContents.on('did-finish-load', () => {
      win.webContents
        .executeJavaScript(autofillScript(opts.username, opts.password, opts.totp))
        .catch(() => {});
    });
    win.loadURL(opts.url);
  },
);

/** Wipe an account's saved browser session (cookies, storage). */
ipcMain.handle('login:logout', async (_event, id: string) => {
  await session.fromPartition(`persist:acct-${id}`).clearStorageData();
  proxyCreds.delete(`acct-${id}`);
});

// --- Backup export ---------------------------------------------------------
ipcMain.handle(
  'backup:save',
  async (_event, opts: { filename: string; contents: string }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save vault backup',
      defaultPath: path.join(app.getPath('downloads'), opts.filename),
    });
    if (canceled || !filePath) return null;
    fs.writeFileSync(filePath, opts.contents, 'utf-8');
    return filePath;
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
