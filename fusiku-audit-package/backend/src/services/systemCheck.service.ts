/**
 * Fusiku - System Check
 * Installation verification endpoint
 */
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../utils/prisma';
import { isJwtSecretStrong } from '../utils/productionEnv';

const startTime = Date.now();

export const systemCheckService = {
  async check() {
    const checks: Record<string, { status: string; message?: string }> = {};

    // Database
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok' };
    } catch (e: any) {
      checks.database = { status: 'error', message: e.message };
    }

    // Storage (uploads directory)
    try {
      const uploadsPath = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadsPath, '.write-test'), 'ok');
      fs.unlinkSync(path.join(uploadsPath, '.write-test'));
      checks.storage = { status: 'ok' };
    } catch (e: any) {
      checks.storage = { status: 'error', message: e.message };
    }

    // Environment
    const hasDb = !!process.env.DATABASE_URL;
    const hasJwt = isJwtSecretStrong(process.env.JWT_SECRET);
    checks.environment = {
      status: hasDb && hasJwt ? 'ok' : 'warning',
      message: !hasDb ? 'DATABASE_URL not set' : !hasJwt ? 'JWT_SECRET should be changed in production' : undefined
    };

    // Job queue (Redis optional)
    if (process.env.REDIS_URL) {
      try {
        const Redis = (await import('ioredis')).default;
        const client = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
        await client.ping();
        await client.quit();
        checks.jobQueue = { status: 'ok' };
      } catch {
        checks.jobQueue = { status: 'warning', message: 'Redis not reachable (optional)' };
      }
    } else {
      checks.jobQueue = { status: 'ok', message: 'Using in-memory queue' };
    }

    const allOk = Object.values(checks).every((c) => c.status === 'ok' || c.status === 'warning');
    return {
      ready: allOk,
      checks,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString()
    };
  }
};
