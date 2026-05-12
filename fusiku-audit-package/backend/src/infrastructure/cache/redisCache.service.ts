import { getRedisClient } from '../redis/client';
import { logger } from '../../utils/logger';
import { redisOperationDurationMs, redisOperationsTotal } from '../../observability/metrics';
import { trace } from '@opentelemetry/api';

type CacheTag = string;

function jsonSafeParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function ttlSeconds(defaultTtlSeconds: number, envKey: string): number {
  const n = Number(process.env[envKey]);
  if (!Number.isFinite(n) || n <= 0) return defaultTtlSeconds;
  return Math.max(1, Math.floor(n));
}

const warnState = new Map<string, number>();
function warnThrottled(key: string, payload: Record<string, unknown>, message: string) {
  const t = Date.now();
  const last = warnState.get(key) || 0;
  // Keep logs informative but prevent flooding during outages.
  if (t - last < 5_000) return;
  warnState.set(key, t);
  logger.warn(payload, message);
}

export const redisCacheService = {
  enabled(): boolean {
    return Boolean(getRedisClient());
  },

  async getJson<T>(key: string): Promise<T | null> {
    const t0 = Date.now();
    const tracer = trace.getTracer('fusiku.cache');
    const span = tracer.startSpan('redis.get');
    const c = getRedisClient();
    if (!c) {
      span.end();
      return null;
    }
    try {
      const raw = await c.get(key);
      const ms = Date.now() - t0;
      redisOperationDurationMs.labels('get').observe(ms);
      if (!raw) {
        redisOperationsTotal.labels('get', 'miss').inc();
        return null;
      }
      redisOperationsTotal.labels('get', 'hit').inc();
      return jsonSafeParse<T>(raw);
    } catch (err) {
      redisOperationsTotal.labels('get', 'error').inc();
      // Soft-fail: cache must never break API requests.
      warnThrottled('redis.get', { err, key }, '[cache] redis.get failed (soft-fail)');
      return null;
    } finally {
      span.end();
    }
  },

  async setJson(key: string, value: unknown, opts?: { ttlSeconds?: number; tags?: CacheTag[] }): Promise<void> {
    const t0 = Date.now();
    const tracer = trace.getTracer('fusiku.cache');
    const span = tracer.startSpan('redis.set');
    const c = getRedisClient();
    if (!c) {
      span.end();
      return;
    }
    const ttl = opts?.ttlSeconds;
    const payload = JSON.stringify(value);
    try {
      if (ttl && ttl > 0) await c.set(key, payload, 'EX', ttl);
      else await c.set(key, payload);
      redisOperationsTotal.labels('set', 'ok').inc();
    } catch (err) {
      redisOperationsTotal.labels('set', 'error').inc();
      // Soft-fail: cache must never break API requests.
      warnThrottled('redis.set', { err, key }, '[cache] redis.set failed (soft-fail)');
      return;
    } finally {
      redisOperationDurationMs.labels('set').observe(Date.now() - t0);
      span.end();
    }

    const tags = (opts?.tags || []).filter(Boolean);
    if (tags.length) {
      // Tag index: sets of keys per tag for fast invalidation (no SCAN/KEYS).
      const t1 = Date.now();
      const span2 = tracer.startSpan('redis.tag_index');
      const multi = c.multi();
      for (const tag of tags) {
        multi.sadd(`cache-tag:${tag}`, key);
        // Keep tag index slightly longer than typical TTL to avoid leak.
        multi.expire(`cache-tag:${tag}`, Math.max(60, (ttl || 60) + 60));
      }
      try {
        await multi.exec();
        redisOperationsTotal.labels('tag_index', 'ok').inc();
      } catch (err) {
        redisOperationsTotal.labels('tag_index', 'error').inc();
        warnThrottled(
          'redis.tag_index',
          { err, key, tags },
          '[cache] redis tag index update failed (soft-fail)'
        );
        return;
      } finally {
        redisOperationDurationMs.labels('tag_index').observe(Date.now() - t1);
        span2.end();
      }
    }
  },

  async getOrSetJson<T>(
    key: string,
    loader: () => Promise<T>,
    opts?: { ttlSeconds?: number; tags?: CacheTag[]; softFail?: boolean }
  ): Promise<T> {
    const cached = await redisCacheService.getJson<T>(key);
    if (cached !== null) return cached;

    const value = await loader();
    // Soft-fail by default: cache must never break API requests.
    // `setJson` already soft-fails; keep this wrapper only for callers expecting legacy behavior.
    await redisCacheService.setJson(key, value, opts);
    return value;
  },

  async invalidateTags(tags: CacheTag[]): Promise<number> {
    const t0 = Date.now();
    const tracer = trace.getTracer('fusiku.cache');
    const span = tracer.startSpan('redis.invalidate_tags');
    const c = getRedisClient();
    if (!c) {
      span.end();
      return 0;
    }
    const uniq = [...new Set(tags.filter(Boolean))];
    if (!uniq.length) {
      span.end();
      return 0;
    }

    let deleted = 0;
    try {
      for (const tag of uniq) {
        const tagKey = `cache-tag:${tag}`;
        const keys = await c.smembers(tagKey);
        if (!keys.length) continue;
        const multi = c.multi();
        for (const k of keys) multi.del(k);
        multi.del(tagKey);
        const res = await multi.exec();
        // Best-effort count: DEL replies appear as numbers in ioredis exec results.
        if (res) {
          for (const r of res) {
            const n = Array.isArray(r) ? r[1] : null;
            if (typeof n === 'number') deleted += n;
          }
        }
      }
      redisOperationsTotal.labels('invalidate', 'ok').inc();
      return deleted;
    } catch (err) {
      redisOperationsTotal.labels('invalidate', 'error').inc();
      warnThrottled('redis.invalidate', { err, tags: uniq }, '[cache] invalidateTags failed (soft-fail)');
      return deleted;
    } finally {
      redisOperationDurationMs.labels('invalidate').observe(Date.now() - t0);
      span.end();
    }
  },

  // Common TTL presets (seconds)
  ttls: {
    dashboard(): number {
      return ttlSeconds(30, 'CACHE_TTL_DASHBOARD_SECONDS');
    },
    reports(): number {
      return ttlSeconds(60, 'CACHE_TTL_REPORTS_SECONDS');
    },
  },
};

