import type { NextFunction, Request, Response } from 'express';
import { TtlCache } from '../utils/ttlCache';

type CachedResponse = { status: number; body: unknown };

const cache = new TtlCache<string, CachedResponse>({ ttlMs: 24 * 60 * 60 * 1000, maxItems: 5000 });

function resolveCompanyId(req: Request): string {
  const u = (req as any).user as { companyId?: string } | undefined;
  return String(u?.companyId || 'anon');
}

/**
 * Idempotency middleware for POST writes.
 * - If `x-idempotency-key` matches a cached response, returns it (no re-execution).
 * - Otherwise, executes handler and caches the JSON response for 24h.
 *
 * Intended for offline outbox retries where the client may re-send the same mutation.
 */
export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const keyRaw = String(req.headers['x-idempotency-key'] || '').trim();
  if (!keyRaw) return next();

  const key = `${resolveCompanyId(req)}:${req.method}:${req.baseUrl}${req.path}:${keyRaw}`;
  const cached = cache.get(key);
  if (cached) {
    return res.status(cached.status).json(cached.body);
  }

  const origJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    try {
      cache.set(key, { status: res.statusCode || 200, body });
    } catch {
      /* ignore cache failures */
    }
    return origJson(body);
  }) as any;

  return next();
}

