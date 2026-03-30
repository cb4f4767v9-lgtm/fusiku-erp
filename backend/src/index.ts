import './env'; // MUST be first: loads .env before any module reads process.env
import { auditSystem } from './services/audit.service';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { v1Router } from './routes/v1/index';
import { authRoutes } from './routes/auth.routes';
import { authMiddleware } from './middlewares/auth.middleware';
import { performanceMiddleware, getMetrics } from './middlewares/performance.middleware';
import { logger } from './utils/logger';
import { loadAppConfig } from './config/appConfig';
import { prisma } from './utils/prisma';
import { connectPrismaWithRetry } from './utils/dbConnect';
import bcrypt from 'bcryptjs';
import { describeDatabaseUrl, getActiveDatabaseUrl } from './utils/databaseUrl';
import { setupService } from './services/setup.service';

// Backward compatibility: keep old route imports for /api/ mount
import { userRoutes } from './routes/user.routes';
import { branchRoutes } from './routes/branch.routes';
import { inventoryRoutes } from './routes/inventory.routes';
import { imeiRoutes } from './routes/imei.routes';
import { supplierRoutes } from './routes/supplier.routes';
import { purchaseRoutes } from './routes/purchase.routes';
import { posRoutes } from './routes/pos.routes';
import { repairRoutes } from './routes/repair.routes';
import { refurbishRoutes } from './routes/refurbish.routes';
import { exchangeRateRoutes } from './routes/exchangeRate.routes';
import { reportRoutes } from './routes/report.routes';
import { importRoutes } from './routes/import.routes';
import { auditRoutes } from './routes/audit.routes';
import { roleRoutes } from './routes/role.routes';
import { transferRoutes } from './routes/transfer.routes';
import { phoneDatabaseRoutes } from './routes/phoneDatabase.routes';
import { deviceGradeRoutes } from './routes/deviceGrade.routes';
import { uploadRoutes } from './routes/upload.routes';
import { stockMovementRoutes } from './routes/stockMovement.routes';
import { stockAlertRoutes } from './routes/stockAlert.routes';
import { logsRoutes } from './routes/logs.routes';
import { permissionRoutes } from './routes/permission.routes';
import { pdfRoutes } from './routes/pdf.routes';
import { warrantyRoutes } from './routes/warranty.routes';
import { customerRoutes } from './routes/customer.routes';
import { activityLogRoutes } from './routes/activityLog.routes';
import { publicApiRoutes } from './routes/publicApi.routes';
import { apiKeyRoutes } from './routes/apiKey.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { integrationLogRoutes } from './routes/integrationLog.routes';
import { locationRoutes } from './routes/location.routes';
import analyticsRoutes from './routes/analytics';

auditSystem();

const app = express();
const { config: APP_CONFIG, path: APP_CONFIG_PATH } = loadAppConfig();
const PORT = process.env.PORT || APP_CONFIG?.ports?.backend || 3001;
logger.info({ APP_CONFIG_PATH }, '[config] loaded shared config');

// Security headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false,
}));

// Logging & performance
app.use(pinoHttp({ logger }));
app.use(performanceMiddleware);

// Electron hot-update manifest (no rate limit)
app.get('/version.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json({
    version: process.env.FRONTEND_HOT_VERSION || '1.0.0',
    url: process.env.FRONTEND_HOT_ZIP_URL || '',
    sha256: (process.env.FRONTEND_HOT_SHA256 || '').toLowerCase(),
  });
});

// Rate limiting - skip auth routes for unlimited login/forgot-password attempts
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: 1000,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path || '';
    return (
      p === '/version.json' ||
      p.includes('/auth/login') ||
      p.includes('/auth/register') ||
      p.includes('/auth/forgot-password') ||
      p.includes('/auth/reset-password') ||
      p.includes('/setup/')
    );
  }
});

app.use(limiter);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/static-updates', express.static(path.join(process.cwd(), 'static-updates')));

// Health check
app.get('/api/health', (_, res) =>
  res.json({ status: 'ok', service: `${APP_CONFIG?.app?.name || 'Fusiku'} API` })
);
app.get('/force-admin', async (req, res) => {
  const bcrypt = require('bcryptjs');

  const role = await prisma.role.findFirst();
  const company = await prisma.company.findFirst();

  if (!role || !company) {
    return res.json({ error: 'Role or Company missing' });
  }

  const user = await prisma.user.create({
    data: {
      email: 'admin@fusiku.com',
      password: bcrypt.hashSync('admin123', 10),
      name: 'Admin',
      roleId: role.id,
      companyId: company.id,
      isActive: true,
    },
  });

  res.json({ success: true, user });
});
/** App version (public JSON — same idea as Django `JsonResponse({"version": "..."})`) */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const APP_VERSION = '1.0.0';

app.get(['/api/version', '/api/version/'], (_, res) => {
  res.json({ version: APP_VERSION });
});

// Public API - Phase 10 - requires API key, rate limited
app.use('/api/public/v1', publicApiRoutes);

