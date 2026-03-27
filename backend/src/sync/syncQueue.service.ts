import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { SyncQueueItem } from './sync.types';

const dataDir = path.join(process.cwd(), 'data');
const queuePath = path.join(dataDir, 'offline-sync-queue.json');

function ensureFile(): SyncQueueItem[] {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(queuePath)) {
      fs.writeFileSync(queuePath, JSON.stringify({ items: [] }, null, 2), 'utf8');
      return [];
    }
    const raw = JSON.parse(fs.readFileSync(queuePath, 'utf8')) as { items: SyncQueueItem[] };
    return Array.isArray(raw.items) ? raw.items : [];
  } catch {
    return [];
  }
}

function save(items: SyncQueueItem[]) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(queuePath, JSON.stringify({ items }, null, 2), 'utf8');
}

export const syncQueueService = {
  list(): SyncQueueItem[] {
    return ensureFile();
  },

  enqueue(entity: string, op: SyncQueueItem['op'], payload: Record<string, unknown>): SyncQueueItem {
    const items = ensureFile();
    const item: SyncQueueItem = {
      id: randomUUID(),
      entity,
      op,
      payload,
      clientUpdatedAt: new Date().toISOString(),
      synced: false,
    };
    items.push(item);
    save(items);
    return item;
  },

  markSynced(ids: string[]) {
    const set = new Set(ids);
    const items = ensureFile().map((i) => (set.has(i.id) ? { ...i, synced: true } : i));
    save(items);
  },

  clearSynced() {
    const items = ensureFile().filter((i) => !i.synced);
    save(items);
  },

  resolveConflict(id: string, resolution: 'client' | 'server') {
    const items = ensureFile().map((i) =>
      i.id === id ? { ...i, conflict: undefined, synced: resolution === 'client' } : i
    );
    save(items);
  },
};
