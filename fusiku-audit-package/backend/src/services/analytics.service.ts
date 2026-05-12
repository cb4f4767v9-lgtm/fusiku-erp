import { prismaPlatform } from '../utils/prismaPlatform';
import { requireTenantCompanyId } from '../utils/tenantContext';
import { redisCacheService } from '../infrastructure/cache/redisCache.service';
import { logger } from '../utils/logger';

function clampInt(n: unknown, def: number, min: number, max: number): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return def;
  return Math.max(min, Math.min(max, v));
}

async function safeCacheGet<T>(key: string): Promise<T | null> {
  try {
    return await redisCacheService.getJson<T>(key);
  } catch (err) {
    // Should not happen (cache is soft-fail), but keep analytics hardened.
    logger.warn({ err, key }, '[analytics] cache get failed (soft-fail)');
    return null;
  }
}

async function safeCacheSet(key: string, value: unknown, opts?: { ttlSeconds?: number; tags?: string[] }): Promise<void> {
  try {
    await redisCacheService.setJson(key, value, opts);
  } catch (err) {
    logger.warn({ err, key }, '[analytics] cache set failed (soft-fail)');
  }
}

export const analyticsService = {
  async dailyProfit(params?: { days?: number; branchId?: string | null }) {
    const companyId = requireTenantCompanyId();
    const days = clampInt(params?.days, 30, 1, 365);
    const branchId = params?.branchId ? String(params.branchId).trim() : null;

    const cacheKey = redisCacheService.enabled()
      ? `cache:analytics:daily-profit:v1:company:${companyId}:branch:${branchId || 'all'}:days:${days}`
      : null;
    const tags = [
      `reports:company:${companyId}`,
      ...(branchId ? [`reports:company:${companyId}:branch:${branchId}`] : []),
    ];
    if (cacheKey) {
      const cached = await safeCacheGet<any>(cacheKey);
      if (cached) return cached;
    }

    const rows = (await (prismaPlatform as any).$queryRawUnsafe(
      `
      SELECT day, invoices_count, sales_usd, profit_usd
      FROM sales_summary_daily
      WHERE company_id = $1
        AND ($2::text IS NULL OR branch_id = $2)
        AND day >= (now() - ($3::int * interval '1 day'))
      ORDER BY day ASC
      `,
      companyId,
      branchId,
      days
    )) as Array<{ day: string; invoices_count: number; sales_usd: number; profit_usd: number }>;

    const out = { companyId, branchId, days, rows };
    if (cacheKey) {
      await safeCacheSet(cacheKey, out, {
        ttlSeconds: redisCacheService.ttls.reports(),
        tags,
      });
    }
    return out;
  },

  async branchPerformance(params?: { months?: number }) {
    const companyId = requireTenantCompanyId();
    const months = clampInt(params?.months, 6, 1, 36);

    const cacheKey = redisCacheService.enabled()
      ? `cache:analytics:branch-performance:v1:company:${companyId}:months:${months}`
      : null;
    const tags = [`reports:company:${companyId}`];
    if (cacheKey) {
      const cached = await safeCacheGet<any>(cacheKey);
      if (cached) return cached;
    }

    const rows = (await (prismaPlatform as any).$queryRawUnsafe(
      `
      SELECT branch_id, branch_name, month, sales_usd, profit_usd, expenses_usd, net_profit_usd
      FROM branch_performance
      WHERE company_id = $1
        AND month >= date_trunc('month', now()) - ($2::int * interval '1 month')
      ORDER BY month ASC, branch_name ASC
      `,
      companyId,
      months
    )) as Array<Record<string, unknown>>;

    const out = { companyId, months, rows };
    if (cacheKey) {
      await safeCacheSet(cacheKey, out, {
        ttlSeconds: redisCacheService.ttls.reports(),
        tags,
      });
    }
    return out;
  },

  async topSelling(params?: { days?: number; limit?: number; branchId?: string | null }) {
    const companyId = requireTenantCompanyId();
    const days = clampInt(params?.days, 30, 1, 365);
    const limit = clampInt(params?.limit, 10, 3, 50);
    const branchId = params?.branchId ? String(params.branchId).trim() : null;

    const cacheKey = redisCacheService.enabled()
      ? `cache:analytics:top-selling:v1:company:${companyId}:branch:${branchId || 'all'}:days:${days}:limit:${limit}`
      : null;
    const tags = [
      `reports:company:${companyId}`,
      ...(branchId ? [`reports:company:${companyId}:branch:${branchId}`] : []),
    ];
    if (cacheKey) {
      const cached = await safeCacheGet<any>(cacheKey);
      if (cached) return cached;
    }

    const rows = (await (prismaPlatform as any).$queryRawUnsafe(
      `
      SELECT brand, model, items_sold, revenue_usd_best_effort, cost_usd_best_effort, profit_usd_best_effort, month
      FROM profit_analysis_product
      WHERE company_id = $1
        AND ($2::text IS NULL OR branch_id = $2)
        AND month >= date_trunc('month', now() - ($3::int * interval '1 day'))
      ORDER BY items_sold DESC
      LIMIT $4
      `,
      companyId,
      branchId,
      days,
      limit
    )) as Array<Record<string, unknown>>;

    const out = { companyId, branchId, days, limit, rows };
    if (cacheKey) {
      await safeCacheSet(cacheKey, out, {
        ttlSeconds: redisCacheService.ttls.reports(),
        tags,
      });
    }
    return out;
  },

  async inventoryAging(params?: { minAgeDays?: number; status?: string; branchId?: string | null; limit?: number }) {
    const companyId = requireTenantCompanyId();
    const minAgeDays = clampInt(params?.minAgeDays, 60, 0, 3650);
    const limit = clampInt(params?.limit, 500, 10, 5000);
    const branchId = params?.branchId ? String(params.branchId).trim() : null;
    const status = params?.status ? String(params.status).trim() : null;

    const cacheKey = redisCacheService.enabled()
      ? `cache:analytics:inventory-aging:v1:company:${companyId}:branch:${branchId || 'all'}:status:${status || 'all'}:minAge:${minAgeDays}:limit:${limit}`
      : null;
    const tags = [
      `dashboard:company:${companyId}`,
      `reports:company:${companyId}`,
      ...(branchId ? [`dashboard:company:${companyId}:branch:${branchId}`, `reports:company:${companyId}:branch:${branchId}`] : []),
    ];
    if (cacheKey) {
      const cached = await safeCacheGet<any>(cacheKey);
      if (cached) return cached;
    }

    const rows = (await (prismaPlatform as any).$queryRawUnsafe(
      `
      SELECT company_id, branch_id, status, brand, model, imei, created_at, age_days, cost_usd_best_effort, selling_price
      FROM inventory_aging
      WHERE company_id = $1
        AND ($2::text IS NULL OR branch_id = $2)
        AND ($3::text IS NULL OR status = $3)
        AND age_days >= $4::int
      ORDER BY age_days DESC
      LIMIT $5::int
      `,
      companyId,
      branchId,
      status,
      minAgeDays,
      limit
    )) as Array<Record<string, unknown>>;

    const out = { companyId, branchId, status, minAgeDays, limit, rows };
    if (cacheKey) {
      await safeCacheSet(cacheKey, out, {
        ttlSeconds: Math.min(redisCacheService.ttls.reports(), 120),
        tags,
      });
    }
    return out;
  },
};

