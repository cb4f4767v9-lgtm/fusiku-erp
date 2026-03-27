const { contextBridge, ipcRenderer } = require('electron');

/** @type {Record<string, Function | null>} */
const handlers = {
  'update-available': null,
  'frontend-updated': null,
};

ipcRenderer.on('update-available', () => {
  const h = handlers['update-available'];
  if (typeof h === 'function') h();
});

ipcRenderer.on('frontend-updated', (_event, detail) => {
  const h = handlers['frontend-updated'];
  if (typeof h === 'function') h(detail);
});

contextBridge.exposeInMainWorld('electron', {
  /**
   * @param {'update-available'|'frontend-updated'} channel
   * @param {(detail?: unknown) => void} callback
   */
  on: (channel, callback) => {
    if (typeof callback !== 'function') return;
    if (channel === 'update-available' || channel === 'frontend-updated') {
      handlers[channel] = callback;
    }
  },
});
