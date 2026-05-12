import * as net from 'net';
import { prisma } from '../utils/prisma';
import { getMetrics } from '../middlewares/performance.middleware';

const startTime = Date.now();

function parseRedisUrl(url: string): { host: string; port: number } | null {
  try {
    const u = new URL(url);
    return { host: u.hostname, port: parseInt(u.port || '6379', 10) };
  } catch {
    return null;
  }
}

function pingRedis(url: string): Promise<'connected' | 'disconnected'> {
  return new Promise((resolve) => {
    const parsed = parseRedisUrl(url);
    if (!parsed) return resolve('disconnected');
    const socket = net.createConnection(parsed.port, parsed.host, () => {
      socket.write('*1\r\n$4\r\nPING\r\n');
    });
    socket.once('data', () => {
      socket.destroy();
      resolve('connected');
    });
    socket.on('error', () => {
      socket.destroy();
      resolve('disconnected');
    });
    socket.setTimeout(3000, () => {
      socket.destroy();
      resolve('disconnected');
    });
  });
}

export const healthService = {
  async check() {
    const [dbOk, memory, cpuUsage, redisStatus] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      Promise.resolve(process.memoryUsage()),
      Promise.resolve(process.cpuUsage()).catch(() => ({ user: 0, system: 0 })),
      process.env.REDIS_URL ? pingRedis(process.env.REDIS_URL) : Promise.resolve(null as 'connected' | 'disconnected' | null),
    ]);

    const metrics = getMetrics() as Array<{ path: string; count: number; totalMs: number; errors: number; avgMs?: number }>;
    const totalRequests = metrics.reduce((s, m) => s + m.count, 0);
    const totalTime = metrics.reduce((s, m) => s + m.totalMs, 0);
    const totalErrors = metrics.reduce((s, m) => s + m.errors, 0);
    const avgResponseTime = totalRequests > 0 ? totalTime / totalRequests : 0;

    const api: Record<string, number> = {
      requests: totalRequests,
      avgResponseTimeMs: Math.round(avgResponseTime),
      errors: totalErrors,
    };
    if (metrics.length > 0) {
      api.apiResponseTime = Math.round(avgResponseTime);
    }

    const result: Record<string, unknown> = {
      status: dbOk ? 'healthy' : 'degraded',
      database: dbOk ? 'connected' : 'disconnected',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      cpuUsage: { user: cpuUsage.user, system: cpuUsage.system },
      memory: {
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
        rss: Math.round(memory.rss / 1024 / 1024),
      },
      api,
      timestamp: new Date().toISOString(),
    };

    if (redisStatus !== null) {
      result.redis = redisStatus;
    }

    return result;
  },
};