// API v1 (primary) - includes /system/health
app.use('/api/v1', v1Router);
app.use('/api/analytics', authMiddleware, analyticsRoutes);

// Backward compatibility: legacy /api/ routes
app.use('/api/auth', authRoutes);
app.use('/api/roles', authMiddleware, roleRoutes);
app.use('/api/permissions', authMiddleware, permissionRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/branches', authMiddleware, branchRoutes);
app.use('/api/inventory', authMiddleware, inventoryRoutes);
app.use('/api/imei', authMiddleware, imeiRoutes);
app.use('/api/suppliers', authMiddleware, supplierRoutes);
app.use('/api/purchases', authMiddleware, purchaseRoutes);
app.use('/api/pos', authMiddleware, posRoutes);
app.use('/api/repairs', authMiddleware, repairRoutes);
app.use('/api/refurbish', authMiddleware, refurbishRoutes);
app.use('/api/transfers', authMiddleware, transferRoutes);
app.use('/api/phone-database', authMiddleware, phoneDatabaseRoutes);
app.use('/api/device-grades', authMiddleware, deviceGradeRoutes);
app.use('/api/exchange-rates', authMiddleware, exchangeRateRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/import', authMiddleware, importRoutes);
app.use('/api/audit', authMiddleware, auditRoutes);
app.use('/api/stock-movements', authMiddleware, stockMovementRoutes);
app.use('/api/stock-alerts', authMiddleware, stockAlertRoutes);
app.use('/api/logs', authMiddleware, logsRoutes);
app.use('/api/upload', authMiddleware, uploadRoutes);
app.use('/api/pdf', authMiddleware, pdfRoutes);
app.use('/api/warranty', authMiddleware, warrantyRoutes);
app.use('/api/customers', authMiddleware, customerRoutes);
app.use('/api/activity', authMiddleware, activityLogRoutes);
app.use('/api/api-keys', authMiddleware, apiKeyRoutes);
app.use('/api/webhooks', authMiddleware, webhookRoutes);
app.use('/api/integration-logs', authMiddleware, integrationLogRoutes);
app.use('/api/locations', authMiddleware, locationRoutes);

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });

io.on('connection', (socket) => {
  socket.on('join', (room: string) => socket.join(room));
});

export const getIO = () => io;

async function start() {
  await import('./pluginLoader').then(({ loadPlugins }) => loadPlugins(app).catch(() => {}));

  // Ensure DB is reachable early (and bootstrap default admin once).
  try {
    await connectPrismaWithRetry(prisma);

    const userCount = await prisma.user.count();

    if (userCount === 0 && process.env.BOOTSTRAP_DEFAULT_ADMIN === 'true') {
      const role = await prisma.role.upsert({
        where: { name: 'SystemAdmin' },
        update: {},
        create: { name: 'SystemAdmin', description: 'System-level administrator' },
      });

      // Company has no @@unique on `name`, so Prisma cannot upsert by name — findFirst + create is equivalent.
      let company = await prisma.company.findFirst({ where: { name: 'Default Company' } });
      if (!company) {
        company = await prisma.company.create({ data: { name: 'Default Company' } });
      }

      const email = 'admin@fusiku.com';
      const password = 'admin123';

      await prisma.user.create({
        data: {
          email,
          password: bcrypt.hashSync(password, 10),
          name: 'Admin',
          roleId: role.id,
          companyId: company.id,
          isActive: true,
        },
      });

      console.log('✅ ADMIN CREATED SUCCESSFULLY');
      logger.info({ email, companyId: company.id }, '[bootstrap] Created default admin user (BOOTSTRAP_DEFAULT_ADMIN=true)');
    }

    // TEMP: remove — final DB snapshot for this process (includes password hashes)
    {
      const count = await prisma.user.count();
      console.log('USER COUNT:', count);
      const users = await prisma.user.findMany();
      console.log('ALL USERS IN DB:', users);
    }

    const dbUrl = getActiveDatabaseUrl();
    const { kind, safeLog } = describeDatabaseUrl(dbUrl);
    console.log('[startup] DATABASE_URL (redacted):', safeLog, '| kind:', kind);
    const setupStatus = await setupService.getSetupStatus();
    logger.info(
      {
        databaseKind: kind,
        databaseUrl: safeLog,
        userCount: setupStatus.userCount,
        setupComplete: setupStatus.setupComplete,
        needsRepair: setupStatus.needsRepair,
      },
      '[startup] database and setup status'
    );
  } catch (err) {
    console.error('BOOTSTRAP ERROR:', err);
    logger.error({ err }, '[bootstrap] Failed to connect/bootstrap database');
    // Continue startup so health checks/logs remain available.
  }

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use. Is another backend instance running? Exiting.`);
    } else {
      logger.error({ err }, 'HTTP server error');
    }
    process.exit(1);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`Fusiku API running on port ${PORT}`);
    logger.info('Think Smart. Play Cool.');
    import('./jobs/worker').then(({ startWorker }) => startWorker());
    import('./jobs/scheduler').then(({ startScheduler }) => startScheduler());
  });
}
start();
