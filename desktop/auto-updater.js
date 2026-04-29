/**
 * Phase 5 — electron-updater: check on startup, auto-download, notify renderer.
 * Requires publish config in package.json (e.g. GitHub releases) and a valid feed at runtime.
 */
function setupAutoUpdater(mainWindow) {
  const { app } = require('electron');
  if (!app.isPackaged) {
    return;
  }
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (e) {
    console.warn('[autoUpdater] not available', e.message);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  try {
    mainWindow?.webContents?.send('electron-update', { state: 'checking' });
  } catch (_) {}

  autoUpdater.on('update-available', (info) => {
    try {
      mainWindow?.webContents?.send('electron-update', { state: 'available', version: info?.version });
    } catch (_) {}
  });

  autoUpdater.on('update-not-available', (info) => {
    try {
      mainWindow?.webContents?.send('electron-update', { state: 'not-available', version: info?.version });
    } catch (_) {}
  });

  autoUpdater.on('update-downloaded', (info) => {
    try {
      mainWindow?.webContents?.send('electron-update', {
        state: 'downloaded',
        version: info?.version,
      });
    } catch (_) {}
  });

  autoUpdater.on('error', (err) => {
    console.warn('[autoUpdater] error', err?.message || err);
    try {
      mainWindow?.webContents?.send('electron-update', { state: 'error', message: err?.message || String(err || '') });
    } catch (_) {}
  });

  autoUpdater.checkForUpdatesAndNotify().catch((e) => {
    console.warn('[autoUpdater] check failed', e?.message || e);
    try {
      mainWindow?.webContents?.send('electron-update', { state: 'error', message: e?.message || String(e || '') });
    } catch (_) {}
  });
}

module.exports = { setupAutoUpdater };
