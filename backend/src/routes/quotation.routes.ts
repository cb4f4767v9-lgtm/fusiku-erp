import { Router } from 'express';
import { quotationController } from '../controllers/quotation.controller';
import { validateBody, validateParams, validateQuery } from '../core/validation/zodMiddleware';
import {
  quotationGenerateBodySchema,
  quotationIdParamSchema,
  quotationListQuerySchema,
} from '../core/validation/schemas/quotation.schemas';

const router = Router();

router.get('/', validateQuery(quotationListQuerySchema), quotationController.list);
router.post('/generate', validateBody(quotationGenerateBodySchema), quotationController.generate);
router.get('/:id', validateParams(quotationIdParamSchema), quotationController.getById);
router.get('/:id/share', validateParams(quotationIdParamSchema), quotationController.share);
router.delete('/:id', validateParams(quotationIdParamSchema), quotationController.remove);

export const quotationRoutes = router;
