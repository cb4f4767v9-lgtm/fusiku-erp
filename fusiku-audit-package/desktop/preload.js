const { contextBridge, ipcRenderer } = require('electron');

/** @type {Record<string, Function | null>} */
const handlers = {
  'update-available': null,
  'electron-update': null,
};

ipcRenderer.on('update-available', () => {
  const h = handlers['update-available'];
  if (typeof h === 'function') h();
});

ipcRenderer.on('electron-update', (_event, detail) => {
  const h = handlers['electron-update'];
  if (typeof h === 'function') h(detail);
});

contextBridge.exposeInMainWorld('electron', {
  /**
   * @param {'update-available'|'electron-update'} channel
   * @param {(detail?: unknown) => void} callback
   */
  on: (channel, callback) => {
    if (typeof callback !== 'function') return;
    if (channel === 'update-available' || channel === 'electron-update') {
      handlers[channel] = callback;
    }
  },
});

/** Phase 5 — SQLite outbox + cache (IPC to main process). */
contextBridge.exposeInMainWorld('electronLocalDb', {
  outboxEnqueue: (kind, payload) => ipcRenderer.invoke('localdb:outbox-enqueue', kind, payload),
  outboxListPending: () => ipcRenderer.invoke('localdb:outbox-list-pending'),
  outboxMarkSynced: (id) => ipcRenderer.invoke('localdb:outbox-mark-synced', id),
  outboxMarkConflict: (id, detail) => ipcRenderer.invoke('localdb:outbox-mark-conflict', id, detail),
  outboxBumpAttempt: (id, errMsg) => ipcRenderer.invoke('localdb:outbox-bump-attempt', id, errMsg),
  outboxMarkFailed: (id, errMsg) => ipcRenderer.invoke('localdb:outbox-mark-failed', id, errMsg),
  outboxPendingCount: () => ipcRenderer.invoke('localdb:outbox-pending-count'),
  outboxConflictCount: () => ipcRenderer.invoke('localdb:outbox-conflict-count'),
  outboxConflictsList: () => ipcRenderer.invoke('localdb:outbox-conflicts-list'),
  outboxDelete: (id) => ipcRenderer.invoke('localdb:outbox-delete', id),
  cacheSet: (key, jsonStr) => ipcRenderer.invoke('localdb:cache-set', key, jsonStr),
  cacheGet: (key) => ipcRenderer.invoke('localdb:cache-get', key),
});
