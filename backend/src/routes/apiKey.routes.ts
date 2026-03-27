/**
 * API Key management routes
 * Phase 10 - Platform API & Extension Ecosystem
 */
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { apiKeyController } from '../controllers/apiKey.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', apiKeyController.list);
router.post('/', apiKeyController.create);
router.delete('/:id', apiKeyController.revoke);
router.put('/:id/permissions', apiKeyController.updatePermissions);

export const apiKeyRoutes = router;
