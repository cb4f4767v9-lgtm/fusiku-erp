import './env'; // MUST be first
import 'express-async-errors';

import { startOtel } from './observability/otel';
import * as Sentry from '@sentry/node';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { buildApplication } from './http/application';
import { auditSystem } from './services/audit.service';
import { getSocketIoCors } from './config/httpCors';
import { logger } from './utils/logger';
import { prisma } from './utils/prisma';
import { prismaPlatform } from './utils/prismaPlatform';
import { connectPrismaWithRetry } from './utils/dbConnect';
import { describeDatabaseUrl, getActiveDatabaseUrl } from './utils/databaseUrl';
import { currencyService } from './services/currency.service';
import { verifyToken } from './utils/jwt';
import { isPlatformAdminRole } from './utils/tenantContext';
import { ensurePowerBiViews } from './analytics/ensurePowerBiViews';
import { ensureAnalyticsIndexes } from './analytics/ensureAnalyticsIndexes';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  });
}

auditSystem();

const { app, FRONTEND_DIST, FRONTEND_INDEX } = buildApplication();

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: getSocketIoCors() });

const PORT = (() => {
  const n = Number(process.env.PORT);
  return Number.isFinite(n) && n > 0 ? n : 3001;
})();

io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) return next(new Error('Unauthorized'));

    const payload = verifyToken(token);

    const isSystemAdmin = payload.isSystemAdmin || isPlatformAdminRole(payload.roleName);

    if (!payload.companyId && !isSystemAdmin) {
      return next(new Error('Unauthorized'));
    }

    socket.data.user = payload;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

async function start() {
  try {
    await startOtel();
    await connectPrismaWithRetry(prisma);

// TEMP FIX (disable second DB + analytics)
// await connectPrismaWithRetry(prismaPlatform);
// await ensurePowerBiViews(prismaPlatform);
// await ensureAnalyticsIndexes(prismaPlatform);
    const dbUrl = getActiveDatabaseUrl();
    const { safeLog } = describeDatabaseUrl(dbUrl);

    logger.info({ db: safeLog }, 'Database connected');

    if (!fs.existsSync(FRONTEND_INDEX)) {
      logger.warn(
        { FRONTEND_DIST },
        'frontend/dist/index.html not found — web UI unavailable until the frontend is built'
      );
    }

    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Fusiku API + static UI on http://0.0.0.0:${PORT}`);

      setInterval(() => {
        currencyService.fetchLiveRates().catch(() => {});
      }, 300000);
    });
  } catch (err) {
    logger.error({ err }, 'Startup failed');
    Sentry.captureException(err);
    process.exit(1);
  }
}

start();
