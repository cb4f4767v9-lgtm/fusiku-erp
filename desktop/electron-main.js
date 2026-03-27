const http = require('http');
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { ensureHotFrontend } = require('./frontend-update');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let mainWindow;

const isDev = !app.isPackaged;

function logUserData(msg) {
  try {
    const p = path.join(app.getPath('userData'), 'electron-main.log');
    fs.appendFileSync(p, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) {}
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

  if (isDev) {
    // ⏳ Wait until frontend is ready
    const waitForFrontend = () => {
      return new Promise((resolve) => {
        const tryConnect = () => {
          const req = http.get('http://127.0.0.1:5173', () => {
            resolve(true);
          });

          req.on('error', () => {
            setTimeout(tryConnect, 1000);
          });

          req.setTimeout(1000, () => {
            req.destroy();
            setTimeout(tryConnect, 1000);
          });
        };

        tryConnect();
      });
    };

    console.log('[Electron] Waiting for frontend...');
    await waitForFrontend();
    console.log('[Electron] Frontend ready');

    return mainWindow.loadURL('http://127.0.0.1:5173');
  }

  try {
    const userDataRoot = app.getPath('userData');

    await ensureHotFrontend({
      userDataRoot,
      manifestUrl: 'file:///C:/fusiku-updates/version.json',
      log: console.log,
    }).catch(() => {
      console.log('[Updater] skipped');
    });

    const { frontendIndex } = resolvePaths();

    if (!fs.existsSync(frontendIndex)) {
      return showErrorHtml('Frontend missing', frontendIndex);
    }

    await mainWindow.loadFile(frontendIndex);
    mainWindow.show();

  } catch (err) {
    showErrorHtml('Frontend load error', String(err));
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    title: 'Fusiku',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  // 🔒 DEVTOOLS ONLY IN DEV
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Backend is a standalone server (shared DB). Electron only loads the frontend UI.
  loadFrontend();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  // No internal backend to stop.
});