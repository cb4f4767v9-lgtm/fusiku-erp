import { Router } from 'express';
import { inventoryController } from '../controllers/inventory.controller';

const router = Router();

router.get('/', inventoryController.getAll);
router.get('/imei/:imei', inventoryController.getByImei);
router.get('/barcode/:barcode', inventoryController.getByBarcode);
router.post('/', inventoryController.create);
router.put('/:id', inventoryController.update);
router.delete('/:id', inventoryController.delete);

export const inventoryRoutes = router;
