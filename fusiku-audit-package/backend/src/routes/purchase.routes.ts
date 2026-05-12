import { Router } from 'express';
import { purchaseController } from '../controllers/purchase.controller';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

router.get('/', requirePermission('purchases.view', 'create_purchase'), purchaseController.getAll);
router.get('/:id', requirePermission('purchases.view', 'create_purchase'), purchaseController.getById);
router.post(
  '/',
  requirePermission('purchases.create', 'create_purchase'),
  idempotencyMiddleware,
  purchaseController.create
);

export const purchaseRoutes = router;
