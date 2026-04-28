import { Router } from 'express';
import { invoiceController } from '../controllers/invoice.controller';
import { validateBody, validateParams, validateQuery } from '../core/validation/zodMiddleware';
import {
  invoiceIdParamSchema,
  invoiceListQuerySchema,
  invoicePaymentBodySchema,
} from '../core/validation/schemas/invoice.schemas';

const router = Router();

router.get('/', validateQuery(invoiceListQuerySchema), invoiceController.list);
router.get('/:id', validateParams(invoiceIdParamSchema), invoiceController.getById);
router.post(
  '/:id/payments',
  validateParams(invoiceIdParamSchema),
  validateBody(invoicePaymentBodySchema),
  invoiceController.createPayment
);

export const invoiceRoutes = router;

