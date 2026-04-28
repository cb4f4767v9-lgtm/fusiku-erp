import { Router } from 'express';
import { setupController } from '../controllers/setup.controller';
import { setupProfileController } from '../controllers/setupProfile.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { tenantGuard } from '../middlewares/tenantGuard.middleware';

const router = Router();

router.get('/status', setupController.getStatus);
router.post('/complete', setupController.complete);
router.post('/profile', authMiddleware, tenantGuard, setupProfileController.upsert);

export const setupRoutes = router;
