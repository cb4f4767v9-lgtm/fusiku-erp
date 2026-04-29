import { idbGet, idbSet } from './webIdb';

export type WebCacheKey = 'inventory' | 'sales';

type CacheEnvelope<T> = {
  v: 1;
  savedAt: number;
  data: T;
};

function keyOf(k: WebCacheKey) {
  return `cache:${k}`;
}

export async function persistWebCache<T>(k: WebCacheKey, data: T): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const env: CacheEnvelope<T> = { v: 1, savedAt: Date.now(), data };
  await idbSet('cache', keyOf(k), env);
}

export async function readWebCache<T>(k: WebCacheKey): Promise<{ savedAt: number; data: T } | null> {
  if (typeof indexedDB === 'undefined') return null;
  const env = await idbGet<CacheEnvelope<T>>('cache', keyOf(k)).catch(() => null);
  if (!env || env.v !== 1 || !env.savedAt) return null;
  return { savedAt: env.savedAt, data: env.data };
}

