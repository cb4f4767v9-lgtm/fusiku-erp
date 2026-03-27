import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const metrics: { path: string; count: number; totalMs: number; errors: number }[] = [];

export function performanceMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const path = req.route?.path || req.path;
    let m = metrics.find((x) => x.path === path);
    if (!m) {
      m = { path, count: 0, totalMs: 0, errors: 0 };
      metrics.push(m);
    }
    m.count++;
    m.totalMs += duration;
    if (res.statusCode >= 400) m.errors++;
    if (duration > 1000) {
      logger.warn({ path, duration, status: res.statusCode }, 'Slow request');
    }
  });
  next();
}

export function getMetrics() {
  return metrics.map((m) => ({
    ...m,
    avgMs: m.count > 0 ? Math.round(m.totalMs / m.count) : 0
  }));
}
