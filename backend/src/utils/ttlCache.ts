export type TtlCacheOptions = { ttlMs: number; maxItems?: number };

type Entry<V> = { value: V; expiresAt: number };

export class TtlCache<K, V> {
  private readonly ttlMs: number;
  private readonly maxItems: number;
  private readonly map = new Map<K, Entry<V>>();

  constructor(opts: TtlCacheOptions) {
    this.ttlMs = Math.max(1000, Number(opts.ttlMs || 0));
    this.maxItems = Math.max(50, Number(opts.maxItems || 500));
  }

  get(key: K): V | null {
    const ent = this.map.get(key);
    if (!ent) return null;
    if (Date.now() > ent.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return ent.value;
  }

  set(key: K, value: V) {
    // naive eviction: delete oldest inserted when above max (Map keeps insertion order)
    if (this.map.size >= this.maxItems) {
      const firstKey = this.map.keys().next().value as K | undefined;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: K) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}

