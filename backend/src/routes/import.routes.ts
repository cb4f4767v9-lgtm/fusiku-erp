import { Router } from 'express';
import { importController } from '../controllers/import.controller';

const router = Router();

router.post('/inventory', importController.upload.single('file'), importController.importInventory);
router.post('/suppliers', importController.upload.single('file'), importController.importSuppliers);
router.post('/purchases', importController.upload.single('file'), importController.importPurchases);

export const importRoutes = router;
