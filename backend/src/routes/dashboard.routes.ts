import { Router } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { reportService } from '../services/report.service';
import { logger } from '../utils/logger';
import { assertBranchQueryAllowed } from '../utils/branchAccess';

const router = Router();

/**
 * Compact KPI payload for integrations / tutorial-style clients.
 * Maps to the same data as GET /reports/dashboard.
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const branchId = assertBranchQueryAllowed(req.user, req.query.branchId as string);
    const d = await reportService.getDashboard(branchId, req.user?.companyId ?? null);
    res.json({
      sales: d.totalSales,
      profit: d.totalProfit,
      stock: d.totalDevicesInStock ?? 0,
      repairs: d.repairsInProgress ?? 0
    });
  } catch (e: any) {
    if (e.statusCode === 403) return res.status(403).json({ error: e.message });
    logger.error({ err: e }, '[dashboard] GET summary failed');
    res.status(500).json({ error: 'Failed to load dashboard summary' });
  }
});

export { router as dashboardRoutes };
