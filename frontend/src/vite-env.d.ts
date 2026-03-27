/// <reference types="vite/client" />

/** Exposed by desktop/preload.js in Electron */
interface ElectronBridge {
  on: (channel: 'update-available' | 'frontend-updated', callback: (detail?: unknown) => void) => void;
}

interface Window {
  electron?: ElectronBridge;
}
