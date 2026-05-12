import { Router } from 'express';
import { supplierController } from '../controllers/supplier.controller';
import { supplierFxRateController } from '../controllers/supplierFxRate.controller';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

router.get('/', requirePermission('suppliers.view'), supplierController.getAll);
router.get('/:id', requirePermission('suppliers.view'), supplierController.getById);
router.post('/', requirePermission('suppliers.create'), supplierController.create);
router.put('/:id', requirePermission('suppliers.create'), supplierController.update);
router.delete('/:id', requirePermission('suppliers.create'), supplierController.delete);

// Supplier FX (manual overrides): rate is units of currency per 1 USD.
router.get('/:id/fx-rates', supplierFxRateController.list);
router.put('/:id/fx-rates/:code', supplierFxRateController.upsert);
router.delete('/:id/fx-rates/:code', supplierFxRateController.remove);

export const supplierRoutes = router;
