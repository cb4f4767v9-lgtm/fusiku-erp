import { Router } from 'express';
import { purchaseController } from '../controllers/purchase.controller';

const router = Router();

router.get('/', purchaseController.getAll);
router.get('/:id', purchaseController.getById);
router.post('/', purchaseController.create);

export const purchaseRoutes = router;
