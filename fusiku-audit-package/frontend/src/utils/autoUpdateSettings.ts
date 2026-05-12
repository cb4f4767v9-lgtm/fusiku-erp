/** localStorage key for “check for updates / show update banner” preference */
export const AUTO_UPDATE_STORAGE_KEY = 'autoUpdate';

/** Read as requested: only `"true"` enables (use after default init sets the key). */
export function getAutoUpdateEnabled(): boolean {
  return localStorage.getItem(AUTO_UPDATE_STORAGE_KEY) === 'true';
}

export function setAutoUpdateEnabled(enabled: boolean): void {
  localStorage.setItem(AUTO_UPDATE_STORAGE_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('fusiku-auto-update-changed'));
}

/** Call once so `getAutoUpdateEnabled()` is meaningful (default: on). */
export function ensureAutoUpdateDefault(): void {
  if (localStorage.getItem(AUTO_UPDATE_STORAGE_KEY) === null) {
    localStorage.setItem(AUTO_UPDATE_STORAGE_KEY, 'true');
  }
}
