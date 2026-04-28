import { Router } from 'express';
import { inventoryController } from '../controllers/inventory.controller';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { validateBody, validateParams, validateQuery } from '../core/validation/zodMiddleware';
import {
  inventoryCreateBodySchema,
  inventoryIdParamSchema,
  inventoryListQuerySchema,
} from '../core/validation/schemas/inventory.schemas';

const router = Router();

router.get('/', requirePermission('inventory.view', 'view_inventory'), validateQuery(inventoryListQuerySchema), inventoryController.getAll);
router.get('/pricing-context', requirePermission('inventory.view', 'view_inventory'), inventoryController.pricingContext);
router.get('/imei/:imei', requirePermission('inventory.view', 'view_inventory'), inventoryController.getByImei);
router.get('/barcode/:barcode', requirePermission('inventory.view', 'view_inventory'), inventoryController.getByBarcode);
router.post(
  '/',
  requirePermission('inventory.create', 'create_inventory'),
  validateBody(inventoryCreateBodySchema),
  idempotencyMiddleware,
  inventoryController.create
);
router.put(
  '/:id',
  requirePermission('inventory.create', 'edit_inventory'),
  validateParams(inventoryIdParamSchema),
  inventoryController.update
);
router.delete(
  '/:id',
  requirePermission('inventory.create', 'delete_inventory'),
  validateParams(inventoryIdParamSchema),
  inventoryController.delete
);

export const inventoryRoutes = router;
