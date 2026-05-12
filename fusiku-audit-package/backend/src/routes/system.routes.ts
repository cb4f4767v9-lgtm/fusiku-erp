import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { healthService } from '../services/health.service';
import { versionService } from '../services/version.service';
import { systemCheckService } from '../services/systemCheck.service';
import { getMetrics } from '../middlewares/performance.middleware';

const router = Router();

router.get('/version', (req, res) => {
  res.json(versionService.getFull());
});

router.get('/info', async (req, res) => {
  try {
    const version = versionService.getFull();
    const health = await healthService.check();

    let dbVersion = null;
    try {
      const r = await prisma.$queryRaw`SELECT version()`;
      dbVersion = (r as any[])?.[0]?.version ?? null;
    } catch {}

    res.json({
      erpVersion: version.version,
      environment: version.environment,
      buildDate: version.buildDate,
      databaseVersion: dbVersion,
      uptime: (health as any).uptime,
      modules: [
        'inventory','pos','repairs','refurbishing',
        'reports','transfers','ai','warranty','multi-company'
      ]
    });

  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/check', async (req, res) => {
  try {
    const result = await systemCheckService.check();
    res.status(result.ready ? 200 : 503).json(result);
  } catch (e: any) {
    res.status(503).json({ ready: false, error: e.message });
  }
});

router.get('/health', async (req, res) => {
  try {
    const health = await healthService.check();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (e: any) {
    res.status(503).json({ status: 'unhealthy', error: e.message });
  }
});

router.get('/metrics', (req, res) => {
  res.json({ metrics: getMetrics() });
});

export const systemRoutes = router;