/**
 * Webhook management routes
 * Phase 10 - Platform API & Extension Ecosystem
 */
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { webhookController } from '../controllers/webhook.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', webhookController.list);
router.post('/', webhookController.create);
router.delete('/:id', webhookController.delete);

export const webhookRoutes = router;
