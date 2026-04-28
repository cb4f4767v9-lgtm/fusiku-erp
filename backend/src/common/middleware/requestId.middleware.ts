import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

export function requestIdMiddleware() {
  return function reqId(req: Request, res: Response, next: NextFunction) {
    const incoming = String(req.headers['x-request-id'] || '').trim();
    const id = incoming || randomUUID();
    req.requestId = id;
    res.setHeader('x-request-id', id);
    next();
  };
}

