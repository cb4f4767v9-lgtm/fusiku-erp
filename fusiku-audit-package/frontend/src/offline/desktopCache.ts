import { isElectronLocalDbAvailable } from './desktopBridge';
import { api, expensesApi, inventoryApi, reportsApi } from '../services/api';

export type DesktopCacheKey = 'inventory' | 'expenses' | 'currency' | 'sales';

/** Persist JSON snapshot when online (Electron only). */
export async function persistDesktopCache(key: DesktopCacheKey, data: unknown): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (!isElectronLocalDbAvailable()) return;
  const db = (window as unknown as { electronLocalDb: { cacheSet: (k: string, s: string) => Promise<unknown> } }).electronLocalDb;
  try {
    await db.cacheSet(key, JSON.stringify(data ?? null));
  } catch {
    /* ignore */
  }
}

export async function readDesktopCache<T>(key: DesktopCacheKey): Promise<T | null> {
  if (!isElectronLocalDbAvailable()) return null;
  const db = (window as unknown as { electronLocalDb: { cacheGet: (k: string) => Promise<string | null> } }).electronLocalDb;
  try {
    const raw = await db.cacheGet(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Fetch and store key datasets into the Electron SQLite cache.
 * Used after reconnect to ensure offline views have fresh snapshots.
 */
export async function refreshDesktopCaches(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (!isElectronLocalDbAvailable()) return;

  const month = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const [inventory, expenses, currencyRates, dashboard] = await Promise.all([
    inventoryApi.getAll().then((r) => r.data).catch(() => null),
    expensesApi.list({ month }).then((r) => r.data).catch(() => null),
    api.get<Record<string, number>>('/currencies/rates').then((r) => r.data).catch(() => null),
    reportsApi.getDashboard().then((r) => r.data).catch(() => null),
  ]);

  if (inventory) await persistDesktopCache('inventory', inventory);
  if (expenses) await persistDesktopCache('expenses', expenses);
  if (currencyRates) await persistDesktopCache('currency', currencyRates);
  if (dashboard) await persistDesktopCache('sales', dashboard);
}
