import type { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { logger } from '../../utils/logger';
import { toStandardErrorShape } from '../errors/appError';
import { incidentService } from '../../services/incident.service';

export function apiErrorMiddleware() {
  return function apiError(err: any, req: Request, res: Response, next: NextFunction) {
    if (!err) return next();

    const requestId = (req as any).requestId as string | undefined;
    const standard = toStandardErrorShape(err, { requestId });
    const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500;

    // Always log full stack for server-side diagnostics.
    logger.error(
      {
        requestId,
        path: req.path,
        method: req.method,
        statusCode,
        error: standard,
        stack: err?.stack,
      },
      '[api] request failed'
    );

    if (process.env.SENTRY_DSN) {
      try {
        Sentry.captureException(err, {
          tags: {
            code: standard.code,
            type: standard.type,
            severity: standard.severity,
            dependency: standard.dependency,
          },
          extra: {
            requestId,
            path: req.path,
            method: req.method,
            retryable: standard.retryable,
            details: standard.details,
          },
        });
      } catch {
        // never block response
      }
    }

    // Auto-create an Incident on HIGH severity errors (non-blocking).
    if (standard.severity === 'HIGH') {
      try {
        const companyId = (req as any)?.user?.companyId ?? null;
        void incidentService
          .create({
            companyId,
            errorCode: standard.code,
            summary: standard.message || 'Unhandled high-severity error',
            severity: 'HIGH',
            source: 'system',
            metadata: {
              requestId,
              path: req.path,
              method: req.method,
              statusCode,
              type: standard.type,
              dependency: standard.dependency,
              retryable: standard.retryable,
            },
          })
          .catch(() => {});
      } catch {
        // never block response
      }
    }

    // API routes always return JSON.
    if (String(req.path || '').startsWith('/api/')) {
      // Canonical API error shape (pairs with apiSuccessEnvelopeMiddleware meta injection).
      return res.status(statusCode).json({
        success: false,
        message: standard.message || 'Request failed',
        // Keep structured error payload for existing clients / debugging.
        error: standard,
      });
    }

    return next(err);
  };
}

