import { inventoryApi, reportsApi } from '../services/api';
import { persistWebCache } from './webCache';

/**
 * Web-only lightweight offline prep:
 * - caches inventory + dashboard snapshot in IndexedDB for read-only offline views.
 */
export async function refreshWebCaches(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const [inventory, dashboard] = await Promise.all([
    inventoryApi.getAll().then((r) => r.data).catch(() => null),
    reportsApi.getDashboard().then((r) => r.data).catch(() => null),
  ]);
  if (inventory) await persistWebCache('inventory', inventory);
  if (dashboard) await persistWebCache('sales', dashboard);
}

