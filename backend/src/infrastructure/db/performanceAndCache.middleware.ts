import type { Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { getTenantContext } from '../../utils/tenantContext';
import { redisCacheService } from '../cache/redisCache.service';
import { dbQueryDurationMs, dbSlowQueriesTotal } from '../../observability/metrics';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const MUTATION_ACTIONS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

const INVALIDATE_MODELS = new Set([
  // Reporting inputs
  'Invoice',
  'InvoiceItem',
  'Sale',
  'SaleItem',
  'Expense',
  'Inventory',
  'Purchase',
  'PurchaseItem',
  'Repair',
  'RefurbishJob',
  'StockMovement',
  'Payment',
  // Dimension-like tables that affect joins/labels
  'Branch',
  'CompanySettings',
  'Currency',
]);

function slowMs(): number {
  const n = Number(process.env.PRISMA_SLOW_QUERY_MS);
  if (!Number.isFinite(n) || n <= 0) return 200;
  return Math.max(25, Math.floor(n));
}

function cacheTagsForTenant(ctx: any): string[] {
  const companyId = String(ctx?.companyId || '').trim();
  if (!companyId) return [];
  const branchId = String(ctx?.branchId || '').trim();
  const tags = [`reports:company:${companyId}`, `dashboard:company:${companyId}`];
  if (branchId) {
    tags.push(`reports:company:${companyId}:branch:${branchId}`);
    tags.push(`dashboard:company:${companyId}:branch:${branchId}`);
  }
  return tags;
}

export const performanceAndCacheMiddleware: Prisma.Middleware = async (params, next) => {
  const t0 = Date.now();
  const tracer = trace.getTracer('fusiku.db');
  const span = tracer.startSpan('prisma.query', {
    attributes: {
      'db.system': 'postgresql',
      'db.operation': params.action,
      'db.prisma.model': params.model || 'unknown',
    },
  });
  try {
    const out = await next(params);
    return out;
  } catch (err) {
    span.recordException(err as any);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw err;
  } finally {
    const elapsedMs = Date.now() - t0;
    const model = params.model || 'unknown';
    const action = params.action || 'unknown';

    // Prometheus DB timing (Grafana-ready).
    try {
      dbQueryDurationMs.labels(model, action).observe(elapsedMs);
    } catch {
      // never block DB ops on metrics
    }
    span.setAttribute('db.prisma.elapsed_ms', elapsedMs);
    span.end();

    if (elapsedMs >= slowMs()) {
      try {
        dbSlowQueriesTotal.labels(model, action).inc();
      } catch {
        // ignore
      }
      logger.warn(
        {
          model,
          action,
          elapsedMs,
        },
        '[prisma] slow query'
      );
    }

    // Cache invalidation for reporting/dashboard.
    if (params.model && INVALIDATE_MODELS.has(params.model) && MUTATION_ACTIONS.has(params.action)) {
      const ctx = getTenantContext();
      const tags = cacheTagsForTenant(ctx);
      if (tags.length && redisCacheService.enabled()) {
        void redisCacheService.invalidateTags(tags).catch(() => {});
      }
    }
  }
};

export function registerPerformanceAndCacheMiddleware(client: { $use: (mw: Prisma.Middleware) => void }): void {
  client.$use(performanceAndCacheMiddleware);
}

