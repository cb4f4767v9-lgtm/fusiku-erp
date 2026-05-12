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
import { connectPrismaWithRetry } from './utils/dbConnect';
import { describeDatabaseUrl, getActiveDatabaseUrl } from './utils/databaseUrl';
import { currencyService } from './services/currency.service';
import { verifyToken } from './utils/jwt';
import { isPlatformAdminRole, runWithTenantContext } from './utils/tenantContext';
import { registerChatSockets } from './realtime/chatGateway';

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

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const HOST = String(process.env.HOST || '0.0.0.0');

// Make unexpected crashes visible in Railway logs.
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, '[process] unhandledRejection');
  try {
    Sentry.captureException(reason);
  } catch {}
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, '[process] uncaughtException');
  try {
    Sentry.captureException(err);
  } catch {}
  // Keep default behavior (crash) in production unless explicitly opted out.
  if (process.env.NODE_ENV === 'production' && String(process.env.KEEP_ALIVE_ON_UNCAUGHT || '0') !== '1') {
    process.exit(1);
  }
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn({ signal }, '[process] shutting down');
  try {
    io.close();
  } catch {}
  try {
    httpServer.close();
  } catch {}
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

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

// Internal Branch Chat — registers `chat:join`, `chat:send`, `chat:typing`, …
registerChatSockets(io);

async function start() {
  try {
    // Observability must never prevent the service from starting.
    try {
      await startOtel();
    } catch (err) {
      logger.warn({ err }, '[otel] failed to start (soft-fail)');
    }

    // Prisma connect is attempted eagerly for faster failure visibility,
    // but can be configured to soft-fail to avoid Railway 502 on transient DB issues.
    try {
      await connectPrismaWithRetry(prisma);
    } catch (err) {
      const strict = String(process.env.DB_CONNECT_STRICT || '0') === '1';
      logger.error({ err, strict }, '[db] failed to connect on startup');
      if (strict) throw err;
    }

    const dbUrl = getActiveDatabaseUrl();
    const { safeLog } = describeDatabaseUrl(dbUrl);

    logger.info({ db: safeLog }, 'Database connected');

    if (!fs.existsSync(FRONTEND_INDEX)) {
      logger.warn(
        { FRONTEND_DIST },
        'frontend/dist/index.html not found — web UI unavailable until the frontend is built'
      );
    }

    httpServer.listen(PORT, HOST, () => {
      logger.info(`🚀 Fusiku API + static UI on http://${HOST}:${PORT}`);

      // Run the cross-tenant FX refresh inside a system-admin context so that
      // the Prisma tenant-isolation middleware (which throws when companyId is
      // missing on tenant-scoped models) doesn't spam "[currency] CRITICAL"
      // errors on every interval tick.
      const refreshFx = () =>
        runWithTenantContext(
          { userId: 'system:fx-refresh', isSystemAdmin: true },
          () => currencyService.fetchLiveRates().catch(() => {})
        );
      setInterval(refreshFx, 300000);
    });
  } catch (err) {
    logger.error({ err }, 'Startup failed');
    Sentry.captureException(err);
    process.exit(1);
  }
}

start();
