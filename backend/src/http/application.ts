import path from 'path';
import fs from 'fs';
import express from 'express';
import * as Sentry from '@sentry/node';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';

import { getHttpCorsOptions } from '../config/httpCors';
import { createPrefixRedisRateLimitStore } from '../config/rateLimitStores';
import { v1Router } from '../routes/v1/index';
import { authRoutes } from '../routes/auth.routes';
import { performanceMiddleware, getMetrics } from '../middlewares/performance.middleware';
import { logger } from '../utils/logger';
import { apiSuccessEnvelopeMiddleware } from '../middlewares/apiSuccessEnvelope.middleware';
import { secureUploadsMiddleware } from '../middlewares/secureUploads.middleware';
import { publicApiRoutes } from '../routes/publicApi.routes';
import { requestIdMiddleware } from '../common/middleware/requestId.middleware';
import { apiErrorMiddleware } from '../common/middleware/error.middleware';
import { metricsMiddleware, renderMetrics } from '../observability/metrics';
import { stripeWebhookHandler } from './stripeWebhook.handler';
import { healthService } from '../services/health.service';
import { redisCacheService } from '../infrastructure/cache/redisCache.service';
import { useRedis as queueUseRedis } from '../jobs/queue';

/** `__dirname` is `backend/(src|dist)/http` → three levels up to repo root, then `frontend/dist`. */
const FRONTEND_DIST = path.resolve(__dirname, '../../../frontend/dist');
const FRONTEND_INDEX = path.join(FRONTEND_DIST, 'index.html');

console.log('Serving frontend from:', FRONTEND_DIST);
if (!fs.existsSync(FRONTEND_INDEX)) {
  console.warn('Frontend build missing. Run: cd frontend && npm run build');
}

export function buildApplication() {
  const app = express();

  app.use(helmet({ crossOriginEmbedderPolicy: false }));
  app.use(requestIdMiddleware());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as any).requestId || undefined,
      customProps: (req) => ({ requestId: (req as any).requestId }),
    })
  );
  app.use(performanceMiddleware);
  app.use(metricsMiddleware());

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
      // Avoid counting errors during partial outages; reduces feedback loops.
      skipFailedRequests: true,
      store: createPrefixRedisRateLimitStore('rl:http'),
    })
  );

  app.use(cors(getHttpCorsOptions()));

  // Stripe requires raw body for signature verification; mount BEFORE json parser.
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(apiSuccessEnvelopeMiddleware());

  app.get(/^\/uploads\/.+/, secureUploadsMiddleware);

  app.get('/api/health', (_, res) => {
    // Non-breaking extension: include dependency status (Redis/cache/queue) without failing the endpoint.
    healthService
      .check()
      .then((base) => {
        res.json({
          ...base,
          service: 'Fusiku API',
          dependencies: {
            redis: {
              configured: Boolean(process.env.REDIS_URL),
              status: (base as any).redis ?? null,
            },
            cache: {
              enabled: redisCacheService.enabled(),
            },
            queue: {
              bullmqEnabled: String(process.env.USE_BULLMQ || '0') === '1',
              redisAvailable: queueUseRedis(),
            },
          },
        });
      })
      .catch((err) => {
        logger.warn({ err }, '[health] check failed (soft-fail)');
        res.json({
          status: 'degraded',
          service: 'Fusiku API',
          dependencies: {
            redis: { configured: Boolean(process.env.REDIS_URL), status: null },
            cache: { enabled: redisCacheService.enabled() },
            queue: { bullmqEnabled: String(process.env.USE_BULLMQ || '0') === '1', redisAvailable: queueUseRedis() },
          },
          timestamp: new Date().toISOString(),
        });
      });
  });

  if (process.env.EXPOSE_HTTP_METRICS === '1' || process.env.NODE_ENV !== 'production') {
    app.get('/api/metrics/http', (_req, res) => {
      res.json({ metrics: getMetrics(), ts: new Date().toISOString() });
    });
  }

  if (process.env.EXPOSE_PROM_METRICS === '1' || process.env.NODE_ENV !== 'production') {
    app.get('/api/metrics', async (_req, res) => {
      const { contentType, body } = await renderMetrics();
      res.setHeader('Content-Type', contentType);
      res.status(200).send(body);
    });
  }

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', v1Router);
  app.use('/api/public/v1', publicApiRoutes);

  // Standard API error handler (structured + Sentry capture).
  app.use(apiErrorMiddleware());

  app.use(express.static(FRONTEND_DIST));

  app.get('*', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    if (req.path.startsWith('/assets')) return next();
    if (req.path.includes('.')) return next();
    res.sendFile(FRONTEND_INDEX);
  });

  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }

  return { app, FRONTEND_DIST, FRONTEND_INDEX };
}
