import Redis from 'ioredis';
import { logger } from '../../utils/logger';

let shared: Redis | null | undefined;

export type RedisClient = Redis;

const globalForRedisLogThrottle = globalThis as unknown as {
  __fusikuRedisLogThrottle?: { lastWarnAtMs: number };
};
if (!globalForRedisLogThrottle.__fusikuRedisLogThrottle) {
  globalForRedisLogThrottle.__fusikuRedisLogThrottle = { lastWarnAtMs: 0 };
}
function warnRedisOnce(message: string, extra?: Record<string, unknown>) {
  const t = Date.now();
  const st = globalForRedisLogThrottle.__fusikuRedisLogThrottle!;
  // Prevent log flooding during outages while keeping signal.
  if (t - st.lastWarnAtMs < 5_000) return;
  st.lastWarnAtMs = t;
  logger.warn(extra || {}, message);
}

export function getRedisClient(): Redis | null {
  if (shared !== undefined) return shared;

  const url = String(process.env.REDIS_URL || '').trim();
  if (!url) {
    shared = null;
    return shared;
  }

  const client = new Redis(url, {
    // Self-healing defaults: avoid unbounded offline queue and infinite retries.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    retryStrategy(times) {
      const ms = Math.min(10_000, 250 + times * 250);
      return ms;
    },
    reconnectOnError(err) {
      const m = String(err?.message || '');
      // A conservative reconnect policy for transient socket/protocol issues.
      return m.includes('READONLY') || m.includes('ECONNRESET') || m.includes('ETIMEDOUT');
    },
  });

  client.on('connect', () => logger.info('[redis] connected'));
  client.on('reconnecting', () => warnRedisOnce('[redis] reconnecting'));
  client.on('error', (err) => warnRedisOnce('[redis] error', { err }));
  client.on('end', () => warnRedisOnce('[redis] connection closed'));

  shared = client;
  return shared;
}

export async function redisPing(): Promise<boolean> {
  const c = getRedisClient();
  if (!c) return false;
  try {
    await c.ping();
    return true;
  } catch {
    return false;
  }
}

