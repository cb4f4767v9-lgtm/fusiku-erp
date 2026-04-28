import { getRedisClient } from '../infrastructure/redis/client';
import { getTenantContext } from '../utils/tenantContext';

function enabled(): boolean {
  return process.env.USAGE_TRACKING === '1';
}

function monthKey(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function ttlToNextUtcMonthSeconds(now = new Date()): number {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  const ms = next.getTime() - now.getTime();
  return Math.max(60, Math.floor(ms / 1000));
}

export type UsageMetricKey = 'api_requests' | 'ai_requests';

export const usageMeterService = {
  enabled,

  async incr(metric: UsageMetricKey, by = 1): Promise<void> {
    if (!enabled()) return;
    const ctx = getTenantContext();
    if (!ctx || ctx.isSystemAdmin) return;
    if (!ctx.companyId) return;

    const c = getRedisClient();
    if (!c) return;

    const key = `usage:${ctx.companyId}:${monthKey()}:${metric}`;
    const ttl = ttlToNextUtcMonthSeconds();
    // Best-effort: do not block request if Redis fails.
    await c
      .multi()
      .incrby(key, Math.max(1, Math.floor(by)))
      .expire(key, ttl)
      .exec()
      .catch(() => {});
  },
};

