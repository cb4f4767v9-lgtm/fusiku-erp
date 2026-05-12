/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** REST base, e.g. `http://localhost:3001/api/v1` or root-relative `/api/v1` (Vite dev proxy). */
  readonly VITE_API_URL?: string;
  /** Backend HTTP port when `VITE_API_URL` is unset (default 3001). */
  readonly VITE_BACKEND_PORT?: string;
  /** Default tenant UUID for password login when none is stored yet (Vite injects at build time). */
  readonly VITE_DEFAULT_COMPANY_ID?: string;
}

/** Exposed by desktop/preload.js in Electron */
interface ElectronBridge {
  on: (
    channel: 'update-available' | 'electron-update',
    callback: (detail?: unknown) => void
  ) => void;
}

/** Phase 5 — SQLite outbox + cache in Electron main (IPC). */
interface ElectronLocalDb {
  outboxEnqueue: (kind: string, payload: unknown) => Promise<{ id: string }>;
  outboxListPending: () => Promise<unknown[]>;
  outboxMarkSynced: (id: string) => Promise<unknown>;
  outboxMarkConflict: (id: string, detail: string) => Promise<unknown>;
  outboxBumpAttempt: (id: string, errMsg: string) => Promise<{ attempts?: number }>;
  outboxMarkFailed: (id: string, errMsg: string) => Promise<unknown>;
  outboxPendingCount: () => Promise<number>;
  outboxConflictCount: () => Promise<number>;
  outboxConflictsList: () => Promise<unknown[]>;
  outboxDelete: (id: string) => Promise<unknown>;
  cacheSet: (key: string, jsonStr: string) => Promise<unknown>;
  cacheGet: (key: string) => Promise<string | null>;
}

interface Window {
  electron?: ElectronBridge;
  electronLocalDb?: ElectronLocalDb;
}
