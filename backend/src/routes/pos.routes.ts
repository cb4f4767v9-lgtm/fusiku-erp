import { Router } from 'express';
import { posController } from '../controllers/pos.controller';

const router = Router();

router.post('/sale', posController.createSale);
router.get('/receipt/:id', posController.getReceipt);

export const posRoutes = router;
