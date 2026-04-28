/**
 * When `REDIS_URL` is set, rate limit counters use Redis so limits are shared across processes.
 * Otherwise returns `undefined` and express-rate-limit uses its in-memory store.
 */
import type { Options, Store } from 'express-rate-limit';
import type Redis from 'ioredis';
import { getRedisClient } from '../infrastructure/redis/client';
import { logger } from '../utils/logger';

class PrefixRedisStore implements Store {
  private readonly keyPrefix: string;

  private readonly client: Redis;

  private windowMs = 60_000;

  constructor(prefix: string, client: Redis) {
    this.keyPrefix = prefix;
    this.client = client;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  increment(key: string) {
    const k = `${this.keyPrefix}:${key}`;
    return (async () => {
      const n = await this.client.incr(k);
      if (n === 1) {
        await this.client.pexpire(k, this.windowMs);
      }
      const ttl = await this.client.pttl(k);
      const resetTime = ttl > 0 ? new Date(Date.now() + ttl) : undefined;
      return { totalHits: n, resetTime };
    })();
  }

  decrement(key: string) {
    return this.client.decr(`${this.keyPrefix}:${key}`).then(() => undefined);
  }

  resetKey(key: string) {
    return this.client.del(`${this.keyPrefix}:${key}`).then(() => undefined);
  }
}

const storeCache = new Map<string, Store>();

type CircuitState = {
  disabledUntilMs: number;
  lastWarnAtMs: number;
};

const circuits = new Map<string, CircuitState>();

function nowMs() {
  return Date.now();
}

function cooldownMs(): number {
  const n = Number(process.env.RATE_LIMIT_REDIS_COOLDOWN_MS || 30_000);
  if (!Number.isFinite(n) || n < 1_000) return 30_000;
  return Math.min(10 * 60_000, Math.floor(n));
}

function failOpenEnabled(): boolean {
  // default: fail-open (Redis must never break API requests)
  return String(process.env.RATE_LIMIT_REDIS_FAIL_OPEN || '1') !== '0';
}

function warnThrottled(prefix: string, message: string, extra?: Record<string, unknown>) {
  const t = nowMs();
  const st = circuits.get(prefix) || { disabledUntilMs: 0, lastWarnAtMs: 0 };
  // throttle repeated logs while Redis is down (keep signal, avoid spam)
  if (t - st.lastWarnAtMs < 5_000) return;
  st.lastWarnAtMs = t;
  circuits.set(prefix, st);
  logger.warn({ prefix, ...extra }, message);
}

class FailSafeStore implements Store {
  // express-rate-limit's Store interface expects a public `prefix` string.
  public readonly prefix: string;
  private readonly inner: Store;
  private windowMs = 60_000;

  constructor(prefix: string, inner: Store) {
    this.prefix = prefix;
    this.inner = inner;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    try {
      this.inner.init?.(options);
    } catch (err) {
      warnThrottled(this.prefix, '[rate-limit] store init failed (soft-fail)', { err });
    }
  }

  private isDisabled(): boolean {
    const st = circuits.get(this.prefix);
    return Boolean(st && st.disabledUntilMs > nowMs());
  }

  private trip(err: unknown) {
    const until = nowMs() + cooldownMs();
    const prev = circuits.get(this.prefix);
    circuits.set(this.prefix, { disabledUntilMs: until, lastWarnAtMs: prev?.lastWarnAtMs || 0 });
    warnThrottled(this.prefix, '[rate-limit] Redis store error — failing open and disabling temporarily', {
      disabledForMs: cooldownMs(),
      err,
    });
  }

  async increment(key: string) {
    // When Redis is down, never block requests. Fail-open by default.
    if (this.isDisabled() && failOpenEnabled()) {
      // express-rate-limit requires totalHits to be a positive integer.
      // Return 1 so the request is allowed but counters don't block traffic.
      return { totalHits: 1, resetTime: new Date(nowMs() + this.windowMs) };
    }

    try {
      return await this.inner.increment(key);
    } catch (err) {
      this.trip(err);
      if (failOpenEnabled()) {
        return { totalHits: 1, resetTime: new Date(nowMs() + this.windowMs) };
      }
      throw err;
    }
  }

  async decrement(key: string) {
    try {
      await this.inner.decrement?.(key);
    } catch (err) {
      this.trip(err);
    }
    return undefined;
  }

  async resetKey(key: string) {
    try {
      await this.inner.resetKey?.(key);
    } catch (err) {
      this.trip(err);
    }
    return undefined;
  }
}

/** Returns a Store instance, or `undefined` to use the default in-memory store. */
export function createPrefixRedisRateLimitStore(prefix: string): Store | undefined {
  if (String(process.env.DISABLE_REDIS_RATE_LIMIT || '0') === '1') return undefined;
  const client = getRedisClient();
  if (!client) return undefined;
  const hit = storeCache.get(prefix);
  if (hit) return hit;
  const s = new FailSafeStore(prefix, new PrefixRedisStore(prefix, client));
  storeCache.set(prefix, s);
  return s;
}
