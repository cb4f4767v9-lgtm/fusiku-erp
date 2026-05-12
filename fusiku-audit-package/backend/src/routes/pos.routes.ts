import { Router } from 'express';
import { posController } from '../controllers/pos.controller';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';

const router = Router();

router.post('/sale', idempotencyMiddleware, posController.createSale);
router.get('/receipt/:id', posController.getReceipt);

export const posRoutes = router;
