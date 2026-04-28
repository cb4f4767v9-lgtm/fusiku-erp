import type { Request, Response, NextFunction } from 'express';
import { usageMeterService } from '../services/usageMeter.service';

function isAiRoute(path: string): boolean {
  const p = path.replace(/\/+/g, '/');
  return /^\/api\/v1\/ai(\/|$)/.test(p);
}

export async function usageTrackingMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    // Do not await: never slow down API responses for metering.
    void usageMeterService.incr('api_requests', 1);
    if (isAiRoute(req.originalUrl || req.url)) {
      void usageMeterService.incr('ai_requests', 1);
    }
  } catch {
    // ignore
  }
  next();
}

