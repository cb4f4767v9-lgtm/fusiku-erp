/**
 * Rate limiting for public API - 100 requests per minute per API key
 * Phase 10 - Platform API & Extension Ecosystem
 */
import { Request, Response, NextFunction } from 'express';
import { ApiKeyRequest } from './apiKey.middleware';

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100;

const store = new Map<string, { count: number; resetAt: number }>();

function getKey(req: ApiKeyRequest): string {
  return req.apiKey?.id || req.ip || 'anonymous';
}

export function rateLimitPublicMiddleware(req: ApiKeyRequest, res: Response, next: NextFunction) {
  const key = getKey(req);
  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    store.set(key, entry);
  }

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  entry.count++;
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - entry.count));

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Rate limit exceeded. 100 requests per minute allowed.' });
  }
  next();
}
