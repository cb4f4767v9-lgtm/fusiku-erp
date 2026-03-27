import { Router } from 'express';
import { supplierController } from '../controllers/supplier.controller';

const router = Router();

router.get('/', supplierController.getAll);
router.get('/:id', supplierController.getById);
router.post('/', supplierController.create);
router.put('/:id', supplierController.update);
router.delete('/:id', supplierController.delete);

export const supplierRoutes = router;
