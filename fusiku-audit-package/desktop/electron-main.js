const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const { registerLocalDatabaseIpc } = require('./local-sqlite-db');
const { setupAutoUpdater } = require('./auto-updater');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let mainWindow;
let tray = null;
let backendChild = null;
let backendRestartCount = 0;
const MAX_BACKEND_RESTARTS = 50;

const isDev = !app.isPackaged;

function logUserData(msg) {
  try {
    const p = path.join(app.getPath('userData'), 'electron-main.log');
    fs.appendFileSync(p, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) {}
}

function loadRuntimeEnv() {
  const cfgPath = path.join(app.getPath('userData'), 'runtime-config.json');
  if (!fs.existsSync(cfgPath)) {
    logUserData('[runtime] No runtime-config.json — create one from runtime-config.example.json (see app docs).');
    return {};
  }
  try {
    const raw = fs.readFileSync(cfgPath, 'utf8');
    const j = JSON.parse(raw);
    return j && typeof j.env === 'object' && j.env ? j.env : {};
  } catch (e) {
    logUserData(`[runtime] Failed to parse runtime-config.json: ${e}`);
    return {};
  }
}

function getBackendEntryAndCwd() {
  if (isDev) {
    const repoRoot = path.join(__dirname, '..');
    const distMain = path.join(repoRoot, 'backend', 'dist', 'index.js');
    return { entry: distMain, cwd: path.join(repoRoot, 'backend') };
  }
  const resources = process.resourcesPath;
  return {
    entry: path.join(resources, 'backend', 'dist', 'index.js'),
    cwd: path.join(resources, 'backend'),
  };
}

function stopBackend() {
  if (backendChild && !backendChild.killed) {
    try {
      backendChild.kill('SIGTERM');
    } catch (_) {}
  }
  backendChild = null;
}

function startBackendProcess() {
  const { entry, cwd } = getBackendEntryAndCwd();
  if (!fs.existsSync(entry)) {
    logUserData(`[backend] Missing ${entry} — build backend first (npm run build:backend).`);
    return null;
  }

  const runtimeEnv = loadRuntimeEnv();
  const env = {
    ...process.env,
    ...runtimeEnv,
    NODE_ENV: 'production',
    ELECTRON_RUN_AS_NODE: '1',
  };

  const child = spawn(process.execPath, [entry], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (d) => logUserData(`[backend-out] ${String(d).trim()}`));
  child.stderr?.on('data', (d) => logUserData(`[backend-err] ${String(d).trim()}`));

  child.on('exit', (code) => {
    logUserData(`[backend] exited code=${code}`);
    backendChild = null;
    if (code !== 0 && backendRestartCount < MAX_BACKEND_RESTARTS) {
      backendRestartCount += 1;
      const delay = Math.min(30000, 2000 * backendRestartCount);
      logUserData(`[backend] restarting in ${delay}ms (attempt ${backendRestartCount})`);
      setTimeout(() => {
        backendChild = startBackendProcess();
      }, delay);
    }
  });

  backendRestartCount = 0;
  return child;
}

function waitForHealth(port, maxAttempts = 120) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tryOnce = () => {
      n += 1;
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (r) => {
        resolve(true);
      });
      req.on('error', () => {
        if (n >= maxAttempts) return reject(new Error('Backend health timeout'));
        setTimeout(tryOnce, 500);
      });
      req.setTimeout(1500, () => {
        req.destroy();
        if (n >= maxAttempts) return reject(new Error('Backend health timeout'));
        setTimeout(tryOnce, 500);
      });
    };
    tryOnce();
  });
}

function resolvePort() {
  const r = loadRuntimeEnv();
  const p = Number(r.PORT || process.env.PORT || 3001);
  return Number.isFinite(p) && p > 0 ? p : 3001;
}

function showErrorHtml(title, bodyText) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui;padding:24px;background:#1a1a2e;color:#eee;}pre{white-space:pre-wrap;word-break:break-all;background:#0f0f1a;padding:16px;border-radius:8px;}</style></head><body><h1>${title}</h1><pre>${bodyText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  mainWindow.show();
}

function resolvePaths() {
  const frontendIndex = isDev
    ? path.join(__dirname, '..', 'frontend', 'dist', 'index.html')
    : path.join(process.resourcesPath, 'frontend', 'dist', 'index.html');

  return { frontendIndex };
}

async function loadFrontend() {
  if (!mainWindow) return;

  const port = resolvePort();

  const waitForWeb = () =>
    new Promise((resolve, reject) => {
      let n = 0;
      const max = 120;
      const tryConnect = () => {
        n += 1;
        if (n > max) return reject(new Error('Web UI timeout (backend not listening)'));
        const req = http.get(`http://127.0.0.1:${port}/`, () => resolve(true));
        req.on('error', () => setTimeout(tryConnect, 500));
        req.setTimeout(2000, () => {
          req.destroy();
          setTimeout(tryConnect, 500);
        });
      };
      tryConnect();
    });

  if (isDev) {
    console.log(`[Electron] Waiting for web (http://127.0.0.1:${port}/)...`);
    await waitForWeb();
    console.log('[Electron] Web server ready');
    return mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  }

  try {
    await waitForWeb();
    return mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  } catch (err) {
    const { frontendIndex } = resolvePaths();
    if (fs.existsSync(frontendIndex)) {
      try {
        await mainWindow.loadFile(frontendIndex);
        mainWindow.show();
        return;
      } catch (_) {}
    }
    showErrorHtml('Frontend load error', String(err));
  }
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.ico');
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    image = nativeImage.createEmpty();
  }
  tray = new Tray(image);
  const menu = Menu.buildFromTemplate([
    {
      label: 'Show Fusiku',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setToolTip('Fusiku');
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.hide();
      else mainWindow.show();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'Fusiku',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('minimize', (e) => {
    if (tray && process.platform === 'win32') {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('close', (e) => {
    if (tray && !app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  (async () => {
    try {
      if (!isDev) {
        backendChild = startBackendProcess();
        const port = resolvePort();
        logUserData(`[Electron] Waiting for backend health :${port}...`);
        await waitForHealth(port);
        logUserData('[Electron] Backend healthy');
      }
      await loadFrontend();
      if (!isDev) mainWindow.show();
    } catch (err) {
      showErrorHtml('Fusiku backend', String(err));
    }
  })();

  setupAutoUpdater(mainWindow);
}

app.whenReady().then(() => {
  registerLocalDatabaseIpc();
  createTray();
  createWindow();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
