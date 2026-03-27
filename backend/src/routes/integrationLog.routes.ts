/**
 * Integration logs routes
 * Phase 10 - Platform API & Extension Ecosystem
 */
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { integrationLogController } from '../controllers/integrationLog.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', integrationLogController.list);

export const integrationLogRoutes = router;
