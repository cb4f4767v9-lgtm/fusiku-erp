import { Router } from 'express';
import { salesOrderController } from '../controllers/salesOrder.controller';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';

const router = Router();

router.get('/', salesOrderController.list);
router.get('/:id', salesOrderController.getById);
router.post('/', idempotencyMiddleware, salesOrderController.create);
router.put('/:id', idempotencyMiddleware, salesOrderController.update);
router.post('/:id/confirm', idempotencyMiddleware, salesOrderController.confirm);
router.post('/:id/convert-to-invoice', idempotencyMiddleware, salesOrderController.convertToInvoice);

export const salesOrderRoutes = router;

