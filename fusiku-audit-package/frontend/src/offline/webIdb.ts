type StoreName = 'cache' | 'outbox';

const DB_NAME = 'fusiku_web_offline';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

async function withStore<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const s = tx.objectStore(store);
    fn(s);
    tx.oncomplete = () => resolve(undefined as T);
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
  });
}

export async function idbGet<T>(store: StoreName, key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const s = tx.objectStore(store);
    const req = s.get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error || new Error('IndexedDB get failed'));
  });
}

export async function idbSet<T>(store: StoreName, key: string, value: T): Promise<void> {
  await withStore<void>(store, 'readwrite', (s) => {
    s.put(value as any, key);
  });
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
  await withStore<void>(store, 'readwrite', (s) => {
    s.delete(key);
  });
}

export async function idbKeys(store: StoreName): Promise<string[]> {
  const db = await openDb();
  return new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const s = tx.objectStore(store);
    const req = s.getAllKeys();
    req.onsuccess = () => resolve((req.result || []).map((k) => String(k)));
    req.onerror = () => reject(req.error || new Error('IndexedDB keys failed'));
  });
}

