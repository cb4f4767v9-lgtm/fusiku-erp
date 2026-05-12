import { Router } from 'express';
import { pricingRuleController } from '../controllers/pricingRule.controller';
import { validateBody, validateParams, validateQuery } from '../core/validation/zodMiddleware';
import {
  pricingRuleCreateBodySchema,
  pricingRuleIdParamSchema,
  pricingRuleListQuerySchema,
  pricingRuleUpdateBodySchema,
} from '../core/validation/schemas/pricingRule.schemas';

const router = Router();

router.get('/', validateQuery(pricingRuleListQuerySchema), pricingRuleController.list);
router.get('/preview', pricingRuleController.preview);
router.get('/:id', validateParams(pricingRuleIdParamSchema), pricingRuleController.getById);
router.post('/', validateBody(pricingRuleCreateBodySchema), pricingRuleController.create);
router.put(
  '/:id',
  validateParams(pricingRuleIdParamSchema),
  validateBody(pricingRuleUpdateBodySchema),
  pricingRuleController.update
);
router.delete('/:id', validateParams(pricingRuleIdParamSchema), pricingRuleController.remove);

export const pricingRuleRoutes = router;
