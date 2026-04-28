import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { branchQueryGuard } from '../core/auth/branchGuard';

const router = Router();

// Read-only KPI endpoints backed by SQL views (PowerBI-friendly).
router.get('/daily-profit', branchQueryGuard, analyticsController.dailyProfit);
router.get('/branch-performance', analyticsController.branchPerformance);
router.get('/top-selling', branchQueryGuard, analyticsController.topSelling);
router.get('/inventory-aging', branchQueryGuard, analyticsController.inventoryAging);

export const analyticsRoutes = router;

