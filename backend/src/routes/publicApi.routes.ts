/**
 * Public API routes - /api/public/v1/
 * Phase 10 - Platform API & Extension Ecosystem
 */
import { Router } from 'express';
import { apiKeyMiddleware, requirePermission } from '../middlewares/apiKey.middleware';
import { rateLimitPublicMiddleware } from '../middlewares/rateLimitPublic.middleware';
import { publicApiController } from '../controllers/publicApi.controller';

const router = Router();

router.use(apiKeyMiddleware);
router.use(rateLimitPublicMiddleware);

router.get('/inventory', requirePermission('read_inventory'), publicApiController.getInventory);
router.get('/devices', requirePermission('read_inventory'), publicApiController.getDevices);
router.post('/sales', requirePermission('create_sales'), publicApiController.createSale);
router.get('/reports', requirePermission('read_reports'), publicApiController.getReports);

export const publicApiRoutes = router;
