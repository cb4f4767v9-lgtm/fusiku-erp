import type { Request, Response, NextFunction, RequestHandler } from 'express';
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestDurationMs = new client.Histogram({
  name: 'http_server_request_duration_ms',
  help: 'HTTP request duration in ms',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [5, 10, 25, 50, 100, 200, 400, 800, 1500, 3000, 7000, 15000],
  registers: [register],
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_server_requests_total',
  help: 'HTTP requests total',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [register],
});

export const httpErrorsTotal = new client.Counter({
  name: 'http_server_errors_total',
  help: 'HTTP 5xx responses total',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [register],
});

export const dbQueryDurationMs = new client.Histogram({
  name: 'db_query_duration_ms',
  help: 'DB query duration in ms (Prisma middleware)',
  labelNames: ['model', 'action'] as const,
  buckets: [1, 2.5, 5, 10, 25, 50, 100, 200, 400, 800, 1500, 3000],
  registers: [register],
});

export const dbSlowQueriesTotal = new client.Counter({
  name: 'db_slow_queries_total',
  help: 'Slow DB queries (over PRISMA_SLOW_QUERY_MS)',
  labelNames: ['model', 'action'] as const,
  registers: [register],
});

export const redisOperationDurationMs = new client.Histogram({
  name: 'redis_operation_duration_ms',
  help: 'Redis operation duration in ms (cache + invalidation)',
  labelNames: ['op'] as const,
  buckets: [0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100, 200, 400, 800],
  registers: [register],
});

export const redisOperationsTotal = new client.Counter({
  name: 'redis_operations_total',
  help: 'Redis operations total',
  labelNames: ['op', 'result'] as const, // hit|miss|ok|error
  registers: [register],
});

function routeLabel(req: Request): string {
  // Prefer the express route pattern (stable cardinality) if available.
  const r = (req as any).route?.path;
  if (typeof r === 'string') return r;
  // Router-mounted routes often expose baseUrl + path; keep low-cardinality.
  const base = String((req as any).baseUrl || '').trim();
  if (base) return base;
  return 'unknown';
}

export function metricsMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const ms = Number(end - start) / 1_000_000;
      const method = String(req.method || 'GET').toUpperCase();
      const route = routeLabel(req);
      const status = String(res.statusCode || 0);
      httpRequestDurationMs.labels(method, route, status).observe(ms);
      httpRequestsTotal.labels(method, route, status).inc();
      if (res.statusCode >= 500) httpErrorsTotal.labels(method, route, status).inc();
    });
    next();
  };
}

export async function renderMetrics(): Promise<{ contentType: string; body: string }> {
  const body = await register.metrics();
  return { contentType: register.contentType, body };
}

